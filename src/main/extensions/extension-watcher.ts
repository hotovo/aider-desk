import { FSWatcher, watch } from 'chokidar';

import logger from '@/logger';
import { ExtensionManager } from '@/extensions/extension-manager';
import { Project } from '@/project';

export class ExtensionWatcher {
  private watcher: FSWatcher | null = null;
  private readonly debounceMs = 300;
  private pendingReloads = new Map<string, NodeJS.Timeout>();
  private started = false;

  constructor(
    private readonly extensionManager: ExtensionManager,
    private readonly directory: string,
    private readonly project?: Project,
  ) {}

  start(): void {
    if (this.started) {
      return;
    }

    const pattern = `${this.directory}/**/*.ts`;

    this.watcher = watch(pattern, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watcher
      .on('change', (filePath) => this.handleFileChange(filePath))
      .on('add', (filePath) => this.handleFileChange(filePath))
      .on('unlink', (filePath) => this.handleFileDelete(filePath));

    this.started = true;
    logger.info(`[Extensions] Hot reload watcher started for ${this.directory}`);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    for (const timeout of this.pendingReloads.values()) {
      clearTimeout(timeout);
    }
    this.pendingReloads.clear();
    this.started = false;
  }

  isWatching(): boolean {
    return this.started && this.watcher !== null;
  }

  private handleFileChange(filePath: string): void {
    const existing = this.pendingReloads.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      this.pendingReloads.delete(filePath);
      this.extensionManager.reloadExtension(filePath, this.project).catch((error) => {
        logger.error(`[Extensions] Hot reload failed for ${filePath}:`, error);
      });
    }, this.debounceMs);

    this.pendingReloads.set(filePath, timeout);
  }

  private handleFileDelete(filePath: string): void {
    const existing = this.pendingReloads.get(filePath);
    if (existing) {
      clearTimeout(existing);
      this.pendingReloads.delete(filePath);
    }

    this.extensionManager.unloadExtension(filePath).catch((error) => {
      logger.error(`[Extensions] Unload failed for ${filePath}:`, error);
    });
  }
}
