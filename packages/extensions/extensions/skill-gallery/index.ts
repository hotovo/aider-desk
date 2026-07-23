import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { homedir } from 'node:os';
import { promisify } from 'node:util';
import { loadFront } from 'yaml-front-matter';

import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOME_DIR = process.env.AIDER_DESK_HOME_DIR || join(homedir(), '.aider-desk');
const GLOBAL_SKILLS_DIR = join(HOME_DIR, 'skills');
const CACHE_DIR = join(HOME_DIR, 'cache', 'skill-gallery');
const PROJECT_SKILLS_SUBPATH = join('.aider-desk', 'skills');

const galleryJsx = readFileSync(join(__dirname, './ui/SkillGallery.jsx'), 'utf-8');

const COMPONENT_ID = 'skill-gallery';
const GLOBAL_TARGET = 'global';

interface SkillSource {
  id: string;
  name: string;
  url: string;
  subPath: string;
}

const DEFAULT_SOURCES: SkillSource[] = [
  { id: 'anthropics', name: 'Anthropic Official', url: 'https://github.com/anthropics/skills.git', subPath: 'skills' },
  { id: 'awesome-claude-skills', name: 'Awesome Claude Skills', url: 'https://github.com/ComposioHQ/awesome-claude-skills.git', subPath: '' },
  { id: 'agentic-awesome-skills', name: 'Agentic Awesome Skills', url: 'https://github.com/sickn33/agentic-awesome-skills.git', subPath: 'skills' },
  { id: 'mattpocock-engineering', name: 'Matt Pocock: Engineering', url: 'https://github.com/mattpocock/skills.git', subPath: 'skills/engineering' },
  { id: 'mattpocock-productivity', name: 'Matt Pocock: Productivity', url: 'https://github.com/mattpocock/skills.git', subPath: 'skills/productivity' },
];

interface GallerySkill {
  id: string;
  name: string;
  description: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  repoPath: string;
  skillDirName: string;
  installed: boolean;
}

interface CustomSkillSource {
  name: string;
  url: string;
  subPath: string;
}

interface SkillGalleryConfig {
  customSources: CustomSkillSource[];
}

function parseSkillFrontMatter(markdown: string): { name: string; description: string } | null {
  try {
    const parsed = loadFront(markdown);
    const name = typeof parsed.name === 'string' ? parsed.name : undefined;
    const description = typeof parsed.description === 'string' ? parsed.description : undefined;
    if (!name || !description) return null;
    return { name, description };
  } catch {
    return null;
  }
}

function getSkillsDirForTarget(target: string): string {
  return target === GLOBAL_TARGET ? GLOBAL_SKILLS_DIR : join(target, PROJECT_SKILLS_SUBPATH);
}

export default class SkillGalleryExtension implements Extension {
  static metadata = {
    name: 'Skill Gallery',
    version: '1.0.0',
    description: 'Browse and install Claude Skills from popular skill repositories',
    author: 'wladimiiir',
    capabilities: ['ui'],
  };

