import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import Sandbox from '@nyariv/sandboxjs';

import type { Extension, ExtensionContext, ModeDefinition, ToolDefinition, Tool, ToolsetCreatedEvent, ToolsetToolEntry, UIComponentDefinition } from '../../extensions.d.ts';

const PTC_MODE_NAME = 'ptc';
const PTC_TOOL_NAME = 'programmatic_tool_calls';

const metadata = {
  name: 'Programmatic Tool Calls',
  version: '1.4.0',
  description: 'Execute JavaScript code in a sandbox with access to all tools as async functions. Provides the PTC mode where tools are only accessible through code execution.',
  author: 'wladimiiir',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/programmatic-tool-calls/icon.png',
  capabilities: ['tools', 'ui'],
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

const MAX_CATALOG_TOOL_DESCRIPTION_LENGTH = 200;

const getJsonSchema = (inputSchema: unknown): Record<string, unknown> | undefined => {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return undefined;
  }

  const schema = inputSchema as Record<string, unknown>;

  // zod schema
  if (typeof schema.safeParse === 'function') {
    try {
      const jsonSchema = { ...z.toJSONSchema(schema as unknown as z.ZodType, { io: 'input' }) };
      delete jsonSchema.$schema;
      return jsonSchema;
    } catch {
      return undefined;
    }
  }

  // JSON schema wrapped by the AI SDK (jsonSchema())
  if (schema.jsonSchema && typeof schema.jsonSchema === 'object') {
    return schema.jsonSchema as Record<string, unknown>;
  }

  // plain JSON schema
  if ('type' in schema || 'properties' in schema) {
    return schema;
  }

  return undefined;
};

const truncateText = (text: string, maxLength: number): string => (text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`);

const buildToolsCatalog = (tools: Record<string, ToolsetToolEntry>, excludeToolName: string): string => {
  const catalog: Record<string, { description?: string; parameters?: Record<string, unknown> }> = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (name === excludeToolName) {
      continue;
    }

    const jsonSchema = getJsonSchema(tool.inputSchema);
    catalog[sanitizeToolName(name)] = {
      ...(tool.description ? { description: truncateText(tool.description, MAX_CATALOG_TOOL_DESCRIPTION_LENGTH) } : {}),
      ...(jsonSchema ? { parameters: jsonSchema } : {}),
    };
  }

  if (Object.keys(catalog).length === 0) {
    return '';
  }

  return `

Available tools (call them as async functions in code using these exact names):
${JSON.stringify(catalog, null, 2)}`;
};

class ProgrammaticToolCallsExtension implements Extension {
  static metadata = metadata;

  getModes(): ModeDefinition[] {
    return [
      {
        name: PTC_MODE_NAME,
        label: 'PTC',
        description: 'Programmatic Tool Calls: only the code execution tool is available; all other tools are called from sandboxed code',
        icon: 'FiTerminal',
      },
    ];
  }

  async onToolsetCreated(event: ToolsetCreatedEvent): Promise<void | Partial<ToolsetCreatedEvent>> {
    if (event.mode !== PTC_MODE_NAME) {
      return;
    }

    const ptcTool = event.tools[PTC_TOOL_NAME];
    if (!ptcTool) {
      return;
    }

    const toolsCatalog = buildToolsCatalog(event.tools, PTC_TOOL_NAME);
    const ptcToolWithCatalog: ToolsetToolEntry = toolsCatalog ? { ...ptcTool, description: `${ptcTool.description ?? ''}${toolsCatalog}` } : ptcTool;

    return { tools: { [PTC_TOOL_NAME]: ptcToolWithCatalog } };
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: 'programmatic-tool-call-message',
        placement: 'task-message',
        jsx: readFileSync(join(__dirname, 'ProgrammaticToolCallMessage.jsx'), 'utf-8'),
        messageFilter: {
          types: ['tool'],
          serverName: 'extensions',
          toolName: 'programmatic_tool_calls',
        },
      },
    ];
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'programmatic_tool_calls',
        description: `Execute JavaScript code in a secure sandbox with access to all available tools as async functions.

        This allows you to:
        - Write code that calls multiple tools in sequence or parallel
        - Process and filter tool results before returning them
        - Implement complex logic that would require multiple round-trips
        - Reduce latency by batching operations

        When the agent runs in the 'ptc' (Programmatic Tool Calls) mode, this is the ONLY tool available - all other tools are accessible exclusively through code execution in this sandbox.

        All tools are available as async functions. Replace dashes with underscores in tool names:
        - power---file-read becomes power_file_read()
        - power---bash becomes power_bash()
        - etc.

        Important - the sandbox does NOT support array/object destructuring (including rest in destructuring).
        Instead of: const [a, b] = await Promise.all([...])
        Use: const r = await Promise.all([...]); const a = r[0]; const b = r[1];

        Example usage:
        \`\`\`javascript
        // Read a file and return its content
        return await power_file_read({ filePath: 'src/index.ts' });

        // Execute multiple operations in parallel (no destructuring - use index access)
        const results = await Promise.all([
          power_glob({ pattern: '**/*.ts' }),
          power_bash({ command: 'git status --short' })
        ]);
        const files = results[0];
        const gitStatus = results[1];

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

            resultText = await context.truncateToolResult(resultText, 1000, 50, 10000);

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
