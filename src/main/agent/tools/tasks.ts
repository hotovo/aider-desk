import path from 'path';

import { type Tool, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  TASKS_TOOL_CREATE_TASK,
  TASKS_TOOL_DELETE_TASK,
  TASKS_TOOL_DESCRIPTIONS,
  TASKS_TOOL_GET_TASK,
  TASKS_TOOL_GET_TASK_MESSAGE,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_LIST_TASKS,
  TASKS_TOOL_SEARCH_PARENT_TASK,
  TASKS_TOOL_SEARCH_TASK,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
import { AgentProfile, PromptContext, SettingsData, TaskData, ToolApprovalState } from '@common/types';
import { search } from '@probelabs/probe';
import { fileExists } from '@common/utils';

import { ApprovalManager } from './approval-manager';

import { AIDER_DESK_TASKS_DIR, PROBE_BINARY_PATH } from '@/constants';
import logger from '@/logger';
import { isAbortError } from '@/utils/errors';
import { Task } from '@/task';

export const createTasksToolset = (settings: SettingsData, task: Task, profile: AgentProfile, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const listTasksTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_LIST_TASKS],
    inputSchema: z.object({
      offset: z.number().optional().describe('The number of tasks to skip (for pagination)'),
      limit: z.number().optional().describe('The maximum number of tasks to return'),
      state: z.string().optional().describe('Filter tasks by state (e.g., TODO, IN_PROGRESS, DONE)'),
    }),
    execute: async (input, { toolCallId }) => {
      const { offset = 0, limit, state } = input;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_LIST_TASKS, { offset, limit, state }, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`;
      const questionKey = toolName;
      const questionText = 'Approve listing tasks?';
      const questionSubject = `Offset: ${offset}, Limit: ${limit}, State: ${state || 'all'}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Listing tasks denied by user. Reason: ${userInput}`;
      }

      try {
        let allTasks = await task.getProject().getTasks();

        // Filter by state if provided
        if (state) {
          allTasks = allTasks.filter((t) => t.state === state);
        }

        // Apply pagination
        const startIndex = Math.max(0, offset);
        const endIndex = startIndex + Math.max(0, limit || allTasks.length);
        const paginatedTasks = allTasks.slice(startIndex, endIndex);

        return paginatedTasks.map((t) => {
          // Count subtasks for this task
          const subtaskIds = allTasks.filter((subtask) => subtask.parentId === t.id).map((s) => s.id);

          return {
            id: t.id,
            name: t.name,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            archived: t.archived,
            state: t.state,
            ...(t.parentId && { parentId: t.parentId }),
            ...(subtaskIds.length > 0 && { subtaskIds }),
          };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error listing tasks: ${errorMessage}`;
      }
    },
  });

  const getTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task to get information for'),
    }),
    execute: async (input, { toolCallId }) => {
      const { taskId } = input;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_GET_TASK, { taskId }, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK}`;
      const questionKey = toolName;
      const questionText = `Approve getting information for task ${taskId}?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Getting task information denied by user. Reason: ${userInput}`;
      }

      try {
        const targetTask = task.getProject().getTask(taskId);

        if (!targetTask) {
          return `Task with ID ${taskId} not found`;
        }

        const contextMessages = await targetTask.getContextMessages();
        const contextFiles = await targetTask.getContextFiles();

        // Find subtasks of this task
        const allTasks = await task.getProject().getTasks();
        const subtaskIds = allTasks.filter((t) => t.parentId === taskId).map((t) => t.id);

        return {
          id: targetTask.task.id,
          parentId: targetTask.task.parentId,
          name: targetTask.task.name,
          createdAt: targetTask.task.createdAt,
          updatedAt: targetTask.task.updatedAt,
          contextFiles: contextFiles.map((f) => ({
            path: f.path,
            readOnly: f.readOnly,
          })),
          contextMessagesCount: contextMessages.length,
          agentProfileId: targetTask.task.agentProfileId,
          provider: targetTask.task.provider,
          model: targetTask.task.model,
          mode: targetTask.task.currentMode,
          archived: targetTask.task.archived,
          state: targetTask.task.state,
          ...(subtaskIds.length > 0 && { subtaskIds }),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error getting task: ${errorMessage}`;
      }
    },
  });

  const getTaskMessageTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_GET_TASK_MESSAGE],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task'),
      messageIndex: z
        .number()
        .describe(
          'The index of the message to retrieve (0-based). Use negative numbers to count from the end: -1 for last message, -2 for second to last, etc.',
        ),
    }),
    execute: async (input, { toolCallId }) => {
      const { taskId, messageIndex } = input;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_GET_TASK_MESSAGE, { taskId, messageIndex }, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK_MESSAGE}`;
      const questionKey = toolName;
      const questionText = `Approve retrieving message ${messageIndex} from task ${taskId}?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Retrieving task message denied by user. Reason: ${userInput}`;
      }

      try {
        const targetTask = task.getProject().getTask(taskId);

        if (!targetTask) {
          return `Task with ID ${taskId} not found`;
        }

        const contextMessages = await targetTask.getContextMessages();

        // Handle negative indexing
        let actualIndex = messageIndex;
        if (messageIndex < 0) {
          actualIndex = contextMessages.length + messageIndex; // e.g., -1 becomes length-1
        }

        if (actualIndex < 0 || actualIndex >= contextMessages.length) {
          return `Message index ${messageIndex} out of range. Task has ${contextMessages.length} messages (0-${contextMessages.length - 1}, or -1 to -${contextMessages.length})`;
        }

        const message = contextMessages[actualIndex];

        return {
          index: actualIndex,
          originalIndex: messageIndex,
          role: message.role,
          content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          usageReport: message.usageReport,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error getting task message: ${errorMessage}`;
      }
    },
  });

  // Determine if parentTaskId should be available (only for top-level tasks)
  const isSubtask = task.task.parentId !== null;

  const autoGenerateTaskName = settings.taskSettings.autoGenerateTaskName;
  const nameProperty = autoGenerateTaskName
    ? z.string().optional().describe('Optional concise name for the new task. If not provided, the task name will be auto-generated from the prompt.')
    : z.string().describe('Concise name for the new task.');
  const CreateTaskInputSchema = z.object({
    prompt: z.string().describe('The initial prompt for the new task'),
    name: nameProperty,
    agentProfileId: z.string().optional().describe('Optional agent profile ID to use for the task. Use only when explicitly requested by the user.'),
    modelId: z.string().optional().describe('Optional model ID to use for the task. Use only when explicitly requested by the user.'),
    execute: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, the task will be created and executed with the initial prompt. If false, only the task is created without executing.'),
    executeInBackground: z
      .boolean()
      .optional()
      .default(false)
      .describe('If true, the task will be created and executed in the background. Only applicable if execute is true.'),
  });

  const CreateTaskWithParentInputSchema = CreateTaskInputSchema.extend({
    parentTaskId: z
      .string()
      .nullable()
      .optional()
      .describe(
        `Optional ID of the parent task. If provided, the new task will be created as a subtask of the specified parent. Use the current task's ID (${task.taskId}) to create a subtask of the current task. If not provided or null, creates a top-level task.`,
      ),
  });

  const createTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_CREATE_TASK],
    inputSchema: isSubtask ? CreateTaskInputSchema : CreateTaskWithParentInputSchema,
    execute: async (input, { toolCallId }) => {
      const { prompt, name, agentProfileId, modelId, execute: shouldExecute, executeInBackground } = input;
      const parentTaskId: string | null | undefined = 'parentTaskId' in input ? (input.parentTaskId as string | null) : undefined;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_CREATE_TASK, input, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_CREATE_TASK}`;
      const questionKey = toolName;
      const questionText = 'Approve creating a new task?';
      const questionSubject = `Prompt: ${prompt}\nAgent Profile: ${agentProfileId || 'default'}\nModel: ${modelId || 'default'}\nExecute: ${shouldExecute}${
        parentTaskId !== undefined ? `\nParent Task ID: ${parentTaskId || 'none (top-level task)'}` : ''
      }`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Creating task denied by user. Reason: ${userInput}`;
      }

      try {
        const newTask = await task.getProject().createNewTask({
          parentId: parentTaskId || null,
          name: name || '',
        });
        const updates: Partial<TaskData> = {};

        if (agentProfileId) {
          updates.agentProfileId = agentProfileId;
        }

        if (modelId) {
          // Parse modelId to extract provider and model
          const [provider, ...modelParts] = modelId.split('/');
          updates.provider = provider;
          updates.model = modelParts.join('/');
          updates.mainModel = modelId;
        }

        // createNewTask returns TaskData, not Task instance
        // We need to get the actual Task instance to call methods on it
        const taskInstance = task.getProject().getTask(newTask.id);
        if (!taskInstance) {
          throw new Error(`Failed to get task instance for newly created task ${newTask.id}`);
        }

        await taskInstance.init();
        await taskInstance.saveTask(updates);

        if (shouldExecute) {
          const run = taskInstance.runPrompt(prompt, 'agent', false);
          if (!executeInBackground) {
            await run;
          }
        } else {
          await taskInstance.savePromptOnly(prompt, false);
        }

        const contextMessages = await taskInstance.getContextMessages();

        return {
          id: newTask.id,
          name: newTask.name,
          result: shouldExecute ? 'Task created and executed successfully' : 'Task created successfully',
          ...(shouldExecute &&
            contextMessages.length > 0 && {
              lastMessage: contextMessages[contextMessages.length - 1],
            }),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error creating task: ${errorMessage}`;
      }
    },
  });

  const deleteTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_DELETE_TASK],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task to delete'),
    }),
    execute: async (input, { toolCallId }) => {
      const { taskId } = input;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_DELETE_TASK, { taskId }, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_DELETE_TASK}`;
      const questionKey = toolName;
      const questionText = `Approve deleting task ${taskId}? This action cannot be undone.`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Deleting task denied by user. Reason: ${userInput}`;
      }

      try {
        // Prevent deleting the current task
        if (taskId === task.taskId) {
          return 'Cannot delete the current task';
        }

        await task.getProject().deleteTask(taskId);
        return `Task ${taskId} deleted successfully`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error deleting task: ${errorMessage}`;
      }
    },
  });

  const searchTaskTool = tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_SEARCH_TASK],
    inputSchema: z.object({
      taskId: z.string().describe('The ID of the task to search within'),
      query: z.string().describe('Search query with Elasticsearch syntax. Use + for important terms.'),
      maxTokens: z.number().optional().default(10000).describe('Maximum number of tokens to return in the search results. Default: 10000'),
    }),
    execute: async (input, { toolCallId }) => {
      const { taskId, query, maxTokens } = input;
      task.addToolMessage(toolCallId, TASKS_TOOL_GROUP_NAME, TASKS_TOOL_SEARCH_TASK, { taskId, query, maxTokens }, undefined, undefined, promptContext);

      const toolName = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const questionKey = toolName;
      const questionText = `Approve searching in task ${taskId}?`;
      const questionSubject = `Query: ${query}\nTask ID: ${taskId}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Task search denied by user. Reason: ${userInput}`;
      }

      try {
        const targetTask = task.getProject().getTask(taskId);

        if (!targetTask) {
          return `Task with ID ${taskId} not found`;
        }

        const contextFilePath = path.join(targetTask.project.baseDir, AIDER_DESK_TASKS_DIR, taskId, 'context.json');

        const exists = await fileExists(contextFilePath);
        if (!exists) {
          return `Task context file not found at ${contextFilePath}`;
        }

        logger.debug(`Searching in task context file: ${contextFilePath}`, {
          query,
          maxTokens,
        });

        const effectiveMaxTokens = maxTokens || 10000;

        // @ts-expect-error probe is not typed properly
        const results = await search({
          query,
          path: contextFilePath,
          json: false,
          maxTokens: effectiveMaxTokens,
          binaryOptions: {
            path: PROBE_BINARY_PATH,
          },
        });

        logger.debug(`Task search results: ${JSON.stringify(results)}`);

        return results;
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error executing task search command:', error);
        task.addLogMessage(
          'error',
          `Task search failed with error:\n\n${errorMessage}\n\nPlease, consider reporting an issue at https://github.com/hotovo/aider-desk/issues. Thank you.`,
        );
        return errorMessage;
      }
    },
  });

  const allTools = {
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`]: listTasksTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK}`]: getTaskTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_GET_TASK_MESSAGE}`]: getTaskMessageTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_CREATE_TASK}`]: createTaskTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_DELETE_TASK}`]: deleteTaskTool,
    [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`]: searchTaskTool,
  };

  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};

