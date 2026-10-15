import { type AgentProfile, AutonomyMode, InvocationMode, ToolApprovalState } from '@common/types';
import { getSubagentId, isSubagentEnabled } from '@common/agent';
import {
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_STORE,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import type { ModelMessage, UserModelMessage } from 'ai';
import type { Task } from '@/task';
import type { ExtensionManager } from '@/extensions';

export const addImportantReminders = async (
  task: Task,
  profile: AgentProfile,
  projectProfiles: AgentProfile[],
  userRequestMessageIndex: number,
  messages: ModelMessage[],
  extensionManager?: ExtensionManager,
): Promise<ModelMessage[]> => {
  if (userRequestMessageIndex === -1) {
    return messages;
  }

  const userRequestMessage = messages[userRequestMessageIndex];
  if (!userRequestMessage || userRequestMessage.role !== 'user') {
    return messages;
  }
  const reminders: string[] = [];

  if (profile.useTodoTools) {
    reminders.push(
      `Always use the TODO list tools to manage the tasks, even if small ones. Before any analyze use ${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_GET_ITEMS} to check the current list of tasks and in case it's related to the current request, resume the existing tasks.`,
    );
  }

  // Add reminder about automatic subagents
  if (profile.useSubagents) {
    const enabledSubagents = projectProfiles.filter((agentProfile) => isSubagentEnabled(agentProfile, profile));
    const automaticSubagents = enabledSubagents.filter(
      (agentProfile) => agentProfile.subagent.invocationMode === InvocationMode.Automatic && agentProfile.subagent.description,
    );

    if (automaticSubagents.length > 0) {
      const subagents = automaticSubagents.map((subagent) => `    - ${getSubagentId(subagent)}: ${subagent.subagent.description}`).join('\n');
      reminders.push(`Use the following automatic subagents when appropriate based on their descriptions:\n${subagents}`);
    }
  }

  const shouldPresentPlan = task.task.autonomyMode !== AutonomyMode.Autonomous;
  if (shouldPresentPlan && !profile.isSubagent) {
    reminders.push('Before making any complex changes, present the plan and wait for my approval.');
  }

  // Add reminder about worktree mode
  if (task.getTaskDir() !== task.getProjectDir()) {
    reminders.push(`You are working in worktree mode inside ${task.getTaskDir()}. Modify files inside that directory when making changes.`);
  }

  if (profile.useMemoryTools) {
    const retrieveMemoryAllowed =
      profile.toolApprovals[`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_RETRIEVE}`] !== ToolApprovalState.Never;
    const storeMemoryAllowed = profile.toolApprovals[`${MEMORY_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${MEMORY_TOOL_STORE}`] !== ToolApprovalState.Never;
    if (retrieveMemoryAllowed) {
      reminders.push('Retrieve relevant memories at the beginning of a task to see if there is any relevant information.');
    }
    if (storeMemoryAllowed) {
      reminders.push(
        'Store important general outcomes, decisions, patterns, and user preferences in memory for future tasks after the task is completed. Do not store task-specific information that is not relevant to future tasks.',
      );
    }
  }

  let remindersContent = reminders.map((reminder) => `<Reminder>\n${reminder}\n</Reminder>`).join('\n ');
  // Dispatch event to extensions to allow modification of reminders
  if (extensionManager) {
    const extensionResult = await extensionManager.dispatchEvent(
      'onImportantReminders',
      {
        profile,
        agentProfile: profile,
        remindersContent,
      },
      task.project,
      task,
    );
    remindersContent = extensionResult.remindersContent ?? remindersContent;
  }

  if (!remindersContent.trim()) {
    return messages;
  }

  if (remindersContent.trim()) {
    remindersContent = `\n\n<ThisIsImportant>\n${remindersContent}\n</ThisIsImportant>`;
  }

  const updatedFirstUserMessage: UserModelMessage =
    typeof userRequestMessage.content === 'string'
      ? {
          ...userRequestMessage,
          content: `${userRequestMessage.content}${remindersContent}`,
        }
      : {
          ...userRequestMessage,
          content: [...userRequestMessage.content, { type: 'text' as const, text: remindersContent }],
        };

  const newMessages = [...messages];
  newMessages[userRequestMessageIndex] = updatedFirstUserMessage;

  return newMessages;
};
