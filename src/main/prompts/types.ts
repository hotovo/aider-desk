import { ContextFile } from '@common/types';

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
  memory: {
    enabled: boolean;
    retrieveAllowed: boolean;
    storeAllowed: boolean;
    listAllowed: boolean;
    deleteAllowed: boolean;
  };
  skills: {
    allowed: boolean;
  };
  autoApprove: boolean;
}

export interface PromptTemplateData {
  projectDir: string;
  taskDir: string;
  additionalInstructions?: string;
  osName: string;
  currentDate: string;
  rulesFiles: string;
  customInstructions: string;
  toolPermissions: ToolPermissions;
  toolConstants: Record<string, string>;
  workflow: string;
  projectGitRootDirectory?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InitProjectPromptData {
  // Static for now
}

export interface CompactConversationPromptData {
  customInstructions?: string;
}

export interface HandoffPromptData {
  focus?: string;
  contextFiles?: ContextFile[];
}

export interface CodeInlineRequestPromptData {
  filename: string;
  lineNumber: number;
  fileExtension: string;
  contextLines: { lineNumber: number; content: string }[];
  userComment: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CommitMessagePromptData {
  // Static for now
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TaskNamePromptData {
  // Static for now
}

export interface ConflictResolutionSystemPromptData {
  POWER_TOOL_GROUP_NAME: string;
  TOOL_GROUP_NAME_SEPARATOR: string;
  POWER_TOOL_FILE_EDIT: string;
}

export interface ConflictResolutionPromptData {
  filePath: string;
  basePath?: string;
  oursPath?: string;
  theirsPath?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdateTaskStateData {
  // Static for now
}

export type PromptTemplateName =
  | 'system-prompt'
  | 'init-project'
  | 'workflow'
  | 'compact-conversation'
  | 'commit-message'
  | 'task-name'
  | 'conflict-resolution'
  | 'conflict-resolution-system'
  | 'update-task-state'
  | 'handoff'
  | 'code-inline-request';
