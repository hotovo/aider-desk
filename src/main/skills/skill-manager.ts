import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import { loadFront } from 'yaml-front-matter';
import { SKILLS_TOOL_GROUP_NAME, SKILLS_TOOL_ACTIVATE_SKILL, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { ContextAssistantMessage, ContextMessage, ContextToolMessage, SkillDefinition as Skill, SkillLocation } from '@common/types';

import {
  SKILL_MARKDOWN_FILE,
  SKILLS_DIR_NAME,
  MAX_FILE_BYTES,
  validateSkillContentSize,
  validateSkillFilePath,
  validateSkillFrontmatter,
  validateSkillName,
  validateSkillNameMatch,
} from './skill-validation';

import type { Project } from '@/project';
import type { Task } from '@/task';
import type { SkillsContext, SkillWriteResult } from '@common/extensions';

import { AIDER_DESK_BUILTIN_SKILLS_DIR, AIDER_DESK_DIR, AIDER_DESK_HOME_DIR } from '@/constants';
import { ExtensionManager } from '@/extensions/extension-manager';
import logger from '@/logger';

const TOOL_NAME = `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`;

const parseSkillFrontMatter = (markdown: string): { name: string; description: string } | null => {
  const parsed = loadFront(markdown);
  const name = typeof parsed.name === 'string' ? parsed.name : undefined;
  const description = typeof parsed.description === 'string' ? parsed.description : undefined;

  if (!name || !description) {
    return null;
  }

  return { name, description };
};

const safeReadDir = async (dirPath: string): Promise<string[]> => {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
};

const safeStat = async (filePath: string): Promise<import('fs').Stats | null> => {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
};

const loadSkillsFromDir = async (skillsRootDir: string, location: SkillLocation): Promise<Skill[]> => {
  const entries = await safeReadDir(skillsRootDir);

  const skills: Skill[] = [];
  for (const entry of entries) {
    const dirPath = path.join(skillsRootDir, entry);
    const stat = await safeStat(dirPath);
    if (!stat?.isDirectory()) {
      continue;
    }

    const skillMdPath = path.join(dirPath, SKILL_MARKDOWN_FILE);
    const skillMdStat = await safeStat(skillMdPath);
    if (!skillMdStat?.isFile()) {
      continue;
    }

    let markdown: string;
    try {
      markdown = await fs.readFile(skillMdPath, 'utf8');
    } catch {
      continue;
    }

    const parsed = parseSkillFrontMatter(markdown);
    if (!parsed) {
      continue;
    }

    skills.push({
      name: parsed.name,
      description: parsed.description,
      location,
      dirPath,
    });
  }

  return skills;
};

export class SkillManager implements SkillsContext {
  private extensionManager: ExtensionManager | undefined;
  private projectDir: string;
  private onSkillsUpdated?: () => void;
  private collectingSkillIndex = false;

  constructor(projectDir: string, extensionManager?: ExtensionManager, onSkillsUpdated?: () => void) {
    this.projectDir = projectDir;
    this.extensionManager = extensionManager;
    this.onSkillsUpdated = onSkillsUpdated;
  }

  async loadAllSkills(): Promise<Skill[]> {
    const globalSkillsDir = path.join(AIDER_DESK_HOME_DIR, SKILLS_DIR_NAME);
    const projectSkillsDir = path.join(this.projectDir, AIDER_DESK_DIR, SKILLS_DIR_NAME);

    // The task stub exposes this manager so extensions calling context.getSkillContext()
    // bind to it; without it, createContext caches a manager whose broadcast callback is
    // tied to a fake project and cannot refresh the UI.
    const taskStub = { getTaskDir: () => this.projectDir, getSkillManager: () => this } as unknown as Task;

    // An extension hook may call listSkills()/findSkill() back on this manager (synchronously
    // or via a scheduled async call), which would recurse unboundedly through loadAllSkills.
    // The flag spans the whole load so re-entrant loads skip extension discovery instead.
    const wasCollecting = this.collectingSkillIndex;
    this.collectingSkillIndex = true;
    try {
      const extensionSkills: Skill[] =
        this.extensionManager && !wasCollecting ? this.extensionManager.getSkills({ baseDir: this.projectDir } as Project, taskStub) : [];

      const [globalSkills, projectSkills, builtinSkills] = await Promise.all([
        loadSkillsFromDir(globalSkillsDir, 'global'),
        loadSkillsFromDir(projectSkillsDir, 'project'),
        loadSkillsFromDir(AIDER_DESK_BUILTIN_SKILLS_DIR, 'builtin'),
      ]);

      const allSkills = [...extensionSkills, ...projectSkills, ...globalSkills, ...builtinSkills];

      const seen = new Set<string>();
      const deduped: Skill[] = [];
      for (const skill of allSkills) {
        if (!seen.has(skill.name)) {
          seen.add(skill.name);
          deduped.push(skill);
        }
      }

      return deduped;
    } finally {
      this.collectingSkillIndex = wasCollecting;
    }
  }

  async getSkills(contextMessages?: ContextMessage[]): Promise<Skill[]> {
    const skills = await this.loadAllSkills();
    const activatedSkillNames = contextMessages ? this.getActivatedSkillNames(contextMessages) : new Set<string>();

    return skills.map((skill) => ({
      ...skill,
      activated: activatedSkillNames.has(skill.name),
    }));
  }

  async listSkills(): Promise<Skill[]> {
    return this.loadAllSkills();
  }

  async getSkillContent(skillName: string): Promise<string | null> {
    const skills = await this.loadAllSkills();
    const skill = skills.find((s) => s.name === skillName);

    if (!skill) {
      return null;
    }

    if (skill.content) {
      return skill.content;
    }

    if (skill.dirPath) {
      const skillMdPath = path.join(skill.dirPath, SKILL_MARKDOWN_FILE);
      try {
        return await fs.readFile(skillMdPath, 'utf8');
      } catch {
        return null;
      }
    }

    return null;
  }

  resolveSkillDir(name: string, location: 'global' | 'project'): string {
    if (location === 'project') {
      return path.join(this.projectDir, AIDER_DESK_DIR, SKILLS_DIR_NAME, name);
    }
    return path.join(AIDER_DESK_HOME_DIR, SKILLS_DIR_NAME, name);
  }

  async findSkill(name: string): Promise<Skill | null> {
    // findSkill backs the write paths (updateSkill, writeSkillFile), so reject anything that
    // could escape the skills directories; createSkill enforces the same via validateSkillName
    if (!name || name === '.' || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return null;
    }

    // Project precedence matches loadAllSkills(), where project skills shadow global skills of the same name
    const projectSkillDir = path.join(this.projectDir, AIDER_DESK_DIR, SKILLS_DIR_NAME, name);
    if (existsSync(path.join(projectSkillDir, SKILL_MARKDOWN_FILE))) {
      return { name, description: '', location: 'project', dirPath: projectSkillDir };
    }

    const globalSkillDir = path.join(AIDER_DESK_HOME_DIR, SKILLS_DIR_NAME, name);
    if (existsSync(path.join(globalSkillDir, SKILL_MARKDOWN_FILE))) {
      return { name, description: '', location: 'global', dirPath: globalSkillDir };
    }

    return null;
  }

  async createSkill(name: string, content: string, location: 'global' | 'project' = 'global'): Promise<SkillWriteResult> {
    if (!content) {
      return { success: false, message: 'Content is required for create action.' };
    }

    const nameError = validateSkillName(name);
    if (nameError) {
      return { success: false, message: nameError };
    }

    const frontmatterError = validateSkillFrontmatter(content);
    if (frontmatterError) {
      return { success: false, message: frontmatterError };
    }

    const nameMatchError = validateSkillNameMatch(name, content);
    if (nameMatchError) {
      return { success: false, message: nameMatchError };
    }

    const sizeError = validateSkillContentSize(content);
    if (sizeError) {
      return { success: false, message: sizeError };
    }

    // Only the target location blocks creation; a project skill may shadow a global one
    // (loadAllSkills() gives project precedence when deduplicating).
    const skillDir = this.resolveSkillDir(name, location);
    // Atomicity: a recursive mkdir would silently succeed for concurrent creates of the same
    // name and let their writeFile calls clobber each other; a `recursive: false` mkdir fails
    // with EEXIST for whichever create loses the race.
    await fs.mkdir(path.dirname(skillDir), { recursive: true });
    try {
      await fs.mkdir(skillDir, { recursive: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return {
          success: false,
          message: `A skill named '${name}' already exists at ${skillDir}. Use updateSkill to modify it.`,
        };
      }
      throw error;
    }
    await fs.writeFile(path.join(skillDir, SKILL_MARKDOWN_FILE), content, 'utf8');

    this.notifySkillsUpdated();

    return {
      success: true,
      message: `Skill '${name}' created at ${location} location.`,
      path: skillDir,
    };
  }

  async updateSkill(name: string, content: string): Promise<SkillWriteResult> {
    if (!content) {
      return { success: false, message: 'Content is required for update action.' };
    }

    const frontmatterError = validateSkillFrontmatter(content);
    if (frontmatterError) {
      return { success: false, message: frontmatterError };
    }

    const nameMatchError = validateSkillNameMatch(name, content);
    if (nameMatchError) {
      return { success: false, message: nameMatchError };
    }

    const sizeError = validateSkillContentSize(content);
    if (sizeError) {
      return { success: false, message: sizeError };
    }

    const existing = await this.findSkill(name);
    if (!existing?.dirPath) {
      return { success: false, message: `Skill '${name}' not found. Use createSkill to create a new skill.` };
    }

    await fs.writeFile(path.join(existing.dirPath, SKILL_MARKDOWN_FILE), content, 'utf8');

    this.notifySkillsUpdated();

    return {
      success: true,
      message: `Skill '${name}' updated (full rewrite).`,
      path: existing.dirPath,
    };
  }

  async writeSkillFile(name: string, filePath: string, content: string): Promise<SkillWriteResult> {
    const pathError = validateSkillFilePath(filePath);
    if (pathError) {
      return { success: false, message: pathError };
    }

    const contentBytes = Buffer.byteLength(content, 'utf8');
    if (contentBytes > MAX_FILE_BYTES) {
      return {
        success: false,
        message: `File content is ${contentBytes.toLocaleString()} bytes (limit: ${MAX_FILE_BYTES.toLocaleString()} bytes). Consider splitting into smaller files.`,
      };
    }

    const sizeError = validateSkillContentSize(content, filePath);
    if (sizeError) {
      return { success: false, message: sizeError };
    }

    const existing = await this.findSkill(name);
    if (!existing?.dirPath) {
      return { success: false, message: `Skill '${name}' not found. Create it first with createSkill.` };
    }

    const targetPath = path.join(existing.dirPath, filePath.replace(/\\/g, '/'));
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');

    this.notifySkillsUpdated();

    return {
      success: true,
      message: `File '${filePath}' written to skill '${name}'.`,
      path: targetPath,
    };
  }

  private notifySkillsUpdated(): void {
    try {
      this.onSkillsUpdated?.();
    } catch (error) {
      logger.warn(`Failed to notify skills updated: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getActivatedSkillNames(contextMessages: ContextMessage[]): Set<string> {
    const activatedNames = new Set<string>();

    for (const message of contextMessages) {
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'tool-call' && part.toolName === TOOL_NAME && (part.input as Record<string, string>)?.skill) {
            activatedNames.add((part.input as Record<string, string>).skill);
          }
        }
      }
    }

    return activatedNames;
  }

  buildActivateSkillMessages(skillName: string, content: string): [ContextAssistantMessage, ContextToolMessage] {
    const toolCallId = uuidv4();

    const assistantMessage: ContextAssistantMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'User requested the skill activation.',
        },
        {
          type: 'tool-call',
          toolCallId,
          toolName: TOOL_NAME,
          input: { skill: skillName },
        },
      ],
    };

    const toolMessage: ContextToolMessage = {
      id: uuidv4(),
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId,
          toolName: TOOL_NAME,
          output: { type: 'text', value: content },
        },
      ],
    };

    return [assistantMessage, toolMessage];
  }
}
