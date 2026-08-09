import * as fs from 'fs/promises';
import * as path from 'path';

import { FSWatcher, watch } from 'chokidar';
import { debounce } from 'lodash';
import { fileExists } from '@common/utils';

import type { McpServerConfig, SettingsData } from '@common/types';
import type { Store } from '@/store';

import { AIDER_DESK_DIR, AIDER_DESK_HOME_DIR, AIDER_DESK_MCP_SERVERS_FILE } from '@/constants';
import logger from '@/logger';
import { EventManager } from '@/events';
import { shouldUsePolling } from '@/utils/file-watch';

const getGlobalMcpServersPath = (): string => path.join(AIDER_DESK_HOME_DIR, AIDER_DESK_MCP_SERVERS_FILE);
const getProjectMcpServersPath = (projectDir: string): string => path.join(projectDir, AIDER_DESK_DIR, AIDER_DESK_MCP_SERVERS_FILE);

interface McpServersFileContent {
  mcpServers: Record<string, McpServerConfig>;
}

export class McpConfigManager {
  private globalServers: Record<string, McpServerConfig> = {};
  private projectServers: Map<string, Record<string, McpServerConfig>> = new Map();
  private fileWatchers: Map<string, FSWatcher> = new Map(); // filePath -> watcher

  constructor(
    private readonly eventManager: EventManager,
    private readonly store: Store,
  ) {}

  public async init(): Promise<void> {
    const globalPath = getGlobalMcpServersPath();
    await this.ensureFileExists(globalPath);
    this.globalServers = await this.loadServersFromFile(globalPath);
    await this.setupWatcherForFile(globalPath);
  }

  public async initializeForProject(projectDir: string): Promise<void> {
    logger.debug(`Initializing MCP servers for project: ${projectDir}`);

    const projectPath = getProjectMcpServersPath(projectDir);
    const servers = await this.loadServersFromFile(projectPath);
    this.projectServers.set(projectDir, servers);

    await this.setupWatcherForFile(projectPath);
    this.sendMcpServersUpdated();
  }

  public removeProject(projectDir: string): void {
    logger.debug(`Removing MCP servers for project: ${projectDir}`);

    const projectPath = getProjectMcpServersPath(projectDir);
    this.projectServers.delete(projectDir);

    const watcher = this.fileWatchers.get(projectPath);
    if (watcher) {
      void watcher.close();
      this.fileWatchers.delete(projectPath);
    }
  }

  public getGlobalServers(): Record<string, McpServerConfig> {
    return { ...this.globalServers };
  }

  public getProjectServers(projectDir: string): Record<string, McpServerConfig> {
    return { ...(this.projectServers.get(projectDir) || {}) };
  }

  public getMergedServers(projectDir?: string | null): Record<string, McpServerConfig> {
    if (!projectDir) {
      return this.getGlobalServers();
    }
    return {
      ...this.globalServers,
      ...(this.projectServers.get(projectDir) || {}),
    };
  }

  public getState(): { global: Record<string, McpServerConfig>; projectServers: Record<string, Record<string, McpServerConfig>> } {
    const projectServers: Record<string, Record<string, McpServerConfig>> = {};
    for (const [projectDir, servers] of this.projectServers.entries()) {
      projectServers[projectDir] = servers;
    }
    return {
      global: this.getGlobalServers(),
      projectServers,
    };
  }

  public sendMcpServersUpdated(): void {
    this.eventManager.sendMcpServersUpdated(this.getState());
  }

  public async addServer(projectDir: string | undefined, name: string, config: McpServerConfig): Promise<void> {
    const servers = { ...(projectDir ? this.getProjectServers(projectDir) : this.getGlobalServers()) };
    servers[name] = config;
    await this.saveServers(projectDir, servers);
  }

