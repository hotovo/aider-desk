import { ToolRecoveryMode } from './types';
import * as Tools from './tools';

const safeTools = [
  [Tools.TODO_TOOL_GROUP_NAME, Tools.TODO_TOOL_GET_ITEMS],
  [Tools.MEMORY_TOOL_GROUP_NAME, Tools.MEMORY_TOOL_RETRIEVE],
  [Tools.MEMORY_TOOL_GROUP_NAME, Tools.MEMORY_TOOL_LIST],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_LIST_TASKS],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_GET_TASK],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_GET_TASK_MESSAGE],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_SEARCH_TASK],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_SEARCH_PARENT_TASK],
  [Tools.HELPERS_TOOL_GROUP_NAME, Tools.HELPERS_TOOL_NO_SUCH_TOOL],
  [Tools.HELPERS_TOOL_GROUP_NAME, Tools.HELPERS_TOOL_INVALID_TOOL_ARGUMENTS],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_FILE_READ],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_GLOB],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_GREP],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_SEMANTIC_SEARCH],
  [Tools.AIDER_TOOL_GROUP_NAME, Tools.AIDER_TOOL_GET_CONTEXT_FILES],
  [Tools.SUBAGENTS_TOOL_GROUP_NAME, Tools.SUBAGENTS_TOOL_RUN_TASK],
  [Tools.TODO_TOOL_GROUP_NAME, Tools.TODO_TOOL_SET_ITEMS],
  [Tools.TODO_TOOL_GROUP_NAME, Tools.TODO_TOOL_UPDATE_ITEM_COMPLETION],
  [Tools.TODO_TOOL_GROUP_NAME, Tools.TODO_TOOL_CLEAR_ITEMS],
  [Tools.MEMORY_TOOL_GROUP_NAME, Tools.MEMORY_TOOL_UPDATE],
  [Tools.MEMORY_TOOL_GROUP_NAME, Tools.MEMORY_TOOL_DELETE],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_DELETE_TASK],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_FETCH],
  [Tools.AIDER_TOOL_GROUP_NAME, Tools.AIDER_TOOL_ADD_CONTEXT_FILES],
  [Tools.AIDER_TOOL_GROUP_NAME, Tools.AIDER_TOOL_DROP_CONTEXT_FILES],
];
const notifyTools = [
  [Tools.MEMORY_TOOL_GROUP_NAME, Tools.MEMORY_TOOL_STORE],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_CREATE_TASK],
  [Tools.TASKS_TOOL_GROUP_NAME, Tools.TASKS_TOOL_RUN_PROMPT],
  [Tools.SKILLS_TOOL_GROUP_NAME, Tools.SKILLS_TOOL_ACTIVATE_SKILL],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_FILE_WRITE],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_FILE_EDIT],
  [Tools.POWER_TOOL_GROUP_NAME, Tools.POWER_TOOL_BASH],
  [Tools.AIDER_TOOL_GROUP_NAME, Tools.AIDER_TOOL_RUN_PROMPT],
];

export const DEFAULT_TOOL_RECOVERY_MODES: Record<string, ToolRecoveryMode> = Object.fromEntries([
  ['programmatic_tool_calls', ToolRecoveryMode.Notify],
  ['extensions---programmatic_tool_calls', ToolRecoveryMode.Notify],
  ...safeTools.map(([group, name]) => [group + Tools.TOOL_GROUP_NAME_SEPARATOR + name, ToolRecoveryMode.Safe]),
  ...notifyTools.map(([group, name]) => [group + Tools.TOOL_GROUP_NAME_SEPARATOR + name, ToolRecoveryMode.Notify]),
]);

export enum ToolRecoveryCode {
  Interrupted = 'interrupted',
  FinalizationInterrupted = 'finalizationInterrupted',
  Unavailable = 'unavailable',
  ArgumentsChanged = 'argumentsChanged',
  OwnerChanged = 'ownerChanged',
  IdentityConflict = 'identityConflict',
}

const recoveryInstructions: Record<ToolRecoveryCode, string> = {
  [ToolRecoveryCode.Interrupted]:
    'Tool execution was interrupted. It may have produced side effects, but its final outcome is unknown. Verify the current state before repeating the operation.',
  [ToolRecoveryCode.FinalizationInterrupted]:
    'Tool execution completed, but result finalization was interrupted. Its publishable output is unavailable. Do not repeat this operation solely to recover its result.',
  [ToolRecoveryCode.Unavailable]: 'Interrupted tool is no longer available or permitted. Its final outcome is unknown.',
  [ToolRecoveryCode.ArgumentsChanged]:
    'Interrupted tool arguments were changed by a hook or no longer satisfy its schema. The operation was not replayed; verify its original outcome before retrying.',
  [ToolRecoveryCode.OwnerChanged]: 'Interrupted tool ownership has changed. The operation was not replayed; verify its original outcome before retrying.',
  [ToolRecoveryCode.IdentityConflict]: 'Tool call identity does not match its recorded operation. Execution was refused.',
};

export const createToolRecoveryNotice = (code: ToolRecoveryCode) => ({ aiderDeskRecovery: code, message: recoveryInstructions[code], error: true });

export const isToolRecoveryNotice = (value: unknown): value is ReturnType<typeof createToolRecoveryNotice> =>
  typeof value === 'object' &&
  value !== null &&
  'aiderDeskRecovery' in value &&
  Object.values(ToolRecoveryCode).includes(value.aiderDeskRecovery as ToolRecoveryCode);
