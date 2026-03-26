import { ProjectContextImpl } from './project-context';
import { TaskContextImpl } from './task-context';

import type { ExtensionContext, ProjectContext, TaskContext } from '@common/extensions';
import type { Model, SettingsData } from '@common/types';
import type { EventManager } from '@/events';
import type { ModelManager } from '@/models';
import type { Project } from '@/project';
import type { Store } from '@/store';
import type { Task } from '@/task';

import logger from '@/logger';
import { openUrl as openUrlUtil } from '@/utils/open-url';

export class ExtensionContextImpl implements ExtensionContext {
  constructor(
    private readonly extensionId: string,
    private readonly extensionName: string,
    private readonly store?: Store,
    private readonly modelManager?: ModelManager,
    private readonly eventManager?: EventManager,
    private readonly project?: Project,
    private readonly task?: Task,
  ) {}

  log(message: string, type: 'info' | 'error' | 'warn' | 'debug' = 'info'): void {
    const logFn = logger[type];
    logFn(`[Extension:${this.extensionName}] ${message}`);
  }

  getProjectDir(): string {
    return this.project?.baseDir ?? '';
  }

  getTaskContext(): TaskContext | null {
    return this.task ? new TaskContextImpl(this.task) : null;
  }

  getProjectContext(): ProjectContext {
    if (!this.project) {
      throw new Error('Project context not available');
    }
    return new ProjectContextImpl(this.project);
  }

  async getModelConfigs(): Promise<Model[]> {
    if (!this.modelManager) {
      this.log('ModelManager not available, returning empty model configs', 'warn');
      return [];
    }
    try {
      const providerModelsData = await this.modelManager.getProviderModels();
      return providerModelsData.models || [];
    } catch (error) {
      this.log(`Failed to get model configs: ${error}`, 'error');
      return [];
    }
  }

  async getSetting(key: string): Promise<unknown> {
    if (!this.store) {
      throw new Error('Store not available');
    }
    try {
      const settings = this.store.getSettings();
      return key.split('.').reduce<unknown>((obj: unknown, k: string) => {
        if (obj && typeof obj === 'object') {
          return (obj as Record<string, unknown>)[k];
        }
        return undefined;
      }, settings);
    } catch (error) {
      this.log(`Failed to get setting '${key}': ${error}`, 'error');
      throw error;
    }
  }

  async updateSettings(updates: Partial<SettingsData>): Promise<void> {
    if (!this.store) {
      throw new Error('Store not available');
    }
    try {
      const currentSettings = this.store.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      this.store.saveSettings(newSettings);
      this.eventManager?.sendSettingsUpdated(newSettings);
    } catch (error) {
      this.log(`Failed to update settings: ${error}`, 'error');
      throw error;
    }
  }

  triggerUIDataRefresh(componentId?: string, taskId?: string): void {
    if (!this.eventManager) {
      this.log('EventManager not available, cannot trigger UI data refresh', 'warn');
      return;
    }
    this.log(`Triggering UI data refresh for component: ${componentId}, task: ${taskId}`, 'debug');
    this.eventManager.sendExtensionUIRefresh({
      projectDir: this.project?.baseDir,
      extensionId: this.extensionId,
      componentId,
      taskId,
    });
  }

  triggerUIComponentsReload(): void {
    if (!this.eventManager) {
      this.log('EventManager not available, cannot trigger UI components reload', 'warn');
      return;
    }
    this.log('Triggering UI components reload', 'debug');
    this.eventManager.sendExtensionUIRefresh({
      projectDir: this.project?.baseDir,
      extensionId: this.extensionId,
      reloadComponents: true,
    });
  }

  async openUrl(url: string, target: 'external' | 'window' | 'modal-overlay' = 'window'): Promise<void> {
    this.log(`Opening URL: ${url} (target: ${target})`);
    try {
      if (target === 'modal-overlay') {
        if (!this.eventManager) {
          this.log('EventManager not available, cannot open URL in modal overlay', 'warn');
          return;
        }
        this.eventManager.sendModalOverlayUrl(url);
      } else {
        await openUrlUtil(url, target);
      }
    } catch (error) {
      this.log(`Failed to open URL: ${error}`, 'error');
      throw error;
    }
  }

  async openPath(path: string): Promise<boolean> {
    this.log(`Opening path: ${path}`);
    try {
      const { shell } = await import('electron');
      await shell.openPath(path);
      return true;
    } catch (error) {
      this.log(`Failed to open path: ${error}`, 'error');
      return false;
    }
  }
}
