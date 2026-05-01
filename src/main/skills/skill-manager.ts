import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { v4 as uuidv4 } from 'uuid';
import { loadFront } from 'yaml-front-matter';
import { SKILLS_TOOL_GROUP_NAME, SKILLS_TOOL_ACTIVATE_SKILL, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { ContextAssistantMessage, ContextMessage, ContextToolMessage, SkillDefinition as Skill, SkillLocation } from '@common/types';

import type { Project } from '@/project';
import type { Task } from '@/task';

import { AIDER_DESK_BUILTIN_SKILLS_DIR, AIDER_DESK_DIR } from '@/constants';
import { ExtensionManager } from '@/extensions/extension-manager';

const SKILLS_DIR_NAME = 'skills';
const SKILL_MARKDOWN_FILE = 'SKILL.md';

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

export class SkillManager {
  private extensionManager: ExtensionManager | undefined;
  private projectDir: string;

  constructor(projectDir: string, extensionManager?: ExtensionManager) {
    this.projectDir = projectDir;
    this.extensionManager = extensionManager;
  }

  async loadAllSkills(): Promise<Skill[]> {
    const globalSkillsDir = path.join(homedir(), AIDER_DESK_DIR, SKILLS_DIR_NAME);
    const projectSkillsDir = path.join(this.projectDir, AIDER_DESK_DIR, SKILLS_DIR_NAME);

    const extensionSkills: Skill[] = this.extensionManager
      ? this.extensionManager.getSkills({ baseDir: this.projectDir } as Project, { getTaskDir: () => this.projectDir } as Task)
      : [];

    const [globalSkills, projectSkills, builtinSkills] = await Promise.all([
      loadSkillsFromDir(globalSkillsDir, 'global'),
      loadSkillsFromDir(projectSkillsDir, 'project'),
      loadSkillsFromDir(AIDER_DESK_BUILTIN_SKILLS_DIR, 'builtin'),
    ]);

    return [...projectSkills, ...globalSkills, ...builtinSkills, ...extensionSkills];
  }

  async getSkills(contextMessages?: ContextMessage[]): Promise<Skill[]> {
    const skills = await this.loadAllSkills();
    const activatedSkillNames = contextMessages ? this.getActivatedSkillNames(contextMessages) : new Set<string>();

    return skills.map((skill) => ({
      ...skill,
      activated: activatedSkillNames.has(skill.name),
    }));
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
