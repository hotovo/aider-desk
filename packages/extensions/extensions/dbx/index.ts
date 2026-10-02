import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ContainerState, ensureDbxRunning, getDbxStatus, stopDbxContainer } from './core.js';

import type { DbxStatus } from './core.js';
import type { Extension, ExtensionContext, UIComponentDefinition } from '@aiderdesk/extensions';

/**
 * Mirrors ProjectStartedEvent/ProjectStoppedEvent from the extension API.
 * Declared locally because the generated extensions.d.ts can lag behind.
 */
interface ProjectStartedEvent {
  readonly baseDir: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
const dbxComponentJsx = readFileSync(join(__dirname, './ui/Dbx.jsx'), 'utf-8');

const COMPONENT_ID = 'dbx-main';
const configPath = join(__dirname, 'config.json');

interface DbxConfig {
  mode: 'docker' | 'url';
  url: string;
  drives: string[];
}

const DEFAULT_CONFIG: DbxConfig = {
  mode: 'docker',
  url: '',
  drives: [],
};

export default class DbxExtension implements Extension {
  static metadata = {
    name: 'DBX',
    version: '1.0.0',
    description: 'DBX database client UI running in a local testcontainers-backed container, embedded in a modal',
    author: 'AiderDesk',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/dbx/icon.png',
    capabilities: ['ui'],
  };

  private configPathLocal = configPath;

  private getConfigDataSync(): DbxConfig {
    try {
      if (existsSync(this.configPathLocal)) {
        const parsed = JSON.parse(readFileSync(this.configPathLocal, 'utf-8'));
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // fall back to defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  private async startContainer(context: ExtensionContext): Promise<void> {
    const config = this.getConfigDataSync();
    if (config.mode !== 'docker') {
      return;
    }
    const mounts = (config.drives || []).filter((drive) => existsSync(drive)).map((drive) => ({ source: resolve(drive) }));
    for (const drive of config.drives || []) {
      if (!existsSync(drive)) {
        context.log(`[dbx] configured drive does not exist, skipping: ${drive}`, 'warn');
      }
    }
    await ensureDbxRunning(context, mounts);
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('[dbx] extension loaded (UI only, no tools/commands)', 'info');
    void this.startContainer(context);
  }

  onUnload(): void {
    void stopDbxContainer().catch(() => {});
  }

  async onProjectStarted(_event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    void this.startContainer(context);
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: COMPONENT_ID,
        placement: 'header-right',
        jsx: dbxComponentJsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string): Promise<unknown> {
    if (componentId !== COMPONENT_ID) {
      return undefined;
    }

    const config = this.getConfigDataSync();
    const state = getDbxStatus();

    if (config.mode === 'url') {
      const status: DbxStatus = { containerState: ContainerState.Started, url: config.url, error: '' };
      return status;
    }

    return state;
  }

  async executeUIExtensionAction(componentId: string, action: string, _args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) {
      return { success: false };
    }

    if (action === 'get-status') {
      const config = this.getConfigDataSync();
      const state = getDbxStatus();
      return config.mode === 'url' ? { containerState: ContainerState.Started, url: config.url, error: '' } : state;
    }

    if (action === 'start-container') {
      if (getDbxStatus().containerState === ContainerState.Starting) {
        return getDbxStatus();
      }
      await this.startContainer(context);
      return this.getUIExtensionData(componentId);
    }

    return { success: false, error: `unknown action: ${action}` };
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<unknown> {
    return this.getConfigDataSync();
  }

  async saveConfigData(configData: unknown, context: ExtensionContext): Promise<unknown> {
    const previous = this.getConfigDataSync();
    const merged: DbxConfig = { ...DEFAULT_CONFIG, ...(configData as Partial<DbxConfig>) };
    writeFileSync(this.configPathLocal, JSON.stringify(merged, null, 2), 'utf-8');

    // Docker mounts are set at container creation - restart it when drives change
    if (merged.mode === 'docker' && JSON.stringify(previous.drives || []) !== JSON.stringify(merged.drives || [])) {
      await stopDbxContainer();
      void this.startContainer(context);
    }

    context.triggerUIDataRefresh(COMPONENT_ID);
    return merged;
  }
}