  public async updateServer(projectDir: string | undefined, oldName: string, name: string, config: McpServerConfig): Promise<void> {
    const servers = { ...(projectDir ? this.getProjectServers(projectDir) : this.getGlobalServers()) };
    if (oldName !== name) {
      delete servers[oldName];
    }
    servers[name] = config;
    await this.saveServers(projectDir, servers);
  }

  public async removeServer(projectDir: string | undefined, name: string): Promise<void> {
    const servers = { ...(projectDir ? this.getProjectServers(projectDir) : this.getGlobalServers()) };
    delete servers[name];
    await this.saveServers(projectDir, servers);
  }

  public async replaceServers(projectDir: string | undefined, servers: Record<string, McpServerConfig>): Promise<void> {
    await this.saveServers(projectDir, { ...servers });
  }

  private async saveServers(projectDir: string | undefined, servers: Record<string, McpServerConfig>): Promise<void> {
    const filePath = projectDir ? getProjectMcpServersPath(projectDir) : getGlobalMcpServersPath();
    await this.writeServersToFile(filePath, servers);

    if (projectDir) {
      this.projectServers.set(projectDir, servers);
    } else {
      this.globalServers = servers;
    }

    await this.setupWatcherForFile(filePath);
    this.sendMcpServersUpdated();
  }

  private async ensureFileExists(filePath: string): Promise<void> {
    if (await fileExists(filePath)) {
      return;
    }
    await this.writeServersToFile(filePath, {});
  }

  private async loadServersFromFile(filePath: string): Promise<Record<string, McpServerConfig>> {
    try {
      if (!(await fileExists(filePath))) {
        return {};
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as McpServersFileContent;
      return parsed.mcpServers || {};
    } catch (err) {
      logger.error(`Failed to load MCP servers from ${filePath}: ${err}`);
      return {};
    }
  }

  private async writeServersToFile(filePath: string, servers: Record<string, McpServerConfig>): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const content: McpServersFileContent = { mcpServers: servers };
      await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
    } catch (err) {
      logger.error(`Failed to save MCP servers to ${filePath}: ${err}`);
      throw err;
    }
  }

  private async setupWatcherForFile(filePath: string): Promise<void> {
    if (this.fileWatchers.has(filePath)) {
      return;
    }

    const watcher = watch(filePath, {
      persistent: true,
      usePolling: shouldUsePolling(filePath, this.store.getSettings().fileWatchMode),
      ignoreInitial: true,
    });

    const reloadFunction = () => this.debounceReloadFile(filePath);

    watcher
      .on('add', reloadFunction)
      .on('change', reloadFunction)
      .on('unlink', reloadFunction)
      .on('error', (error) => {
        logger.error(`MCP servers file watcher error for ${filePath}: ${error}`);
      });

    this.fileWatchers.set(filePath, watcher);
  }

  private debounceReloadFile = debounce(async (filePath: string) => {
    await this.reloadFile(filePath);
  }, 1000);

  private async reloadFile(filePath: string): Promise<void> {
    logger.debug(`Reloading MCP servers from ${filePath}`);
    const servers = await this.loadServersFromFile(filePath);

    if (filePath === getGlobalMcpServersPath()) {
      this.globalServers = servers;
    } else {
      for (const projectDir of this.projectServers.keys()) {
        if (getProjectMcpServersPath(projectDir) === filePath) {
          this.projectServers.set(projectDir, servers);
          break;
        }
      }
    }

    this.sendMcpServersUpdated();
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData): Promise<void> {
    if (oldSettings.fileWatchMode === newSettings.fileWatchMode) {
      return;
    }

    const watchedFiles = Array.from(this.fileWatchers.keys());
    for (const watcher of this.fileWatchers.values()) {
      await watcher.close();
    }
    this.fileWatchers.clear();

    for (const filePath of watchedFiles) {
      await this.setupWatcherForFile(filePath);
    }
  }

  async dispose(): Promise<void> {
    for (const watcher of this.fileWatchers.values()) {
      await watcher.close();
    }
    this.fileWatchers.clear();
    this.projectServers.clear();
  }
}
