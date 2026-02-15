import { tool } from 'ai';
import { z } from 'zod';
import {
  TOOL_GROUP_NAME_SEPARATOR,
  HELPERS_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  HELPERS_TOOL_NO_SUCH_TOOL as TOOL_NO_SUCH_TOOL,
  HELPERS_TOOL_INVALID_TOOL_ARGUMENTS as TOOL_INVALID_TOOL_ARGUMENTS,
} from '@aider-desk/common/tools';

import type { ToolSet } from 'ai';

export const createHelpersToolset = (): ToolSet => {
  const noSuchTool = tool({
    description: 'Internal helper tool to inform the LLM that a requested tool does not exist. Do not use this tool.',
    inputSchema: z.object({
      toolName: z.string().describe('The name of the tool that was requested but not found.'),
      availableTools: z.array(z.string()).describe('The list of available tools.'),
    }),
    execute: async ({ toolName, availableTools }) => {
      // This tool's result is primarily for the LLM's internal reasoning,
      // informing it that its previous attempt failed because the tool was invalid.
      return `Error: You attempted to use a tool named '${toolName}', but no such tool is available (maybe a typo?). Try again with different tool from the list of available tools: ${availableTools.join(', ')}.
      Make sure you use the tool name exactly as it appears in the list with server name prefix ${TOOL_GROUP_NAME_SEPARATOR} and tool name. Example: 'commander${TOOL_GROUP_NAME_SEPARATOR}run_command'.`;
    },
  });

  const invalidToolArguments = tool({
    description: 'Internal helper tool to inform the LLM that a tool was called with invalid arguments. Do not use this tool.',
    inputSchema: z.object({
      toolName: z.string().describe('The name of the tool that was called.'),
      toolInput: z.string().describe('The arguments that were passed to the tool (stringified JSON).'),
      error: z.string().describe('The error message describing why the arguments were invalid.'),
    }),
    execute: async ({ toolName, toolInput, error }) => {
      // This tool informs the LLM about the argument validation error.
      return `Error: You attempted to use the tool '${toolName}' with invalid arguments: ${JSON.stringify(toolInput)}. The error was: ${error}. Please check the tool's schema and try again with corrected arguments.`;
    },
  });

  return {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_NO_SUCH_TOOL}`]: noSuchTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_INVALID_TOOL_ARGUMENTS}`]: invalidToolArguments,
  };
};