/**
 * Creates the search parent task tool for subtasks.
 * This tool is not included in the default toolset and should be added
 * directly in agent.ts's getAvailableTools method when task is a subtask.
 */
export const createSearchParentTaskTool = (task: Task, promptContext?: PromptContext): Tool => {
  return tool({
    description: TASKS_TOOL_DESCRIPTIONS[TASKS_TOOL_SEARCH_PARENT_TASK],
    inputSchema: z.object({
      query: z.string().describe('Search query with Elasticsearch syntax. Use + for important terms.'),
      maxTokens: z.number().optional().default(10000).describe('Maximum number of tokens to return in the search results. Default: 10000'),
    }),
    execute: async ({ query, maxTokens }, { toolCallId }) => {
      // Always use parent task ID
      const parentTaskId = task.task.parentId;

      if (!parentTaskId) {
        return 'This tool is only available for subtasks. Current task has no parent.';
      }

      const effectiveMaxTokens = maxTokens || 10000;

      task.addToolMessage(
        toolCallId,
        TASKS_TOOL_GROUP_NAME,
        TASKS_TOOL_SEARCH_PARENT_TASK,
        { query, maxTokens: effectiveMaxTokens, parentTaskId },
        undefined,
        undefined,
        promptContext,
      );

      // No approval required for parent task search

      try {
        const parentTask = task.getProject().getTask(parentTaskId);

        if (!parentTask) {
          return `Parent task with ID ${parentTaskId} not found`;
        }

        const contextFilePath = path.join(parentTask.project.baseDir, AIDER_DESK_TASKS_DIR, parentTaskId, 'context.json');

        const exists = await fileExists(contextFilePath);
        if (!exists) {
          return `Parent task context file not found at ${contextFilePath}`;
        }

        logger.debug(`Searching in parent task context file: ${contextFilePath}`, { query, maxTokens: effectiveMaxTokens, parentTaskId });

        // @ts-expect-error probe is not typed properly
        const results = await search({
          query,
          path: contextFilePath,
          json: false,
          maxTokens: effectiveMaxTokens,
          binaryOptions: {
            path: PROBE_BINARY_PATH,
          },
        });

        logger.debug(`Parent task search results: ${JSON.stringify(results)}`);

        return results;
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error executing parent task search command:', error);
        task.addLogMessage(
          'error',
          `Parent task search failed with error:\n\n${errorMessage}\n\nPlease, consider reporting an issue at https://github.com/hotovo/aider-desk/issues. Thank you.`,
        );
        return errorMessage;
      }
    },
  });
};
