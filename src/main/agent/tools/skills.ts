import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { SKILLS_TOOL_ACTIVATE_SKILL, SKILLS_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { AgentProfile, PromptContext, SkillDefinition as Skill, ToolApprovalState } from '@common/types';

import { ApprovalManager } from './approval-manager';

import { Task } from '@/task';

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
  const skillManager = task.getSkillManager();

  const generateActivateSkillDescription = async (): Promise<string> => {
    const skills = await skillManager.loadAllSkills();
    return getActivateSkillDescription(skills);
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

      const allSkills = await skillManager.loadAllSkills();

      const requested = allSkills.find((s) => s.name === skill);
      if (!requested) {
        const available = allSkills.map((s) => s.name).join(', ');
        return `Skill '${skill}' not found. Available skills: ${available || '(none)'}.`;
      }

      const content = await skillManager.getSkillContent(skill);
      if (!content) {
        return `Skill '${requested.name}' has no content or dirPath.`;
      }

      const dirInfo = requested.dirPath
        ? `\nSkill directory is ${requested.dirPath} - use it as parent directory for relative paths mentioned in the skill description.`
        : '';

      return `${content}\n\nSkill '${requested.name}' activated.${dirInfo}`;
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
