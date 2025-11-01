/* eslint-disable func-style,@typescript-eslint/no-explicit-any */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import axios from 'axios';
import { z } from 'zod';

// Get project directory from command line arguments or use default
const projectDir = process.argv[2] || '.';

// AiderDesk API configuration
const AIDER_DESK_API_BASE_URL = process.env.AIDER_DESK_API_BASE_URL || 'http://localhost:24337/api';

// eslint-disable-next-line no-console
console.error(`Using AiderDesk API at: ${AIDER_DESK_API_BASE_URL} for project directory: ${projectDir}`);

// Create MCP server
const server = new McpServer({
  name: 'aider-desk-mcp-server',
  version: '0.1.0',
});

// Define tool schemas
const AddContextFileSchema = {
  path: z
    .string()
    .describe(`File path to add to context. Relative to project directory (${projectDir}) when not read-only. Absolute path should be used when read-only.`),
  readOnly: z.boolean().default(false).describe('Whether the file is read-only'),
};

const DropContextFileSchema = {
  path: z.string().describe('File path to remove from context'),
};

const GetContextFilesSchema = {};

const GetAddableFilesSchema = {
  searchRegex: z.string().optional().describe('Optional regex to filter addable files'),
};

const RunPromptSchema = {
  prompt: z.string().describe('The prompt to run'),
  mode: z
    .enum(['code', 'ask', 'architect', 'context'])
    .default('code')
    .describe(
      'Type of the action that AiderDesk will perform. Code is for coding tasks, ask is for asking questions, architect is for planing changes, context automatically identifies which files need to added to context based on the prompt.',
    ),
};

const ClearContextSchema = {};

// Add tools to the server
server.tool('add_context_file', 'Add a file to the context of AiderDesk.', AddContextFileSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/add-context-file`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('drop_context_file', 'Remove a file from the context of AiderDesk.', DropContextFileSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/drop-context-file`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('get_context_files', 'Get all files currently in the context for AiderDesk to use.', GetContextFilesSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/get-context-files`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool('get_addable_files', 'Get files that can be added to the context for AiderDesk.', GetAddableFilesSchema, async (params) => {
  try {
    const requestParams = { ...params, projectDir };
    const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/get-addable-files`, requestParams);
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: error.response?.data || error.message }] };
  }
});

server.tool(
  'run_prompt',
  'Run a prompt in AiderDesk. This is the main tool for interacting with AiderDesk. Use this tool when you need to perform a coding task on the files in the context. Before using this tool, make sure you have added all the necessary files to the context.',
  RunPromptSchema,
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/run-prompt`, requestParams);
      return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: error.response?.data || error.message }] };
    }
  },
);

server.tool(
  'clear_context',
  'Clear the context messages of AiderDesk. Useful when you want to start a new task with clear context.',
  ClearContextSchema,
  async (params) => {
    try {
      const requestParams = { ...params, projectDir };
      const response = await axios.post(`${AIDER_DESK_API_BASE_URL}/project/clear-context`, requestParams);
      return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: error.response?.data || error.message }] };
    }
  },
);

// Start the server
async function main() {
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

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error in main():', error);
  process.exit(1);
});
