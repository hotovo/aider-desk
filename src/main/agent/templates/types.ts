import { AgentProfile } from '@common/types';

export interface RuleFile {
  name: string;
  content: string;
}

export interface ToolPermissions {
  aiderTools: boolean;
  powerTools: {
    semanticSearch: boolean;
    fileRead: boolean;
    fileWrite: boolean;
    fileEdit: boolean;
    glob: boolean;
    grep: boolean;
    bash: boolean;
    anyEnabled: boolean;
  };
  todoTools: boolean;
  subagents: boolean;
  autoApprove: boolean;
}

export interface SystemPromptData {
  projectDir: string;
  agentProfile: AgentProfile;
  additionalInstructions?: string;
  osName: string;
  currentDate: string;
  rulesFiles: RuleFile[];
  customInstructions: string;
  toolPermissions: ToolPermissions;
  toolConstants: {
    AIDER_TOOL_ADD_CONTEXT_FILES: string;
    AIDER_TOOL_DROP_CONTEXT_FILES: string;
    AIDER_TOOL_GET_CONTEXT_FILES: string;
    AIDER_TOOL_GROUP_NAME: string;
    AIDER_TOOL_RUN_PROMPT: string;
    POWER_TOOL_BASH: string;
    POWER_TOOL_FILE_EDIT: string;
    POWER_TOOL_FILE_READ: string;
    POWER_TOOL_FILE_WRITE: string;
    POWER_TOOL_GLOB: string;
    POWER_TOOL_GREP: string;
    POWER_TOOL_GROUP_NAME: string;
    POWER_TOOL_SEMANTIC_SEARCH: string;
    SUBAGENTS_TOOL_GROUP_NAME: string;
    SUBAGENTS_TOOL_RUN_TASK: string;
    TODO_TOOL_CLEAR_ITEMS: string;
    TODO_TOOL_GET_ITEMS: string;
    TODO_TOOL_GROUP_NAME: string;
    TODO_TOOL_SET_ITEMS: string;
    TODO_TOOL_UPDATE_ITEM_COMPLETION: string;
    TOOL_GROUP_NAME_SEPARATOR: string;
  };
}

export interface InitProjectPromptData {
  // No dynamic data needed for this prompt
  [key: string]: never;
}

export interface CompactConversationPromptData {
  customInstructions?: string;
}

export interface TemplateData {
  system: SystemPromptData;
  initProject: InitProjectPromptData;
  compactConversation: CompactConversationPromptData;
}

// Handlebars template delegate type
export type HandlebarsTemplateDelegate = unknown;
