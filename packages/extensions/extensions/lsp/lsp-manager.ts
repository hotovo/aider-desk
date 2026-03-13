import path from 'path';

import { LspClient } from './lsp-client';
import { getServerForExtension, SERVERS, type LspServerInfo } from './lsp-servers';

import type { ExtensionContext } from '@aiderdesk/extensions';

export class LspManager {
  private clients: Map<string, LspClient> = new Map();
  private brokenServers: Set<string> = new Set();
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  async getClient(filePath: string, projectDir: string): Promise<LspClient | null> {
    const ext = path.extname(filePath);
    const serverInfo = getServerForExtension(ext);
    if (!serverInfo) {
      return null;
    }

    return this.getOrCreateClient(serverInfo, projectDir);
  }

  private async getOrCreateClient(serverInfo: LspServerInfo, projectDir: string): Promise<LspClient | null> {
    const cacheKey = `${projectDir}:${serverInfo.id}`;

    if (this.brokenServers.has(cacheKey)) {
      this.context.log(`LSP server ${serverInfo.id} is broken, skipping`, 'debug');
      return null;
    }

    let client = this.clients.get(cacheKey);
    if (client) {
      return client;
    }

    try {
      const handle = await serverInfo.spawn(projectDir, this.context);
      if (!handle) {
        this.brokenServers.add(cacheKey);
        return null;
      }

      client = new LspClient({
        serverInfo,
        handle,
        rootDir: projectDir,
        context: this.context,
      });

      await client.initialize();
      this.clients.set(cacheKey, client);
      return client;
    } catch (error) {
      this.brokenServers.add(cacheKey);
      this.context.log(`Failed to spawn LSP server ${serverInfo.id}: ${error}`, 'error');
      return null;
    }
  }

  async notifyFileChanged(filePath: string, projectDir: string): Promise<void> {
    const client = await this.getClient(filePath, projectDir);
    if (client) {
      await client.notifyFileChanged(filePath);
    }
  }

  async getDiagnostics(filePath: string, projectDir: string): Promise<Map<string, LspClient[]>> {
    const results = new Map<string, LspClient[]>();

    for (const [key, client] of this.clients) {
      if (key.startsWith(`${projectDir}:`)) {
        const diags = client.getDiagnostics(filePath);
        if (diags.length > 0) {
          results.set(filePath, [client]);
        }
      }
    }

    return results;
  }

  getSupportedExtensions(): string[] {
    return SERVERS.flatMap((s) => s.extensions);
  }

  isExtensionSupported(extension: string): boolean {
    return SERVERS.some((s) => s.extensions.includes(extension));
  }

  async shutdown(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.shutdown();
    }
    this.clients.clear();
    this.brokenServers.clear();
  }

  async shutdownProject(projectDir: string): Promise<void> {
    const keysToRemove: string[] = [];

    for (const [key, client] of this.clients) {
      if (key.startsWith(`${projectDir}:`)) {
        await client.shutdown();
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.clients.delete(key);
      this.brokenServers.delete(key);
    }
  }
}
