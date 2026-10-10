import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import Sandbox from '@nyariv/sandboxjs';

import type { Extension, ExtensionContext, ModeDefinition, ToolDefinition, Tool, ToolsetCreatedEvent, ToolsetToolEntry, UIComponentDefinition } from '../../extensions.d.ts';

const PTC_MODE_NAME = 'ptc';
const PTC_TOOL_NAME = 'programmatic_tool_calls';
const SEARCH_RESULT_LIMIT = 10;
const MAX_DESCRIPTION_LENGTH_IN_SIGNATURE = 100;
const MAX_CATALOG_TYPE_TOKENS = 8000;

const metadata = {
  name: 'Programmatic Tool Calls',
  version: '1.5.0',
  description: 'Execute JavaScript code in a sandbox with access to all tools as async functions. Provides the PTC mode where tools are only accessible through code execution.',
  author: 'wladimiiir',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/programmatic-tool-calls/icon.png',
  capabilities: ['tools', 'ui'],
};

const inputSchema = z.object({
  code: z
  .string()
  .describe(
    'JavaScript code to execute. Tools are available as async functions under the `tools` object, e.g. `await tools.power_file_read({ filePath: "src/index.ts" })`.',
  ),
  timeout: z.number().optional().default(300).describe('Execution timeout in seconds. Default is 300 seconds.'),
});

type ProgrammaticToolCallsInput = z.infer<typeof inputSchema>;

const sanitizeToolName = (toolName: string): string => toolName.replace(/---/g, '_').replace(/-/g, '_');

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

