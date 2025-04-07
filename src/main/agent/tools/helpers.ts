import { tool } from 'ai';
import { z } from 'zod';
import { SERVER_TOOL_SEPARATOR } from '@common/utils';

import type { ToolSet } from 'ai';

export const createHelpersToolset = (): ToolSet => {
  const noSuchTool = tool({
    description: 'Internal helper tool to inform the LLM that a requested tool does not exist. Do not use this tool.',
    parameters: z.object({
      toolName: z.string().describe('The name of the tool that was requested but not found.'),
      availableTools: z.array(z.string()).describe('The list of available tools.'),
    }),
    execute: async ({ toolName, availableTools }) => {
      // This tool's result is primarily for the LLM's internal reasoning,
      // informing it that its previous attempt failed because the tool was invalid.
      return `Error: You attempted to use a tool named '${toolName}', but no such tool is available (maybe a typo?). Try again with different tool from the list of available tools: ${availableTools.join(', ')}`;
    },
  });

  const invalidToolArguments = tool({
    description: 'Internal helper tool to inform the LLM that a tool was called with invalid arguments. Do not use this tool.',
    parameters: z.object({
      toolName: z.string().describe('The name of the tool that was called.'),
      toolArgs: z.string().describe('The arguments that were passed to the tool (stringified JSON).'),
      error: z.string().describe('The error message describing why the arguments were invalid.'),
    }),
    execute: async ({ toolName, toolArgs, error }) => {
      // This tool informs the LLM about the argument validation error.
      return `Error: You attempted to use the tool '${toolName}' with invalid arguments: ${JSON.stringify(toolArgs)}. The error was: ${error}. Please check the tool's schema and try again with corrected arguments.`;
    },
  });

  return {
    [`helpers${SERVER_TOOL_SEPARATOR}no_such_tool`]: noSuchTool,
    [`helpers${SERVER_TOOL_SEPARATOR}invalid_tool_arguments`]: invalidToolArguments,
  };
};