  private configPath = join(__dirname, 'config.json');
  private cachedSkills: GallerySkill[] | null = null;
  private fetchPromise: Promise<GallerySkill[]> | null = null;
  private isLoading = false;
  private lastError: string | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Skill Gallery Extension loaded', 'info');
    void this.fetchSkills(context).then(() => {
      context.triggerUIDataRefresh(COMPONENT_ID);
    });
  }

  private getConfigSync(): SkillGalleryConfig {
    try {
      if (existsSync(this.configPath)) {
        return JSON.parse(readFileSync(this.configPath, 'utf-8'));
      }
    } catch {
      // fall back to defaults
    }
    return { customSources: [] };
  }

  private getSources(): SkillSource[] {
    const config = this.getConfigSync();
    const customSources: SkillSource[] = (config.customSources || []).map((entry, i) => {
      const rawUrl = entry.url.trim();
      const subPath = entry.subPath?.trim() || '';
      const repoUrl = rawUrl.endsWith('.git') ? rawUrl : `${rawUrl}.git`;
      const repoName = rawUrl.replace(/\.git$/, '').split('/').pop() || `custom-${i}`;
      const name = entry.name?.trim() || repoName;
      return {
        id: `custom-${repoName}`,
        name,
        url: repoUrl,
        subPath,
      };
    });

    return [...DEFAULT_SOURCES, ...customSources];
  }

  private async fetchSkills(context?: ExtensionContext): Promise<GallerySkill[]> {
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isLoading = true;
    this.lastError = null;

    this.fetchPromise = this.doFetchSkills(context);

    try {
      const result = await this.fetchPromise;
      this.cachedSkills = result;
      return result;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      if (context) context.log(`Skill fetch failed: ${this.lastError}`, 'error');
      return this.cachedSkills || [];
    } finally {
      this.fetchPromise = null;
      this.isLoading = false;
    }
  }

  private async doFetchSkills(context?: ExtensionContext): Promise<GallerySkill[]> {
    const sources = this.getSources();
    const allSkills: GallerySkill[] = [];

    for (const source of sources) {
      try {
        if (context) context.log(`Fetching skills from ${source.name}...`, 'debug');
        const repoDir = await this.cloneOrPullRepo(source);
        const skills = this.scanForSkills(repoDir, source);
        allSkills.push(...skills);
      } catch (err) {
        if (context) context.log(`Failed to fetch from ${source.name}: ${err instanceof Error ? err.message : String(err)}`, 'warn');
      }
    }

    if (context) context.log(`Loaded ${allSkills.length} skills from ${sources.length} source(s)`, 'info');
    return allSkills;
  }

  private async cloneOrPullRepo(source: SkillSource): Promise<string> {
    const repoName = source.url.split('/').pop()?.replace(/\.git$/, '') || 'unknown';
    const repoDir = join(CACHE_DIR, `${source.id}--${repoName}`);

    const gitDir = join(repoDir, '.git');
    if (existsSync(gitDir)) {
      try {
        await execAsync(`git -C "${repoDir}" pull`, { cwd: repoDir });
        return repoDir;
      } catch {
        rmSync(repoDir, { recursive: true, force: true });
      }
    }

    mkdirSync(CACHE_DIR, { recursive: true });
    await execAsync(`git clone --depth 1 "${source.url}" "${repoDir}"`, { cwd: CACHE_DIR });
    return repoDir;
  }

  private scanForSkills(repoDir: string, source: SkillSource): GallerySkill[] {
    const scanDir = source.subPath ? join(repoDir, source.subPath) : repoDir;
    if (!existsSync(scanDir)) return [];

    const skills: GallerySkill[] = [];
    let entries: string[];
    try {
      entries = readdirSync(scanDir);
    } catch {
      return [];
    }

    for (const entry of entries) {
      if (entry.startsWith('.') || entry.startsWith('_')) continue;

      const entryPath = join(scanDir, entry);
      let stat;
      try {
        stat = statSync(entryPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const skillMdPath = join(entryPath, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      let markdown: string;
      try {
        markdown = readFileSync(skillMdPath, 'utf-8');
      } catch {
        continue;
      }

      const parsed = parseSkillFrontMatter(markdown);
      if (!parsed) continue;

      const skillDirName = `${source.id}--${entry}`;

      skills.push({
        id: `${source.id}/${entry}`,
        name: parsed.name,
        description: parsed.description,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url.replace(/\.git$/, ''),
        repoPath: entryPath,
        skillDirName,
        installed: false,
      });
    }

    return skills;
  }

  private installSkill(skillId: string, target: string): GallerySkill[] | null {
    if (!this.cachedSkills) return null;
    const skill = this.cachedSkills.find((s) => s.id === skillId);
    if (!skill) return null;

    const skillsDir = getSkillsDirForTarget(target);
    const destDir = join(skillsDir, skill.skillDirName);
    mkdirSync(skillsDir, { recursive: true });

    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true });
    }

    cpSync(skill.repoPath, destDir, { recursive: true });

    this.updateInstalledStates(target);

    return [...this.cachedSkills];
  }

  private uninstallSkill(skillId: string, target: string): GallerySkill[] | null {
    if (!this.cachedSkills) return null;
    const skill = this.cachedSkills.find((s) => s.id === skillId);
    if (!skill) return null;

    const skillsDir = getSkillsDirForTarget(target);
    const destDir = join(skillsDir, skill.skillDirName);
    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true });
    }

    this.updateInstalledStates(target);

    return [...this.cachedSkills];
  }

  private updateInstalledStates(target: string = GLOBAL_TARGET): void {
    if (!this.cachedSkills) return;
    const skillsDir = getSkillsDirForTarget(target);
    for (const skill of this.cachedSkills) {
      skill.installed = existsSync(join(skillsDir, skill.skillDirName, 'SKILL.md'));
    }
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: COMPONENT_ID,
        placement: 'header-right',
        jsx: galleryJsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) return undefined;

    this.updateInstalledStates(GLOBAL_TARGET);

    return {
      skills: this.cachedSkills || [],
      loading: this.isLoading,
      error: this.lastError,
      customSources: this.getConfigSync().customSources,
      openProjectDirs: this.getOpenProjectDirsSafe(context),
    };
  }

  // `getOpenProjectDirs` may not exist on older AiderDesk versions that haven't
  // updated their bundled ExtensionContext implementation yet. Guard against
  // that instead of hard-failing, and return null (as opposed to an empty
  // array) so the UI can distinguish "unsupported" from "no open projects".
  private getOpenProjectDirsSafe(context: ExtensionContext): string[] | null {
    try {
      if (typeof context.getOpenProjectDirs !== 'function') {
        return null;
      }
      return context.getOpenProjectDirs();
    } catch (err) {
      context.log(`getOpenProjectDirs is unavailable: ${err instanceof Error ? err.message : String(err)}`, 'warn');
      return null;
    }
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== COMPONENT_ID) return undefined;

    switch (action) {
      case 'fetch-skills': {
        const target = (args[0] as string) || GLOBAL_TARGET;
        const skills = await this.fetchSkills(context);
        this.updateInstalledStates(target);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return { skills, loading: false, error: this.lastError };
      }
      case 'select-target': {
        const target = (args[0] as string) || GLOBAL_TARGET;
        this.updateInstalledStates(target);
        return { skills: this.cachedSkills || [], loading: false, error: this.lastError };
      }
      case 'install-skill': {
        const skillId = args[0] as string;
        const target = (args[1] as string) || GLOBAL_TARGET;
        const result = this.installSkill(skillId, target);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return result ? { skills: result, loading: false, error: null } : undefined;
      }
      case 'uninstall-skill': {
        const skillId = args[0] as string;
        const target = (args[1] as string) || GLOBAL_TARGET;
        const result = this.uninstallSkill(skillId, target);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return result ? { skills: result, loading: false, error: null } : undefined;
      }
      case 'save-sources': {
        const customSources = (args[0] as CustomSkillSource[]) || [];
        const target = (args[1] as string) || GLOBAL_TARGET;
        const merged: SkillGalleryConfig = { customSources };
        writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');

        this.cachedSkills = null;
        const skills = await this.fetchSkills(context);
        this.updateInstalledStates(target);
        context.triggerUIDataRefresh(COMPONENT_ID);

        return { skills, loading: false, error: this.lastError, customSources };
      }
      default:
        return undefined;
    }
  }
}
