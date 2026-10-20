import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, CallToolResultSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { asSchema } from 'ai';

import { NATIVE_TOOLS } from './catalog';
import { toMcpResult } from './output';

import type { ToolSet } from 'ai';
import type { CallToolResult, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js';

const canonicalInput = (input: unknown): unknown => {
  if (Array.isArray(input)) {
    return input.map(canonicalInput);
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, canonicalInput(value)]),
    );
  }
  return input;
};

export class ToolBridge {
  readonly names = new Map<string, string>();
  private definitions: McpTool[] = [];
  private pending = new Map<string, Array<{ id: string; input: string }>>();
  private executions = new Map<string, Promise<CallToolResult>>();
  private outputs = new Map<string, { value: unknown }>();
  private transports = new Set<StreamableHTTPServerTransport>();
  private server = createServer();
  private token = randomBytes(32).toString('hex');
  signal?: AbortSignal;

  constructor(private tools: ToolSet) {}

  async start(): Promise<string> {
    for (const [original, tool] of Object.entries(this.tools)) {
      if ([...NATIVE_TOOLS.values()].includes(original) || !tool.execute) {
        continue;
      }
      const name = `tool_${this.definitions.length}`;
      this.names.set(`aiderdesk_${name}`, original);
      this.definitions.push({
        name,
        description: `${original}: ${tool.description ?? ''}`,
        inputSchema: (await asSchema(tool.inputSchema).jsonSchema) as McpTool['inputSchema'],
      });
    }
    this.server.on('request', async (request, response) => {
      if (request.url !== `/${this.token}` || request.method !== 'POST') {
        response.writeHead(404).end();
        return;
      }
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      this.transports.add(transport);
      const server = new Server({ name: 'aiderdesk', version: '1.0.0' }, { capabilities: { tools: {} } });
      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: this.definitions,
      }));
      server.setRequestHandler(CallToolRequestSchema, async (request) => this.execute(request.params.name, request.params.arguments ?? {}));
      response.once('close', () => {
        this.transports.delete(transport);
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(request, response);
      } catch {
        if (!response.headersSent) {
          response.writeHead(500).end('MCP request failed');
        } else {
          response.end();
        }
        await server.close();
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not bind the AiderDesk MCP bridge');
    }
    return `http://127.0.0.1:${address.port}/${this.token}`;
  }

  allowCall(name: string, id: string, input: Record<string, unknown> = {}): void {
    const queue = this.pending.get(name) ?? [];
    queue.push({ id, input: JSON.stringify(canonicalInput(input)) });
    this.pending.set(name, queue);
  }

  private async execute(name: string, input: Record<string, unknown>): Promise<CallToolResult> {
    const original = this.names.get(`aiderdesk_${name}`);
    const queue = this.pending.get(`aiderdesk_${name}`);
    const index = queue?.findIndex((call) => call.input === JSON.stringify(canonicalInput(input))) ?? -1;
    const id = index >= 0 ? queue?.splice(index, 1)[0].id : undefined;
    if (!original || !id) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Uncorrelated or unapproved MCP call rejected.',
          },
        ],
      };
    }
    this.signal?.throwIfAborted();
    let execution = this.executions.get(id);
    if (!execution) {
      execution = (async (): Promise<CallToolResult> => {
        try {
          const schema = asSchema(this.tools[original].inputSchema);
          const validation = await schema.validate?.(input);
          if (validation && !validation.success) {
            throw validation.error;
          }
          const tool = this.tools[original];
          const validatedInput = validation?.success ? validation.value : input;
          let result = await tool.execute!(validatedInput, {
            toolCallId: id,
            messages: [],
            abortSignal: this.signal,
            context: {},
          });
          if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
            for await (const value of result as AsyncIterable<unknown>) {
              this.signal?.throwIfAborted();
              result = value;
            }
          }
          this.signal?.throwIfAborted();
          this.outputs.set(id, { value: result });
          if (tool.toModelOutput) {
            return toMcpResult(
              await tool.toModelOutput({
                toolCallId: id,
                input: validatedInput,
                output: result,
              }),
            );
          }
          const mcpResult = CallToolResultSchema.safeParse(result);
          if (mcpResult.success) {
            return mcpResult.data;
          }
          return {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : (JSON.stringify(result) ?? 'null'),
              },
            ],
          };
        } catch (error) {
          this.outputs.set(id, { value: `Error: ${error instanceof Error ? error.message : String(error)}` });
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
        }
      })();
      this.executions.set(id, execution);
    }
    return execution;
  }

  getOutput(id: string): { value: unknown } | undefined {
    return this.outputs.get(id);
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.transports].map((transport) => transport.close()));
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
