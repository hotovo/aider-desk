import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const McpServerConfigSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const LoadMcpServerToolsSchema = z.object({
  serverName: z.string().min(1, 'Server name is required'),
  config: McpServerConfigSchema.optional(),
});

const ReloadMcpServersSchema = z.object({
  mcpServers: z.record(z.string(), McpServerConfigSchema),
  force: z.boolean().optional(),
});

const ReloadMcpServerSchema = z.object({
  serverName: z.string().min(1, 'Server name is required'),
  config: McpServerConfigSchema,
});

const OAuthCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
});

const OAUTH_SUCCESS_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>AiderDesk</title></head><body><h1>Authentication complete</h1><p>You can close this window and return to AiderDesk.</p></body></html>';
const OAUTH_ERROR_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>AiderDesk</title></head><body><h1>Authentication failed</h1><p>Return to AiderDesk and try connecting the MCP server again.</p></body></html>';

export class McpApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Load MCP server tools
    router.post(
      '/mcp/tools',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadMcpServerToolsSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { serverName, config } = parsed;
        const tools = await this.eventsHandler.loadMcpServerTools(serverName, config);
        res.status(200).json(tools);
      }),
    );

    router.post(
      '/mcp/oauth/status',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadMcpServerToolsSchema, req.body, res);
        if (!parsed) {
          return;
        }
        const status = await this.eventsHandler.getMcpOAuthStatus(parsed.serverName, parsed.config);
        res.status(200).json(status);
      }),
    );

    router.post(
      '/mcp/oauth/connect',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadMcpServerToolsSchema, req.body, res);
        if (!parsed) {
          return;
        }
        const authorizationUrl = await this.eventsHandler.startMcpOAuth(parsed.serverName, parsed.config);
        res.status(200).json({ authorizationUrl });
      }),
    );

    router.post(
      '/mcp/oauth/disconnect',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadMcpServerToolsSchema, req.body, res);
        if (!parsed) {
          return;
        }
        await this.eventsHandler.disconnectMcpOAuth(parsed.serverName, parsed.config);
        res.status(204).send();
      }),
    );

    router.get('/mcp/oauth/callback', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('Referrer-Policy', 'no-referrer');
      const parsed = OAuthCallbackSchema.safeParse(req.query);
      if (!parsed.success || !parsed.data.state) {
        res.status(400).type('html').send(OAUTH_ERROR_HTML);
        return;
      }
      if (parsed.data.error) {
        try {
          await this.eventsHandler.cancelMcpOAuth(parsed.data.state);
        } catch {
          res.status(400).type('html').send(OAUTH_ERROR_HTML);
          return;
        }
        res.status(400).type('html').send(OAUTH_ERROR_HTML);
        return;
      }
      if (!parsed.data.code) {
        res.status(400).type('html').send(OAUTH_ERROR_HTML);
        return;
      }
      try {
        await this.eventsHandler.completeMcpOAuth(parsed.data.code, parsed.data.state);
        res.status(200).type('html').send(OAUTH_SUCCESS_HTML);
      } catch {
        res.status(400).type('html').send(OAUTH_ERROR_HTML);
      }
    });

    // Reload MCP servers
    router.post(
      '/mcp/reload',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ReloadMcpServersSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { mcpServers, force } = parsed;
        await this.eventsHandler.reloadMcpServers(mcpServers, force);
        res.status(200).json({ message: 'MCP servers reloaded' });
      }),
    );

    // Reload single MCP server
    router.post(
      '/mcp/reload-single',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ReloadMcpServerSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { serverName, config } = parsed;
        const tools = await this.eventsHandler.reloadMcpServer(serverName, config);
        res.status(200).json(tools);
      }),
    );
  }
}
