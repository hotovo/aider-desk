import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import {
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_DESCRIPTIONS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
import { AgentProfile, PromptContext, ToolApprovalState } from '@common/types';

import { ApprovalManager } from './approval-manager';

import { Task } from '@/task';

export const createTodoToolset = (task: Task, profile: AgentProfile, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const setTodoItemsTool = tool({
    description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_SET_ITEMS],
    inputSchema: z.object({
      items: z
        .array(
          z.object({
            name: z.string().describe('The name of the todo item.'),
            completed: z.boolean().optional().default(false).describe('Whether the todo item is completed.'),
          }),
        )
        .describe('An array of todo items.'),
      initialUserPrompt: z.string().describe('The original user prompt that initiated the task.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { items, initialUserPrompt } = input;
      task.addToolMessage(toolCallId, TODO_TOOL_GROUP_NAME, TODO_TOOL_SET_ITEMS, input, undefined, undefined, promptContext);

      const toolName = `${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_SET_ITEMS}`;
      const questionKey = toolName;
      const questionText = 'Approve setting todo items? This will overwrite any existing todo list.';
      const questionSubject = `Initial User Prompt: ${initialUserPrompt}
Items: ${JSON.stringify(items)}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Setting todo items denied by user. Reason: ${userInput}`;
      }

      try {
        await task.setTodos(items, initialUserPrompt);
        return 'Todo items set successfully.';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error setting todo items: ${errorMessage}`;
      }
    },
  });

  const getTodoItemsTool = tool({
    description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_GET_ITEMS],
    inputSchema: z.object({}),
    execute: async (input, { toolCallId }) => {
      task.addToolMessage(toolCallId, TODO_TOOL_GROUP_NAME, TODO_TOOL_GET_ITEMS, {}, undefined, undefined, promptContext);

      const toolName = `${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_GET_ITEMS}`;
      const questionKey = toolName;
      const questionText = 'Approve getting todo items?';

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Getting todo items denied by user. Reason: ${userInput}`;
      }

      try {
        const data = await task.readTodoFile();
        if (!data) {
          return 'No todo items found.';
        }
        return { initialUserPrompt: data.initialUserPrompt, items: data.items };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error getting todo items: ${errorMessage}`;
      }
    },
  });

  const updateTodoItemCompletionTool = tool({
    description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_UPDATE_ITEM_COMPLETION],
    inputSchema: z.object({
      name: z.string().describe('The name of the todo item to update.'),
      completed: z.boolean().describe('The new completion status for the todo item.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { name, completed } = input;
      task.addToolMessage(toolCallId, TODO_TOOL_GROUP_NAME, TODO_TOOL_UPDATE_ITEM_COMPLETION, input, undefined, undefined, promptContext);

      const toolName = `${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_UPDATE_ITEM_COMPLETION}`;
      const questionKey = toolName;
      const questionText = `Approve updating completion status for todo item "${name}" to ${completed}?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Updating todo item completion denied by user. Reason: ${userInput}`;
      }

      try {
        await task.updateTodo(name, { completed });
        const data = await task.readTodoFile();
        if (!data) {
          return 'No todo items found.';
        }
        return data.items;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error updating todo item: ${errorMessage}`;
      }
    },
  });

  const clearTodoItemsTool = tool({
    description: TODO_TOOL_DESCRIPTIONS[TODO_TOOL_CLEAR_ITEMS],
    inputSchema: z.object({}),
    execute: async (input, { toolCallId }) => {
      task.addToolMessage(toolCallId, TODO_TOOL_GROUP_NAME, TODO_TOOL_CLEAR_ITEMS, {}, undefined, undefined, promptContext);

      const toolName = `${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_CLEAR_ITEMS}`;
      const questionKey = toolName;
      const questionText = 'Approve clearing all todo items? This action cannot be undone.';

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Clearing todo items denied by user. Reason: ${userInput}`;
      }

      try {
        await task.setTodos([], '');
        return 'All todo items cleared successfully.';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error clearing todo items: ${errorMessage}`;
      }
    },
  });

  const allTools = {
    [`${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_SET_ITEMS}`]: setTodoItemsTool,
    [`${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_GET_ITEMS}`]: getTodoItemsTool,
    [`${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_UPDATE_ITEM_COMPLETION}`]: updateTodoItemCompletionTool,
    [`${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_CLEAR_ITEMS}`]: clearTodoItemsTool,
  };

  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};
