#!/usr/bin/env node
/* eslint-disable func-style,@typescript-eslint/no-explicit-any */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import { z } from 'zod/v3';

const projectDir = process.argv[2] || '.';

const AIDER_DESK_API_BASE_URL = process.env.AIDER_DESK_API_BASE_URL || 'http://localhost:24337/api';

// eslint-disable-next-line no-console
console.error(`Using AiderDesk API at: ${AIDER_DESK_API_BASE_URL} for project directory: ${projectDir}`);

export const server = new McpServer({
  name: 'aider-desk-mcp-server',
  version: '0.2.0',
});

function formatResponse(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data);
}

function formatError(error: any): string {
  if (error.response?.data) {
    return typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
  }
  return error.message;
}

const taskIdSchema = z.string().describe('The ID of the task to operate on. Use list_tasks to find available task IDs.');

// --- Task management tools ---

server.tool(
  'list_tasks',
  'List tasks in the AiderDesk project, sorted by most recently updated first. Use this to discover task IDs.',
  {
    offset: z.number().optional().describe('Number of tasks to skip for pagination (default: 0)'),
    limit: z.number().optional().describe('Maximum number of tasks to return'),
  },
  async (params) => {
    try {
      const response = await axios.get(`${AIDER_DESK_API_BASE_URL}/project/tasks`, {
        params: { projectDir },
      });

      let tasks: any[] = response.data;

      tasks.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });

      const offset = Math.max(0, params.offset ?? 0);
      const limit = params.limit ?? tasks.length;
      const paginated = tasks.slice(offset, offset + limit);

      const result = paginated.map((t) => ({
        id: t.id,
        name: t.name,
        state: t.state,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        ...(t.parentId && { parentId: t.parentId }),
      }));

      return { content: [{ type: 'text', text: formatResponse({ total: tasks.length, offset, limit, tasks: result }) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'create_task',
  'Create a new task in the AiderDesk project. Returns the new task ID and name.',
  {
    name: z.string().optional().describe('Optional name for the new task. If omitted, a default name will be generated.'),
  },
  async (params) => {
    try {
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/project/tasks/new`, {
        projectDir,
        name: params.name,
        activate: true,
      });
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'get_task',
  'Get detailed information about a specific task, including message count and context files.',
  {
    taskId: taskIdSchema,
  },
  async (params) => {
    try {
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/project/tasks/load`, {
        projectDir,
        id: params.taskId,
      });

      const taskData = response.data;
      const result = {
        id: params.taskId,
        messages: taskData.messages?.length ?? 0,
        contextFiles: (taskData.files ?? []).map((f: any) => ({ path: f.path, readOnly: f.readOnly })),
        todoItems: taskData.todoItems?.length ?? 0,
        workingMode: taskData.workingMode,
        question: taskData.question ?? null,
      };

      return { content: [{ type: 'text', text: formatResponse(result) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

// --- Context file tools ---

server.tool(
  'add_context_file',
  'Add a file to the context of an AiderDesk task.',
  {
    taskId: taskIdSchema,
    path: z
      .string()
      .describe(`File path to add to context. Relative to project directory (${projectDir}) when not read-only. Absolute path should be used when read-only.`),
    readOnly: z.boolean().default(false).describe('Whether the file is read-only'),
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/add-context-file`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'drop_context_file',
  'Remove a file from the context of an AiderDesk task.',
  {
    taskId: taskIdSchema,
    path: z.string().describe('File path to remove from context'),
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/drop-context-file`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'get_context_files',
  'Get all files currently in the context for an AiderDesk task.',
  {
    taskId: taskIdSchema,
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/get-context-files`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'get_addable_files',
  'Get files that can be added to the context for an AiderDesk task.',
  {
    taskId: taskIdSchema,
    searchRegex: z.string().optional().describe('Optional regex to filter addable files'),
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/get-addable-files`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'get_updated_files',
  'Get files that were changed (created, modified, or deleted) during an AiderDesk task.',
  {
    taskId: taskIdSchema,
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/get-updated-files`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'get_context_messages',
  'Get context messages (conversation history) for an AiderDesk task with pagination. Use negative offset to retrieve messages from the end (e.g., -1 for the last message, -5 for the last 5).',
  {
    taskId: taskIdSchema,
    offset: z
      .number()
      .optional()
      .describe('Number of messages to skip. Negative values count from the end (e.g., -1 = last message). Default: 0'),
    limit: z.number().optional().describe('Maximum number of messages to return'),
  },
  async (params) => {
    try {
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/project/tasks/load`, {
        projectDir,
        id: params.taskId,
      });

      const messages: any[] = response.data.messages ?? [];
      const offset = params.offset ?? 0;
      const limit = params.limit ?? messages.length;

      let actualOffset: number;
      if (offset < 0) {
        actualOffset = Math.max(0, messages.length + offset);
      } else {
        actualOffset = offset;
      }

      const actualLimit = Math.max(0, limit);
      const sliced = messages.slice(actualOffset, actualOffset + actualLimit);

      const result = {
        total: messages.length,
        offset: actualOffset,
        limit: actualLimit,
        messages: sliced.map((msg, i) => ({
          index: actualOffset + i,
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          ...(msg.usageReport && { usageReport: msg.usageReport }),
        })),
      };

      return { content: [{ type: 'text', text: formatResponse(result) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

// --- Prompt tools ---

server.tool(
  'run_prompt',
  'Run a prompt in an AiderDesk task. This is the main tool for interacting with AiderDesk. Make sure the necessary files are in context first.',
  {
    taskId: taskIdSchema,
    prompt: z.string().describe('The prompt to run'),
    mode: z
      .string()
      .default('code')
      .describe(
        'Mode for the action: "code" for coding tasks, "ask" for questions, "architect" for planning, "context" to auto-identify files, or "agent" for autonomous agent mode.',
      ),
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/run-prompt`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

server.tool(
  'clear_context',
  'Clear the context messages of an AiderDesk task. Useful when you want to start a new conversation with clean context.',
  {
    taskId: taskIdSchema,
  },
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/project/clear-context`, requestParams);
      return { content: [{ type: 'text', text: formatResponse(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: formatError(error) }] };
    }
  },
);

// Start the server
export async function main() {
  // eslint-disable-next-line no-console
  console.log('Starting AiderDesk MCP server...');
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // eslint-disable-next-line no-console
    console.error('AiderDesk MCP server started on stdio');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

if (process.env.AIDER_DESK_MCP_TESTING !== 'true') {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}
