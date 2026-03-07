import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { tool, type ToolSet } from 'ai';
import { loadFront } from 'yaml-front-matter';
import { z } from 'zod';
import { SKILLS_TOOL_ACTIVATE_SKILL, SKILLS_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { AgentProfile, PromptContext, ToolApprovalState } from '@common/types';

import { ApprovalManager } from './approval-manager';

import { AIDER_DESK_DIR } from '@/constants';
import { Task } from '@/task';

type SkillLocation = 'global' | 'project';

type Skill = {
  name: string;
  description: string;
  location: SkillLocation;
  dirPath: string;
};

const SKILLS_DIR_NAME = 'skills';
const SKILL_MARKDOWN_FILE = 'SKILL.md';

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

const getActivateSkillDescription = (skills: Skill[]): string => {
  const instructions =
    'Execute a skill within the main conversation\n\n<skills_instructions>\nWhen users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.\n\nHow to invoke:\n- Use this tool with the skill name only (no arguments)\n- Example: {"skill": "pdf"}\n\nImportant:\n- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action\n- NEVER just announce or mention a skill in your text response without actually calling this tool\n- Only use skills listed in <available_skills> below\n- Do not invoke a skill that is already running\n</skills_instructions>';

  const availableSkills = skills
    .map((skill) => {
      return `<skill>\n<name>\n${skill.name}\n</name>\n<description>\n${skill.description}\n</description>\n<location>\n${skill.location}\n</location>\n</skill>`;
    })
    .join('\n');

  return `${instructions}\n\n<available_skills>\n${availableSkills}\n</available_skills>`;
};

export const createSkillsToolset = async (task: Task, profile: AgentProfile, promptContext?: PromptContext): Promise<ToolSet> => {
  const approvalManager = new ApprovalManager(task, profile);

  const generateActivateSkillDescription = async (): Promise<string> => {
    const globalSkillsDir = path.join(homedir(), AIDER_DESK_DIR, SKILLS_DIR_NAME);
    const projectSkillsDir = path.join(task.getProjectDir(), AIDER_DESK_DIR, SKILLS_DIR_NAME);

    const [globalSkills, projectSkills] = await Promise.all([loadSkillsFromDir(globalSkillsDir, 'global'), loadSkillsFromDir(projectSkillsDir, 'project')]);

    return getActivateSkillDescription([...projectSkills, ...globalSkills]);
  };

  const activateSkillTool = tool({
    description: await generateActivateSkillDescription(),
    inputSchema: z.object({
      skill: z.string().describe('The skill name to activate. Use the skill name only (no additional arguments).'),
    }),
    execute: async (input, { toolCallId }) => {
      const { skill } = input;
      task.addToolMessage(toolCallId, SKILLS_TOOL_GROUP_NAME, SKILLS_TOOL_ACTIVATE_SKILL, { skill }, undefined, undefined, promptContext);

      const toolName = `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`;
      const toolId = toolName;
      const questionText = 'Approve activating a skill?';
      const questionSubject = `Skill: ${skill}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, toolId, questionText, questionSubject);
      if (!isApproved) {
        return `Activating skill denied by user. Reason: ${userInput}`;
      }

      const globalSkillsDir = path.join(homedir(), AIDER_DESK_DIR, SKILLS_DIR_NAME);
      const projectSkillsDir = path.join(task.getProjectDir(), AIDER_DESK_DIR, SKILLS_DIR_NAME);

      const [globalSkills, projectSkills] = await Promise.all([loadSkillsFromDir(globalSkillsDir, 'global'), loadSkillsFromDir(projectSkillsDir, 'project')]);

      const allSkills = [...projectSkills, ...globalSkills];

      const requested = allSkills.find((s) => s.name === skill);
      if (!requested) {
        const available = allSkills.map((s) => s.name).join(', ');
        return `Skill '${skill}' not found. Available skills: ${available || '(none)'}.`;
      }

      const skillMdPath = path.join(requested.dirPath, SKILL_MARKDOWN_FILE);

      let content: string;
      try {
        content = await fs.readFile(skillMdPath, 'utf8');
      } catch {
        return `Failed to read skill content from ${skillMdPath}.`;
      }

      return `${content}\n\nSkill '${requested.name}' activated.\nSkill directory is ${requested.dirPath} - use it as parent directory for relative paths mentioned in the skill description.`;
    },
  });

  const allTools: ToolSet = {
    [`${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`]: activateSkillTool,
  };

  const filteredTools: ToolSet = {};
  for (const [toolId, toolInstance] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = toolInstance;
    }
  }

  return filteredTools;
};
