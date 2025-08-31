import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const LoadMcpServerToolsSchema = z.object({
  serverName: z.string().min(1, 'Server name is required'),
  config: z.any().optional(), // TODO: Refine based on McpServerConfig type
});

const ReloadMcpServersSchema = z.object({
  mcpServers: z.record(z.string(), z.any()), // TODO: Refine based on Record<string, McpServerConfig>
  force: z.boolean().optional(),
});

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
  }
}
