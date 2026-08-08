vi.mock('@/logger');

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpOAuthStatus, type McpServerConfig } from '@common/types';

import { McpAuthenticationRequiredError, McpManager } from '../mcp-manager';
import { McpOAuthManager } from '../mcp-oauth-manager';

const temporaryDirectories: string[] = [];

const createOAuthMcpServer = async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  let baseUrl = '';
  let expectedAccessToken = 'access-token';
  let refreshCount = 0;
  const mcpRequestMethods: string[] = [];

  app.get('/.well-known/oauth-protected-resource/mcp', (_req, res) => {
    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: ['org:read'],
      bearer_methods_supported: ['header'],
    });
  });
  app.get('/.well-known/oauth-authorization-server', (_req, res) => {
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ['org:read'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    });
  });
  app.post('/oauth/register', (req, res) => {
    res.status(201).json({ ...req.body, client_id: 'test-client' });
  });
  app.post('/oauth/token', (req, res) => {
    const isRefresh = req.body.grant_type === 'refresh_token';
    if (isRefresh) {
      refreshCount += 1;
    }
    res.json({
      access_token: isRefresh ? 'refreshed-access-token' : 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
  });

  app.use('/mcp', (req, res, next) => {
    mcpRequestMethods.push(req.method);
    if (req.headers.authorization !== `Bearer ${expectedAccessToken}`) {
      res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`);
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  });
  app.post('/mcp', async (req, res) => {
    const mcpServer = new McpServer({ name: 'oauth-test-server', version: '1.0.0' });
    mcpServer.registerTool(
      'list_issues',
      {
        description: 'Lists issues',
        inputSchema: {},
      },
      async () => ({ content: [{ type: 'text', text: 'No issues' }] }),
    );
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      void transport.close();
      void mcpServer.close();
    });
  });
  app.get('/mcp', (_req, res) => {
    res.status(405).end();
  });
  app.delete('/mcp', (_req, res) => {
    res.status(405).end();
  });

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    url: `${baseUrl}/mcp`,
    requireRefreshedToken: () => {
      expectedAccessToken = 'refreshed-access-token';
    },
    getRefreshCount: () => refreshCount,
    getMcpRequestMethods: () => mcpRequestMethods,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('McpManager OAuth integration', () => {
  it('discovers OAuth, completes authorization, and reconnects with the token', async () => {
    const testServer = await createOAuthMcpServer();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-desk-mcp-oauth-integration-'));
    temporaryDirectories.push(directory);
    const oauthManager = new McpOAuthManager(path.join(directory, 'credentials.json'));
    const manager = new McpManager(oauthManager);
    const config: McpServerConfig = { url: testServer.url };

    try {
      await expect(manager.getMcpServerTools('sentry', config)).rejects.toBeInstanceOf(McpAuthenticationRequiredError);
      expect(await manager.getOAuthStatus(config)).toEqual({ status: McpOAuthStatus.AuthenticationRequired });

      const authorizationUrl = new URL(await manager.startOAuth('sentry', config));
      const state = authorizationUrl.searchParams.get('state');
      expect(state).toBeTruthy();

      await manager.completeOAuth('authorization-code', state!);
      expect(await manager.getOAuthStatus(config)).toEqual({ status: McpOAuthStatus.Authenticated });
      const expectedTools = [
        {
          serverName: 'sentry',
          name: 'list_issues',
          description: 'Lists issues',
          inputSchema: { type: 'object', properties: {}, $schema: 'http://json-schema.org/draft-07/schema#' },
        },
      ];
      await expect(manager.getMcpServerTools('sentry', config)).resolves.toEqual(expectedTools);
      expect(testServer.getMcpRequestMethods()[0]).toBe('POST');

      testServer.requireRefreshedToken();
      await expect(manager.reloadSingleServer('sentry', config)).resolves.toEqual(expectedTools);
      expect(testServer.getRefreshCount()).toBe(1);
    } finally {
      await manager.close();
      await testServer.close();
    }
  });
});
