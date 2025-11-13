import path from 'path';
import fs from 'fs';

import { AgentProfile, ToolApprovalState } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import { TemplateCompiler } from './templates/compiler';
import { SystemPromptData, InitProjectPromptData, CompactConversationPromptData, RuleFile, ToolPermissions } from './templates/types';

import { AIDER_DESK_PROJECT_RULES_DIR } from '@/constants';
import { Task } from '@/task';

// Initialize template compiler
const templateCompiler = new TemplateCompiler();

/**
 * Initialize templates (call during application startup)
 */
export const initializeTemplates = async (): Promise<void> => {
  await templateCompiler.compileAll();
};

/**
 * Calculate tool permissions based on agent profile
 */
const calculateToolPermissions = (agentProfile: AgentProfile, autoApprove?: boolean): ToolPermissions => {
  // Check individual power tool permissions
  const semanticSearchAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_SEMANTIC_SEARCH}`] !== ToolApprovalState.Never;
  const fileReadAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`] !== ToolApprovalState.Never;
  const fileWriteAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_WRITE}`] !== ToolApprovalState.Never;
  const fileEditAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_EDIT}`] !== ToolApprovalState.Never;
  const globAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GLOB}`] !== ToolApprovalState.Never;
  const grepAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`] !== ToolApprovalState.Never;
  const bashAllowed =
    agentProfile.usePowerTools &&
    agentProfile.toolApprovals[`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`] !== ToolApprovalState.Never;

  // Check if any power tools are allowed
  const anyPowerToolsAllowed = semanticSearchAllowed || fileReadAllowed || fileWriteAllowed || fileEditAllowed || globAllowed || grepAllowed || bashAllowed;

  return {
    aiderTools: agentProfile.useAiderTools,
    powerTools: {
      semanticSearch: semanticSearchAllowed,
      fileRead: fileReadAllowed,
      fileWrite: fileWriteAllowed,
      fileEdit: fileEditAllowed,
      glob: globAllowed,
      grep: grepAllowed,
      bash: bashAllowed,
      anyEnabled: anyPowerToolsAllowed,
    },
    todoTools: agentProfile.useTodoTools,
    subagents: agentProfile.useSubagents,
    autoApprove: autoApprove ?? false,
  };
};

export const getSystemPrompt = async (task: Task, agentProfile: AgentProfile, autoApprove = task.task.autoApprove, additionalInstructions?: string) => {
  const rulesFiles = getRulesFiles(task.getProjectDir());
  const customInstructions = [agentProfile.customInstructions, additionalInstructions].filter(Boolean).join('\n\n').trim();
  const toolPermissions = calculateToolPermissions(agentProfile, autoApprove);
  const osName = (await import('os-name')).default();
  const currentDate = new Date().toDateString();

  const templateData: SystemPromptData = {
    projectDir: task.getProjectDir(),
    agentProfile,
    additionalInstructions,
    osName,
    currentDate,
    rulesFiles,
    customInstructions,
    toolPermissions,
    toolConstants: {
      AIDER_TOOL_ADD_CONTEXT_FILES,
      AIDER_TOOL_DROP_CONTEXT_FILES,
      AIDER_TOOL_GET_CONTEXT_FILES,
      AIDER_TOOL_GROUP_NAME,
      AIDER_TOOL_RUN_PROMPT,
      POWER_TOOL_BASH,
      POWER_TOOL_FILE_EDIT,
      POWER_TOOL_FILE_READ,
      POWER_TOOL_FILE_WRITE,
      POWER_TOOL_GLOB,
      POWER_TOOL_GREP,
      POWER_TOOL_GROUP_NAME,
      POWER_TOOL_SEMANTIC_SEARCH,
      SUBAGENTS_TOOL_GROUP_NAME,
      SUBAGENTS_TOOL_RUN_TASK,
      TODO_TOOL_CLEAR_ITEMS,
      TODO_TOOL_GET_ITEMS,
      TODO_TOOL_GROUP_NAME,
      TODO_TOOL_SET_ITEMS,
      TODO_TOOL_UPDATE_ITEM_COMPLETION,
      TOOL_GROUP_NAME_SEPARATOR,
    },
  };

  return templateCompiler.render('system/main', templateData);
};

const getRulesFiles = (projectDir: string): RuleFile[] => {
  const ruleFilesDir = path.join(projectDir, AIDER_DESK_PROJECT_RULES_DIR);
  const ruleFiles = fs.existsSync(ruleFilesDir) ? fs.readdirSync(ruleFilesDir) : [];
  const agentsFilePath = path.join(projectDir, 'AGENTS.md');

  const ruleFileObjects: RuleFile[] = ruleFiles.map((file) => {
    const filePath = path.join(ruleFilesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    return { name: file, content };
  });

  if (fs.existsSync(agentsFilePath)) {
    ruleFileObjects.push({
      name: 'AGENTS.md',
      content: fs.readFileSync(agentsFilePath, 'utf8'),
    });
  }

  return ruleFileObjects;
};

export const getInitProjectPrompt = async (_task: Task, _agentProfile: AgentProfile): Promise<string> => {
  const templateData: InitProjectPromptData = {};

  return templateCompiler.render('init/project-analysis', templateData);
};

export const getCompactConversationPrompt = async (_task: Task, agentProfile: AgentProfile): Promise<string> => {
  const customInstructions = [agentProfile.customInstructions].filter(Boolean).join('\n\n').trim();
  const templateData: CompactConversationPromptData = {
    customInstructions,
  };

  return templateCompiler.render('compact/conversation', templateData);
};

/**
 * Get template compiler instance (for testing and advanced usage)
 */
export const getTemplateCompiler = (): TemplateCompiler => {
  return templateCompiler;
};

export const getGenerateCommitMessagePrompt = () => {
  return `You are a helpful assistant that generates concise, conventional commit messages.

Guidelines:
- Use present tense ("add" not "added")
- Keep the first line under 50 characters
- Use imperative mood ("fix" not "fixes")
- Focus on what changed, not why
- Include scope if relevant (feat: add user login)
- For multiple changes, summarize the main purpose

Generate a single, clear commit message based on the provided commit history.`;
};