const escapeJSDoc = (text: string): string => text.replace(/\*\//g, '*∕');

const truncateText = (text: string, maxLength: number): string => (text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`);

type ToolRecord = {
  rawName: string;
  path: string;
  pathRender: string;
  description: string;
  schema?: Record<string, unknown>;
};

const isIdentifier = (name: string): boolean => /^[A-Za-z_$][\w$]*$/.test(name);

const buildPathRender = (sanitizedName: string): string => (isIdentifier(sanitizedName) ? `tools.${sanitizedName}` : `tools['${sanitizedName}']`);

const buildToolRecords = (tools: Record<string, ToolsetToolEntry>, excludeToolName: string): ToolRecord[] => {
  const usedNames = new Set<string>([excludeToolName]);
  const records: ToolRecord[] = [];

  for (const [rawName, tool] of Object.entries(tools)) {
    if (rawName === excludeToolName) {
      continue;
    }

    let sanitizedName = sanitizeToolName(rawName);
    let suffix = 2;
    while (usedNames.has(sanitizedName)) {
      sanitizedName = `${sanitizeToolName(rawName)}_${suffix}`;
      suffix++;
    }
    usedNames.add(sanitizedName);

    records.push({
      rawName,
      path: `tools.${sanitizedName}`,
      pathRender: buildPathRender(sanitizedName),
      description: tool.description ?? '',
      schema: getJsonSchema(tool.inputSchema),
    });
  }

  return records;
};

const renderSchemaType = (schema: Record<string, unknown> | undefined, depth: number): string => {
  if (!schema) {
    return 'unknown';
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map((value) => (typeof value === 'string' ? `'${value}'` : String(value))).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `Array<${renderSchemaType(schema.items as Record<string, unknown> | undefined, depth + 1)}>`;
    case 'object': {
      const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
      const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
      if (!properties || depth >= 2) {
        return '{ [key: string]: unknown }';
      }
      const lines = Object.entries(properties).map(([name, propSchema]) => {
        const optional = required.includes(name) ? '' : '?';
        const propDescription = typeof propSchema.description === 'string' ? truncateText(escapeJSDoc(propSchema.description), MAX_DESCRIPTION_LENGTH_IN_SIGNATURE) : '';
        const descriptionLine = propDescription ? `\n  /** ${propDescription} */\n  ` : '  ';
        return `${descriptionLine}${name}${optional}: ${renderSchemaType(propSchema, depth + 1)},`;
      });
      return lines.length > 0 ? `{${lines.join('\n')}\n}` : 'Record<string, unknown>';
    }
    default:
      return 'unknown';
  }
};

const buildToolSignature = (record: ToolRecord): string => {
  const description = record.description ? truncateText(escapeJSDoc(record.description.split('\n')[0] ?? record.description), 160) : '';
  const descriptionLine = description ? `/** ${description} */\n` : '';
  const schema = record.schema;
  const required = schema && Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const properties = schema?.properties as Record<string, Record<string, unknown>> | undefined;

  let inputType = 'Record<string, unknown>';
  if (properties && Object.keys(properties).length > 0) {
    const lines = Object.entries(properties).map(([name, propSchema]) => {
      const optional = required.includes(name) ? '' : '?';
      const propDescription = typeof propSchema.description === 'string' ? truncateText(escapeJSDoc(propSchema.description), MAX_DESCRIPTION_LENGTH_IN_SIGNATURE) : '';
      const descriptionLine = propDescription ? `\n  /** ${propDescription} */\n  ` : '  ';
      return `${descriptionLine}${name}${optional}: ${renderSchemaType(propSchema, 0)},`;
    });
    inputType = `{${lines.join('\n')}\n}`;
  }

  return `${descriptionLine}${record.pathRender}(inputs: ${inputType}): Promise<unknown>`;
};

const singularVariant = (term: string): string => {
  if (term.length > 3 && term.endsWith('ies')) {
    return `${term.slice(0, -3)}y`;
  }
  if (term.length > 4 && (term.endsWith('shes') || term.endsWith('ches') || term.endsWith('xes') || term.endsWith('zes'))) {
    return term.slice(0, -2);
  }
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) {
    return term.slice(0, -1);
  }
  return term;
};

const tokenizeQuery = (text: string): string[] =>
  text
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((token) => token.length > 0 && token !== '*');

type ScoredMatch = { record: ToolRecord; score: number };

export const scoreToolRecords = (records: ToolRecord[], rawQuery: string, namespace?: string, rawLimit?: number, offset?: number): { matches: ScoredMatch[]; total: number } => {
  const terms = tokenizeQuery(rawQuery);
  const limit = typeof rawLimit === 'number' && rawLimit >= 0 ? rawLimit : SEARCH_RESULT_LIMIT;
  const startOffset = typeof offset === 'number' && offset >= 0 ? offset : 0;
  const namespacePrefix = namespace ? `tools.${namespace}` : undefined;

  const matches: ScoredMatch[] = [];
  for (const record of records) {
    if (namespacePrefix && !record.path.startsWith(namespacePrefix) && record.path !== namespace) {
      continue;
    }

    if (terms.length === 0) {
      matches.push({ record, score: 0 });
      continue;
    }

    const schema = record.schema;
    const properties = schema?.properties as Record<string, Record<string, unknown>> | undefined;
    const propertyText = properties
      ? Object.entries(properties)
      .map(([name, propSchema]) => `${name} ${typeof propSchema.description === 'string' ? propSchema.description : ''}`)
      .join(' ')
      : '';

    const pathTokens = tokenizeQuery(record.path);
    let score = 0;
    for (const term of terms) {
      const variants = [term, singularVariant(term)];
      if (variants.some((variant) => pathTokens.includes(variant))) {
        score += 20;
      } else if (variants.some((variant) => record.path.includes(variant))) {
        score += 8;
      } else if (variants.some((variant) => record.description.toLowerCase().includes(variant))) {
        score += 4;
      } else if (variants.some((variant) => propertyText.toLowerCase().includes(variant))) {
        score += 2;
      }
    }

    if (score > 0) {
      matches.push({ record, score });
    }
  }

  matches.sort((a, b) => b.score - a.score || a.record.path.localeCompare(b.record.path));

  return { matches: matches.slice(startOffset, startOffset + limit), total: matches.length };
};

const buildSearchResultEntry = (record: ToolRecord): string => `${buildToolSignature(record)}\n/** ${truncateText(escapeJSDoc(record.description), 200)} */`;

const CATALOG_INTRO = `\n\n## Available tools\n`;

const buildCatalogDescription = (records: ToolRecord[]): string => {
  if (records.length === 0) {
    return '\n\nNo other tools are currently available.';
  }

  const nameList = records.map((record) => record.path.replace(/^tools\./, '')).join(', ');
  let catalog = `${CATALOG_INTRO}${records.length} tools (all callable as \`await ${'{path}'}(...)\`): ${nameList}\n`;

  const signatureEntries: string[] = [];
  let tokens = 0;
  let shown = 0;
  for (const record of [...records].sort((a, b) => a.path.localeCompare(b.path))) {
    const signature = buildToolSignature(record);
    const entryTokens = Math.ceil(signature.length / 4);
    if (tokens + entryTokens > MAX_CATALOG_TYPE_TOKENS) {
      break;
    }
    tokens += entryTokens;
    shown++;
    signatureEntries.push(signature);
  }

  catalog += signatureEntries.join('\n');

  if (shown < records.length) {
    catalog += `\n\n(SIGNATURES PARTIAL: showing ${shown} of ${records.length}. Inside the sandbox use searchTools('query') to find the rest and describeTool(path) to get the full signature of a known tool.)`;
  } else if (shown === records.length) {
    catalog += `\n\n(This is the COMPLETE list of tool signatures.)`;
  }

  return catalog;
};

const PTC_TOOL_BASE_DESCRIPTION = `Execute JavaScript code that orchestrates tools. Results returned from the code are the only thing that reaches your context, so filter and process tool results in code instead of reading them directly.

## Workflow
1. Find a tool: pick from the inlined list below, or call searchTools('query') inside the code when what you need is not listed.
2. Call the tool at its exact path, e.g. await tools.power_file_read({ filePath: 'src/index.ts' });
3. Return only the fields you need.

## Rules
- Every tool call must be awaited. Un-awaited tool calls resolve to {}.
- Run independent calls in parallel with Promise.all.
- Call paths exactly as rendered in the catalog or search results - never guess names.
- After known calls fail or you need a different tool, use searchTools to find alternatives.

## Language
This is a JavaScript orchestration environment, not a general runtime. NOT supported: array/object destructuring (including rest), classes, generators, promise chaining (.then/.catch/.finally - use await with try/catch), eval, imports, modules, timers, filesystem access.
Instead of: const [a, b] = await Promise.all([...])
Use: const r = await Promise.all([...]); const a = r[0]; const b = r[1];

## Sandbox globals
- tools: object of async tool functions, grouped as tools.<name> (dashes became underscores).
- searchTools({ query, limit?, namespace? }): find tools by topic or parameter name; results include full signatures.
- describeTool(path): full signature of a known path.
- Object.keys(tools): top-level tool names.`;



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

    const records = buildToolRecords(event.tools, PTC_TOOL_NAME);
    const ptcToolWithCatalog: ToolsetToolEntry = { ...ptcTool, description: `${ptcTool.description ?? ''}${buildCatalogDescription(records)}` };

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
        description: PTC_TOOL_BASE_DESCRIPTION,
        inputSchema,
        execute: async (input: ProgrammaticToolCallsInput, signal: AbortSignal | undefined, context: ExtensionContext, allTools: Record<string, Tool>) => {
          const { code, timeout = 300 } = input;
          const timeoutMs = timeout * 1000;

          context.log(`Executing programmatic tool calls with ${timeout}s timeout`);

          const records = buildToolRecords(allTools as unknown as Record<string, ToolsetToolEntry>, PTC_TOOL_NAME);

          const makeToolFunction = (record: ToolRecord) => async (...args: unknown[]) => {
            if (signal?.aborted) {
              throw new Error('Cancelled: execution aborted');
            }

            try {
              const result = await allTools[record.rawName].execute(args[0] as Record<string, unknown>);
              return result;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              context.log(`Tool '${record.rawName}' failed: ${errorMsg}`, 'error');
              throw new Error(`ToolFailure: ${record.rawName} — ${errorMsg}`);
            }
          };

          const toolsObject: Record<string, unknown> = {};
          for (const record of records) {
            toolsObject[sanitizeToolName(record.rawName)] = makeToolFunction(record);
          }

          const searchTools = (request?: { query?: string; limit?: number; offset?: number; namespace?: string }): { results: string[]; total: number } => {
            const { matches, total } = scoreToolRecords(records, request?.query ?? '', request?.namespace, request?.limit, request?.offset);
            return { results: matches.map((match) => buildSearchResultEntry(match.record)), total };
          };

          const describeTool = (path: string): string | { error: string } => {
            const normalized = path.replace(/^tools\['/, '').replace(/'\]$/, '').replace(/^tools\./, '');
            const record = records.find((candidate) => candidate.path === `tools.${normalized}`);
            if (!record) {
              return { error: `UnknownTool: '${path}' is not a known tool path. Use searchTools() to find available tools.` };
            }
            return `${buildToolSignature(record)}\n/** ${record.description} */`;
          };

          const scope: Record<string, unknown> = {
            tools: toolsObject,
            ALL_TOOLS: records.map((record) => ({ path: record.pathRender, description: truncateText(record.description, 200) })),
            searchTools,
            describeTool,
          };
          for (const record of records) {
            const rawKey = record.path.replace(/^tools\./, '');
            if (isIdentifier(rawKey)) {
              scope[rawKey] = toolsObject[rawKey];
            }
          }

          const sandbox = new Sandbox();

          let compiledCode: ReturnType<typeof sandbox.compileAsync>;
          try {
            compiledCode = sandbox.compileAsync(code);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: 'text' as const, text: `SyntaxError: code could not be parsed — ${errorMsg}` }],
              isError: true,
            };
          }

          const executionPromise = new Promise<unknown>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`TimeoutExceeded: execution timed out after ${timeout}s`));
            }, timeoutMs);

            const abortHandler = () => {
              clearTimeout(timeoutId);
              reject(new Error('Cancelled: execution aborted'));
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

            let diagnostic: string;
            if (errorMsg.startsWith('Cancelled:') || errorMsg.startsWith('TimeoutExceeded:')) {
              diagnostic = errorMsg;
            } else if (errorMsg.startsWith('ToolFailure:')) {
              diagnostic = errorMsg;
            } else {
              const notDefined = errorMsg.match(/^(\w[\w$]*) is not defined/) ?? errorMsg.match(/^(\w[\w$]*) is not a function/);
              if (notDefined) {
                diagnostic = `UnknownTool: '${notDefined[1]}' is not available in this sandbox. Use searchTools('...') inside the code to discover available tools, and await every call.`;
              } else {
                diagnostic = `ExecutionFailure: ${errorMsg}`;
              }
            }

            return {
              content: [{ type: 'text' as const, text: diagnostic }],
              isError: true,
            };
          }
        },
      },
    ];
  }
}

export default ProgrammaticToolCallsExtension;
