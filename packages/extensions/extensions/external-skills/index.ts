/**
 * External Skills Extension
 *
 * Discovers and includes skill files from external AI coding assistant configurations.
 * Skill sources are configured via the extension settings (comma-separated paths).
 * Directories are scanned for subdirectories containing SKILL.md files;
 * individual .md files are added directly as content-based skills.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { loadFront } from "yaml-front-matter";

import type { Extension, ExtensionContext, SkillDefinition } from "@aiderdesk/extensions";

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

interface ExternalSkillsConfig {
  skillFolders: string;
}

const parseSkillFrontMatter = (markdown: string): { name: string; description: string } | null => {
  const parsed = loadFront(markdown);
  const name = typeof parsed.name === 'string' ? parsed.name : undefined;
  const description = typeof parsed.description === 'string' ? parsed.description : undefined;

  if (!name || !description) {
    return null;
  }

  return { name, description };
};

export default class ExternalSkillsExtension implements Extension {
  static metadata = {
    name: 'External Skills',
    version: '1.0.0',
    description: 'Includes skill files from Cursor, Claude Code, and other external AI coding assistants',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/external-skills/icon.png',
    capabilities: ['context'],
  };

  private configPath: string;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('External Skills Extension loaded', 'info');
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<ExternalSkillsConfig> {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // Ignore errors, return defaults
    }
    return { skillFolders: '' };
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as Partial<ExternalSkillsConfig>;
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    return config;
  }

  getSkills(context: ExtensionContext): SkillDefinition[] {
    const projectDir = context.getProjectDir();
    if (!projectDir) {
      context.log('No project directory available', 'warn');
      return [];
    }

    const config = this.getConfigDataSync();
    const skillPaths = config.skillFolders
      ? config.skillFolders.split(',').map((f) => f.trim()).filter(Boolean)
      : [];

    const skills: SkillDefinition[] = [];

    for (const skillsPath of skillPaths) {
      const fullSkillsPath = join(projectDir, skillsPath);

      if (!existsSync(fullSkillsPath)) {
        continue;
      }

      try {
        const stat = statSync(fullSkillsPath);

        if (stat.isDirectory()) {
          const scannedSkills = this.scanSkillsDir(fullSkillsPath, projectDir, context);
          skills.push(...scannedSkills);
        } else if (stat.isFile() && (skillsPath.endsWith('.md') || skillsPath.endsWith('.mdc'))) {
          const scannedSkill = this.scanSkillFile(fullSkillsPath, context);
          if (scannedSkill) {
            skills.push(scannedSkill);
          }
        }
      } catch (error) {
        context.log(`Error scanning ${skillsPath}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    if (skills.length > 0) {
      context.log(`Discovered ${skills.length} external skill(s)`, 'info');
    }

    return skills;
  }

  private getConfigDataSync(): ExternalSkillsConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // Ignore errors, return defaults
    }
    return { skillFolders: '' };
  }

  private scanSkillsDir(fullPath: string, projectDir: string, context: ExtensionContext): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    let entries: string[];
    try {
      entries = readdirSync(fullPath);
    } catch {
      return skills;
    }

    for (const entry of entries) {
      const entryPath = join(fullPath, entry);
      let entryStat;
      try {
        entryStat = statSync(entryPath);
      } catch {
        continue;
      }

      if (!entryStat.isDirectory()) {
        continue;
      }

      const skillMdPath = join(entryPath, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        continue;
      }

      let markdown: string;
      try {
        markdown = readFileSync(skillMdPath, 'utf-8');
      } catch {
        continue;
      }

      const parsed = parseSkillFrontMatter(markdown);
      if (!parsed) {
        context.log(`Skipping ${relative(projectDir, entryPath)}: missing name or description in frontmatter`, 'warn');
        continue;
      }

      skills.push({
        name: parsed.name,
        description: parsed.description,
        dirPath: entryPath,
        location: 'project'
      });

      context.log(`Discovered skill '${parsed.name}' from ${relative(projectDir, entryPath)}`, 'info');
    }

    return skills;
  }

  private scanSkillFile(filePath: string, context: ExtensionContext): SkillDefinition | null {
    let markdown: string;
    try {
      markdown = readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }

    const parsed = parseSkillFrontMatter(markdown);
    if (!parsed) {
      context.log(`Skipping ${basename(filePath)}: missing name or description in frontmatter`, 'warn');
      return null;
    }

    context.log(`Discovered skill '${parsed.name}' from ${basename(filePath)}`, 'info');

    return {
      name: parsed.name,
      description: parsed.description,
      content: markdown,
      location: 'project'
    };
  }
}
