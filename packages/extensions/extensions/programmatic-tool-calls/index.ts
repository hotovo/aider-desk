import { z } from 'zod';
import Sandbox from '@nyariv/sandboxjs';

import type { Extension, ExtensionContext, ToolDefinition, Tool } from '../../extensions.d.ts';

const metadata = {
  name: 'Programmatic Tool Calls',
  version: '1.0.0',
  description: 'Execute JavaScript code in a sandbox with access to all tools as async functions',
  author: 'AiderDesk',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/programmatic-tool-calls/icon.png',
  capabilities: ['tools'],
};

const inputSchema = z.object({
  code: z
  .string()
  .describe(
    'JavaScript code to execute. All tools are available as async functions in the global scope. Tool names use underscores instead of dashes (e.g., power_file_read for power---file-read).',
  ),
  timeout: z.number().optional().default(300).describe('Execution timeout in seconds. Default is 300 seconds.'),
});

type ProgrammaticToolCallsInput = z.infer<typeof inputSchema>;

const sanitizeToolName = (toolName: string): string => {
  return toolName.replace(/---/g, '_').replace(/-/g, '_');
};

class ProgrammaticToolCallsExtension implements Extension {
  static metadata = metadata;

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'programmatic_tool_calls',
        description: `Execute JavaScript code in a secure sandbox with access to all available tools as async functions.

        This allows you to:
        - Write code that calls multiple tools in sequence or parallel
        - Process and filter tool results before returning them
        - Implement complex logic that would require multiple round-trips
        - Reduce latency by batching operations

        All tools are available as async functions. Replace dashes with underscores in tool names:
        - power---file-read becomes power_file_read()
        - power---bash becomes power_bash()
        - etc.

        Example usage:
        \`\`\`javascript
        // Read a file and process its contents
        const content = await power_file_read({ filePath: 'src/index.ts' });
        console.log(content);

        // Execute multiple operations in parallel
        const [files, gitStatus] = await Promise.all([
          power_glob({ pattern: '**/*.ts' }),
                                                     power_bash({ command: 'git status --short' })
        ]);

        // Process results
        return { fileCount: files.length, gitStatus };
        \`\`\``,
        inputSchema,
        execute: async (input: ProgrammaticToolCallsInput, signal: AbortSignal | undefined, context: ExtensionContext, allTools: Record<string, Tool>) => {
          const { code, timeout = 300 } = input;
          const timeoutMs = timeout * 1000;

          context.log(`Executing programmatic tool calls with ${timeout}s timeout`);

          const sandbox = new Sandbox();

          const scope: Record<string, unknown> = {};

          for (const [toolName, tool] of Object.entries(allTools)) {
            const safeName = sanitizeToolName(toolName);
            scope[safeName] = async (...args: unknown[]) => {
              if (signal?.aborted) {
                throw new Error('Execution aborted');
              }

              try {
                const result = await tool.execute(args[0] as Record<string, unknown>);
                return result;
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                context.log(`Tool '${toolName}' failed: ${errorMsg}`, 'error');
                throw new Error(`Tool '${toolName}' failed: ${errorMsg}`);
              }
            };
          }

          let compiledCode: ReturnType<typeof sandbox.compileAsync>;
          try {
            compiledCode = sandbox.compileAsync(code);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: 'text' as const, text: `Code compilation error: ${errorMsg}` }],
              isError: true,
            };
          }

          const executionPromise = new Promise<unknown>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Execution timed out after ${timeout} seconds`));
            }, timeoutMs);

            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new Error('Execution aborted'));
            };
            signal?.addEventListener('abort', abortHandler);

            try {
              const result = compiledCode(scope).run();
              if (result instanceof Promise) {
                result
                .then((value) => {
                  clearTimeout(timeoutId);
                  signal?.removeEventListener('abort', abortHandler);
                  resolve(value);
                })
                .catch((error) => {
                  clearTimeout(timeoutId);
                  signal?.removeEventListener('abort', abortHandler);
                  reject(error);
                });
              } else {
                clearTimeout(timeoutId);
                signal?.removeEventListener('abort', abortHandler);
                resolve(result);
              }
            } catch (error) {
              clearTimeout(timeoutId);
              signal?.removeEventListener('abort', abortHandler);
              reject(error);
            }
          });

          try {
            const result = await executionPromise;

            let resultText: string;
            if (typeof result === 'string') {
              resultText = result;
            } else if (result === undefined) {
              resultText = 'Execution completed with no return value.';
            } else {
              try {
                resultText = JSON.stringify(result, null, 2);
              } catch {
                resultText = String(result);
              }
            }

            return {
              content: [{ type: 'text' as const, text: resultText }],
            };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: 'text' as const, text: `Execution error: ${errorMsg}` }],
              isError: true,
            };
          }
        },
      },
    ];
  }
}

export default ProgrammaticToolCallsExtension;
