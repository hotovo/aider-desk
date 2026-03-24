import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { AgentProfile, MemoryEntryType, PromptContext, ToolApprovalState } from '@common/types';
import {
  MEMORY_TOOL_DELETE as TOOL_DELETE,
  MEMORY_TOOL_DESCRIPTIONS,
  MEMORY_TOOL_LIST as TOOL_LIST,
  MEMORY_TOOL_RETRIEVE as TOOL_RETRIEVE,
  MEMORY_TOOL_STORE as TOOL_STORE,
  MEMORY_TOOL_UPDATE as TOOL_UPDATE,
  MEMORY_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import { ApprovalManager } from './approval-manager';

import { MemoryManager } from '@/memory/memory-manager';
import { Task } from '@/task';
import logger from '@/logger';

export const createMemoryToolset = (task: Task, profile: AgentProfile, memoryManager: MemoryManager, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const storeMemoryTool = tool({
    description: MEMORY_TOOL_DESCRIPTIONS[TOOL_STORE],
    inputSchema: z.object({
      type: z.enum(['task', 'user-preference', 'code-pattern']).describe('The type of memory to store'),
      content: z.string().describe('The content to store in memory'),
    }),
    execute: async (input, { toolCallId }) => {
      const { type, content } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_STORE, { type, content }, undefined, undefined, promptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_STORE}`;
      const questionKey = toolName;
      const questionText = `Store memory of type '${type}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, content);

      if (!isApproved) {
        return userInput || 'Memory storage cancelled by user.';
      }

      try {
        const projectId = task.getProject().baseDir;
        const taskId = task.taskId;
        const memoryType = type as MemoryEntryType;

        await memoryManager.storeMemory(projectId, taskId, memoryType, content);

        logger.info('Memory stored successfully', {
          projectId,
          taskId,
          type: memoryType,
          contentLength: content.length,
        });

        return 'Memory stored successfully';
      } catch (error) {
        logger.error('Failed to store memory:', error);
        return `Failed to store memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const retrieveMemoryTool = tool({
    description: MEMORY_TOOL_DESCRIPTIONS[TOOL_RETRIEVE],
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant memories'),
      limit: z.number().optional().default(3).describe('Maximum number of memories to retrieve (default: 3)'),
    }),
    execute: async (input, { toolCallId }) => {
      const { query, limit } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_RETRIEVE, { query, limit }, undefined, undefined, promptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RETRIEVE}`;
      const questionKey = toolName;
      const questionText = `Retrieve memories with query: "${query}" (limit: ${limit})?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return userInput || 'Memory retrieval cancelled by user.';
      }

      try {
        const projectId = task.getProject().baseDir;
        const memories = await memoryManager.retrieveMemories(projectId, query, limit);

        logger.info('Memories retrieved successfully', {
          projectId,
          query,
          count: memories.length,
        });

        return memories;
      } catch (error) {
        logger.error('Failed to retrieve memories:', error);
        return `Failed to retrieve memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const deleteMemoryTool = tool({
    description: MEMORY_TOOL_DESCRIPTIONS[TOOL_DELETE],
    inputSchema: z.object({
      id: z.string().describe('The ID of the memory to delete'),
    }),
    execute: async (input, { toolCallId }) => {
      const { id } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_DELETE, { id }, undefined, undefined, promptContext);

      // Get the memory to show its content in the approval question
      const memory = await memoryManager.getMemory(id);

      if (!memory) {
        return `Memory with ID ${id} not found.`;
      }

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DELETE}`;
      const questionKey = toolName;
      const questionText = `Delete memory with ID: ${id}?`;
      const questionSubject = `Content: "${memory.content}"\nType: ${memory.type}\nTimestamp: ${new Date(memory.timestamp).toLocaleString()}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return userInput || 'Memory deletion cancelled by user.';
      }

      try {
        const success = await memoryManager.deleteMemory(id);

        if (success) {
          logger.info('Memory deleted successfully', { id });
          return `Memory with ID ${id} deleted successfully.`;
        } else {
          return `Failed to delete memory with ID ${id}. Memory may not exist.`;
        }
      } catch (error) {
        logger.error('Failed to delete memory:', error);
        return `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const listMemoriesTool = tool({
    description: MEMORY_TOOL_DESCRIPTIONS[TOOL_LIST],
    inputSchema: z.object({
      type: z.enum(['task', 'user-preference', 'code-pattern']).optional().describe('Filter by memory type'),
      limit: z.number().optional().default(20).describe('Maximum number of memories to list (default: 20)'),
    }),
    execute: async (input, { toolCallId }) => {
      const { type, limit } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_LIST, { type, limit }, undefined, undefined, promptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_LIST}`;
      const questionKey = toolName;
      const questionText = `List memories with type filter: ${type || 'all'} (limit: ${limit})?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return userInput || 'Memory listing cancelled by user.';
      }

      try {
        const projectId = task.getProject().baseDir;
        const memories = await memoryManager.getAllMemories();

        // Filter by project and type if specified
        const filteredMemories = memories.filter((memory) => {
          if (memory.projectId !== projectId) {
            return false;
          }
          if (type && memory.type !== type) {
            return false;
          }
          return true;
        });

        const limitedMemories = filteredMemories.slice(0, limit);

        logger.info('Memories listed successfully', {
          projectId,
          type: type || 'all',
          count: limitedMemories.length,
        });

        return limitedMemories;
      } catch (error) {
        logger.error('Failed to list memories:', error);
        return `Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const updateMemoryTool = tool({
    description: MEMORY_TOOL_DESCRIPTIONS[TOOL_UPDATE],
    inputSchema: z.object({
      id: z.string().describe('The ID of the memory to update'),
      content: z.string().describe('The new content for the memory'),
    }),
    execute: async (input, { toolCallId }) => {
      const { id, content } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_UPDATE, { id, content }, undefined, undefined, promptContext);

      // Get the memory to show its content in the approval question
      const memory = await memoryManager.getMemory(id);

      if (!memory) {
        return `Memory with ID ${id} not found.`;
      }

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_UPDATE}`;
      const questionKey = toolName;
      const questionText = `Update memory with ID: ${id}?`;
      const questionSubject = `Old content: "${memory.content}"\nNew content: "${content}"`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return userInput || 'Memory update cancelled by user.';
      }

      try {
        const success = await memoryManager.updateMemory(id, content);

        if (success) {
          logger.info('Memory updated successfully', { id });
          return `Memory with ID ${id} updated successfully.`;
        } else {
          return `Failed to update memory with ID ${id}. Memory may not exist.`;
        }
      } catch (error) {
        logger.error('Failed to update memory:', error);
        return `Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const allTools = {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_STORE}`]: storeMemoryTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RETRIEVE}`]: retrieveMemoryTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DELETE}`]: deleteMemoryTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_LIST}`]: listMemoriesTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_UPDATE}`]: updateMemoryTool,
  };

  // Filter out tools that are set to Never in toolApprovals
  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};
