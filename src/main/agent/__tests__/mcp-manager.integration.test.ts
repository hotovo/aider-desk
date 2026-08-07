vi.mock('@/logger');

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMCPClient, type JSONRPCMessage, type ListToolsResult, type MCPClient, type MCPTransport } from '@ai-sdk/mcp';
import { type Tool, type ToolExecutionOptions } from 'ai';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { ToolApprovalState, type AgentProfile, type McpTool } from '@common/types';

import { McpManager } from '../mcp-manager';
import { type ApprovalManager } from '../tools/approval-manager';

import { type Task } from '@/task';

type Connector = {
  client: MCPClient;
  serverName: string;
  tools: McpTool[];
  toolDefinitions: ListToolsResult;
  serverConfig: Record<string, never>;
};

type TestableMcpManager = {
  initMcpConnectors: () => Promise<Connector[]>;
};

const createProfile = (): AgentProfile =>
  ({
    enabledServers: ['test-server'],
    toolApprovals: {},
    minTimeBetweenToolCalls: 0,
  }) as AgentProfile;

const createTask = (): Task =>
  ({
    project: {
      getSettings: vi.fn(() => ({ mcpServers: {} })),
    },
    getProjectDir: vi.fn(() => '/project'),
    getTaskDir: vi.fn(() => '/project/task'),
    addLogMessage: vi.fn(),
    addToolMessage: vi.fn(),
  }) as unknown as Task;

const createApprovalManager = () =>
  ({
    handleToolApproval: vi.fn(async () => [true, undefined]),
  }) as unknown as ApprovalManager;

const createTestClient = async () => {
  const calls: Array<{ message: JSONRPCMessage; signal?: AbortSignal }> = [];
  const transport: MCPTransport = {
    start: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    send: vi.fn(async (message, options) => {
      calls.push({ message, signal: options?.signal });

      if ('method' in message && message.method === 'initialize' && 'id' in message) {
        queueMicrotask(() =>
          transport.onmessage?.({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2025-11-25',
              capabilities: { tools: {} },
              serverInfo: { name: 'test-server', version: '1.0.0' },
            },
          }),
        );
      }

      if ('method' in message && message.method === 'tools/call' && 'id' in message) {
        queueMicrotask(() =>
          transport.onmessage?.({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [
                { type: 'text', text: 'done' },
                { type: 'image', data: 'YWJj', mimeType: 'image/png' },
              ],
            },
          }),
        );
      }
    }),
  };

  const client = await createMCPClient({ transport, clientName: 'test-client', version: '1.0.0' });
  return { client, calls };
};

describe('McpManager - AI SDK MCP integration', () => {
  let manager: McpManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new McpManager();
  });

  it('creates and wraps native AI SDK MCP tools without losing schema or metadata', async () => {
    const { client, calls } = await createTestClient();
    const definitions: ListToolsResult = {
      tools: [
        {
          name: 'read_file',
          title: 'Read file',
          description: 'Reads a file',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
          _meta: { 'test/value': true },
        },
      ],
    };
    const connector: Connector = {
      client,
      serverName: 'test-server',
      serverConfig: {},
      toolDefinitions: definitions,
      tools: definitions.tools.map((tool) => ({
        serverName: 'test-server',
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
    vi.spyOn(manager as unknown as TestableMcpManager, 'initMcpConnectors').mockResolvedValue([connector]);
    const toolsFromDefinitions = vi.spyOn(client, 'toolsFromDefinitions');
    const task = createTask();
    const approvalManager = createApprovalManager();

    const toolSet = await manager.createToolset(task, createProfile(), 'openai', {}, approvalManager);
    const toolId = `test-server${TOOL_GROUP_NAME_SEPARATOR}read_file`;
    const tool = toolSet[toolId] as Tool & {
      _meta?: Record<string, unknown>;
      inputSchema: { jsonSchema: Record<string, unknown> };
    };

    expect(toolsFromDefinitions).toHaveBeenCalledOnce();
    expect(tool.inputSchema.jsonSchema.required).toEqual(['path']);
    expect(tool.title).toBe('Read file');
    expect(tool.metadata).toMatchObject({ clientName: 'test-client', toolName: 'read_file', title: 'Read file' });
    expect(tool._meta).toEqual({ 'test/value': true });

    const abortController = new AbortController();
    const result = await tool.execute?.({ path: '/tmp/file.txt' }, {
      toolCallId: 'tool-call-1',
      messages: [],
      abortSignal: abortController.signal,
      context: undefined,
    } as ToolExecutionOptions<unknown>);
    const toolCall = calls.find(({ message }) => 'method' in message && message.method === 'tools/call');

    expect(toolCall?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      content: [
        { type: 'text', text: 'done' },
        { type: 'image', data: 'YWJj', mimeType: 'image/png' },
      ],
    });
    expect(task.addToolMessage).toHaveBeenCalledWith('tool-call-1', 'test-server', 'read_file', { path: '/tmp/file.txt' }, undefined, undefined, undefined);

    const modelOutput = await tool.toModelOutput?.({
      toolCallId: 'tool-call-1',
      input: { path: '/tmp/file.txt' },
      output: result,
    });
    expect(modelOutput).toMatchObject({
      type: 'content',
      value: [
        { type: 'text', text: 'done' },
        { type: 'file', data: { type: 'data', data: 'YWJj' }, mediaType: 'image/png' },
      ],
    });

    await client.close();
  });

  it('filters disabled tools before wrapping the AI SDK toolset', async () => {
    const { client } = await createTestClient();
    const definitions: ListToolsResult = {
      tools: [
        {
          name: 'delete_file',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    };
    const connector: Connector = {
      client,
      serverName: 'test-server',
      serverConfig: {},
      toolDefinitions: definitions,
      tools: [
        {
          serverName: 'test-server',
          name: 'delete_file',
          inputSchema: definitions.tools[0].inputSchema,
        },
      ],
    };
    vi.spyOn(manager as unknown as TestableMcpManager, 'initMcpConnectors').mockResolvedValue([connector]);
    const profile = createProfile();
    profile.toolApprovals[`test-server${TOOL_GROUP_NAME_SEPARATOR}delete_file`] = ToolApprovalState.Never;

    const toolSet = await manager.createToolset(createTask(), profile, 'openai', {}, createApprovalManager());

    expect(toolSet).toEqual({});
    await client.close();
  });
});
