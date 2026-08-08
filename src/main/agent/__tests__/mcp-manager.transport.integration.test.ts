vi.mock('@/logger');

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';
import { type McpServerConfig } from '@common/types';

import { McpManager } from '../mcp-manager';

type TestableMcpManager = {
  initMcpConnectors: (
    mcpServers: Record<string, McpServerConfig>,
    projectDir: string | null,
    taskDir: string | null,
    forceReload: boolean,
    enabledServers: string[],
  ) => Promise<unknown[]>;
};

type ClientMessage = {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: {
    protocolVersion?: string;
  };
};

const readMessage = async (request: IncomingMessage): Promise<ClientMessage> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ClientMessage;
};

const writeResult = (response: ServerResponse, id: string | number, result: Record<string, unknown>) => {
  response.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id, result })}\n\n`);
};

const createLegacySseServer = async () => {
  let sseResponse: ServerResponse | null = null;
  let streamableHttpProbeCount = 0;
  let sseConnectionCount = 0;
  const receivedHeaderValues: Array<string | undefined> = [];

  const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const header = request.headers['x-test-header'];
    receivedHeaderValues.push(Array.isArray(header) ? header[0] : header);

    if (request.method === 'POST' && request.url === '/sse') {
      streamableHttpProbeCount += 1;
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Cannot POST /sse');
      return;
    }

    if (request.method === 'GET' && request.url === '/sse') {
      sseConnectionCount += 1;
      sseResponse = response;
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.write('event: endpoint\ndata: /message\n\n');
      response.on('close', () => {
        if (sseResponse === response) {
          sseResponse = null;
        }
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/message') {
      const message = await readMessage(request);
      response.writeHead(202);
      response.end();

      if (message.id === undefined || !sseResponse) {
        return;
      }

      if (message.method === 'initialize') {
        writeResult(sseResponse, message.id, {
          protocolVersion: message.params?.protocolVersion ?? '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'legacy-sse-server', version: '1.0.0' },
        });
        return;
      }

      if (message.method === 'tools/list') {
        writeResult(sseResponse, message.id, {
          tools: [
            {
              name: 'read_graph',
              description: 'Reads the graph',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        });
      }
      return;
    }

    response.writeHead(404);
    response.end();
  };

  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      response.writeHead(500);
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      reject(error);
    };
    server.once('error', handleError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', handleError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine test server address');
  }

  return {
    url: `http://127.0.0.1:${address.port}/sse`,
    getStreamableHttpProbeCount: () => streamableHttpProbeCount,
    getSseConnectionCount: () => sseConnectionCount,
    getReceivedHeaderValues: () => receivedHeaderValues,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        server.closeAllConnections();
      }),
  };
};

describe('McpManager remote transport fallback', () => {
  it('falls back to legacy SSE without opening an SSE connection during the Streamable HTTP probe', async () => {
    const testServer = await createLegacySseServer();
    const manager = new McpManager();

    try {
      const config: McpServerConfig = {
        url: testServer.url,
        headers: { 'X-Test-Header': 'test-value' },
      };
      const tools = await manager.getMcpServerTools('legacy-sse-server', config);
      const connectors = await (manager as unknown as TestableMcpManager).initMcpConnectors({ 'legacy-sse-server': config }, '/project', '/project', false, [
        'legacy-sse-server',
      ]);

      expect(tools).toEqual([
        {
          serverName: 'legacy-sse-server',
          name: 'read_graph',
          description: 'Reads the graph',
          inputSchema: { type: 'object', properties: {} },
        },
      ]);
      expect(connectors).toHaveLength(1);
      expect(testServer.getStreamableHttpProbeCount()).toBe(1);
      expect(testServer.getSseConnectionCount()).toBe(1);
      expect(new Set(testServer.getReceivedHeaderValues())).toEqual(new Set(['test-value']));
    } finally {
      await manager.close();
      await testServer.close();
    }
  });
});
