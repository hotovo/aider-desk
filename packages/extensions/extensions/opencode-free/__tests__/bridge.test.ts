import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { jsonSchema } from 'ai';

import { ToolBridge } from '../bridge';

import type { Tool } from 'ai';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.allSettled(cleanup.splice(0).map((close) => close()));
});

const setup = async (overrides: Partial<Tool> = {}) => {
  const execute = vi.fn(async () => 'token');
  const native = vi.fn();
  const bridge = new ToolBridge({
    'test---token': {
      inputSchema: jsonSchema({ type: 'object', properties: {} }),
      execute,
      ...overrides,
    },
    'power---bash': {
      inputSchema: jsonSchema({ type: 'object', properties: {} }),
      execute: native,
    },
    'power---file_read': {
      inputSchema: jsonSchema({ type: 'object', properties: {} }),
      execute: native,
    },
  });
  const url = await bridge.start();
  cleanup.push(() => bridge.close());
  const client = new Client({ name: 'test', version: '1.0.0' });
  cleanup.push(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return { bridge, client, execute, native, url };
};

describe('AiderDesk OpenCode MCP bridge', () => {
  it('discovers enabled MCP tools but excludes native shell and read', async () => {
    const { client, bridge } = await setup();
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name)).toEqual(['tool_0']);
    expect(bridge.names.get('aiderdesk_tool_0')).toBe('test---token');
  });

  it('does not execute an uncorrelated call', async () => {
    const { client, execute } = await setup();
    const result = await client.callTool({ name: 'tool_0', arguments: {} });
    expect(result.isError).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves the OpenCode call ID and executes exactly once', async () => {
    const { client, execute, bridge } = await setup();
    bridge.allowCall('aiderdesk_tool_0', 'call-1');
    const result = await client.callTool({ name: 'tool_0', arguments: {} });
    expect(result).toMatchObject({
      content: [{ type: 'text', text: 'token' }],
    });
    expect(execute).toHaveBeenCalledExactlyOnceWith({}, expect.objectContaining({ toolCallId: 'call-1' }));
    bridge.allowCall('aiderdesk_tool_0', 'call-1');
    const replay = await client.callTool({ name: 'tool_0', arguments: {} });
    expect(replay).toEqual(result);
    expect(execute).toHaveBeenCalledOnce();
    expect(bridge.getOutput('call-1')).toEqual({ value: 'token' });
  });

  it('correlates parallel invocations by input even when requests arrive out of order', async () => {
    const { client, execute, bridge } = await setup();
    bridge.allowCall('aiderdesk_tool_0', 'first', { index: 1 });
    bridge.allowCall('aiderdesk_tool_0', 'second', { index: 2 });
    await client.callTool({ name: 'tool_0', arguments: { index: 2 } });
    await client.callTool({ name: 'tool_0', arguments: { index: 1 } });
    expect(execute).toHaveBeenNthCalledWith(1, { index: 2 }, expect.objectContaining({ toolCallId: 'second' }));
    expect(execute).toHaveBeenNthCalledWith(2, { index: 1 }, expect.objectContaining({ toolCallId: 'first' }));
  });

  it('rejects arguments that differ from the observed call', async () => {
    const { client, execute, bridge } = await setup();
    bridge.allowCall('aiderdesk_tool_0', 'first', { index: 1 });
    const result = await client.callTool({ name: 'tool_0', arguments: { index: 2 } });
    expect(result.isError).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it('uses original output conversion and preserves error status', async () => {
    const convert = vi.fn(async () => ({ type: 'error-text' as const, value: 'converted error' }));
    const { client, execute, bridge } = await setup({ toModelOutput: convert });
    bridge.allowCall('aiderdesk_tool_0', 'first');
    const result = await client.callTool({ name: 'tool_0', arguments: {} });
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'converted error' }] });
    expect(convert).toHaveBeenCalledExactlyOnceWith({ toolCallId: 'first', input: {}, output: 'token' });
    expect(bridge.getOutput('first')).toEqual({ value: 'token' });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects requests without the unguessable endpoint path', async () => {
    const { url } = await setup();
    const result = await fetch(new URL('/wrong', url), { method: 'POST' });
    expect(result.status).toBe(404);
  });

  it('never executes a correlated tool after cancellation', async () => {
    const { client, execute, bridge } = await setup();
    bridge.signal = AbortSignal.abort();
    bridge.allowCall('aiderdesk_tool_0', 'call-1');
    await expect(client.callTool({ name: 'tool_0', arguments: {} })).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
