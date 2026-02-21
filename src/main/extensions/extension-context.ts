import type { ExtensionContext } from '@common/extensions/types';
import type { AgentProfile, Model, SettingsData, TaskData } from '@common/types';
import type { AgentProfileManager } from '@/agent';
import type { ModelManager } from '@/models';
import type { Project } from '@/project';
import type { Store } from '@/store';

import logger from '@/logger';

export class NotImplementedError extends Error {
  constructor(methodName: string) {
    super(`Method '${methodName}' is not implemented yet. This feature will be available in a future epic.`);
    this.name = 'NotImplementedError';
  }
}

export class ExtensionContextImpl implements ExtensionContext {
  constructor(
    private readonly extensionId: string,
    private readonly store?: Store,
    private readonly agentProfileManager?: AgentProfileManager,
    private readonly modelManager?: ModelManager,
    private readonly project?: Project,
    private readonly task?: TaskData,
  ) {}

  log(message: string, type: 'info' | 'error' | 'warn' | 'debug' = 'info'): void {
    const logFn = logger[type] ?? logger.info;
    logFn(`[Extension:${this.extensionId}] ${message}`);
  }

  getProjectDir(): string {
    return this.project?.baseDir ?? '';
  }

  getCurrentTask(): TaskData | null {
    return this.task || null;
  }

  async createTask(name: string, parentId?: string): Promise<string> {
    if (!this.project) {
      throw new NotImplementedError('createTask');
    }
    try {
      const params = parentId ? { name, parentId } : { name };
      const task = await this.project.createNewTask(params);
      this.log(`Created task: ${task.id}`, 'info');
      return task.id;
    } catch (error) {
      this.log(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  async createSubtask(name: string, parentTaskId: string): Promise<string> {
    if (!this.project) {
      throw new NotImplementedError('createSubtask');
    }
    try {
      const task = await this.project.createNewTask({
        name,
        parentId: parentTaskId,
      });
      this.log(`Created subtask: ${task.id} under parent: ${parentTaskId}`, 'info');
      return task.id;
    } catch (error) {
      this.log(`Failed to create subtask: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }

  async getAgentProfiles(): Promise<AgentProfile[]> {
    if (!this.agentProfileManager) {
      this.log('AgentProfileManager not available, returning empty agent profiles', 'warn');
      return [];
    }
    try {
      return this.agentProfileManager.getAllProfiles();
    } catch (error) {
      this.log(`Failed to get agent profiles: ${error}`, 'error');
      return [];
    }
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

  async showNotification(_message: string, _type?: 'info' | 'warning' | 'error'): Promise<void> {
    throw new NotImplementedError('showNotification');
  }

  async showConfirm(_message: string, _confirmText?: string, _cancelText?: string): Promise<boolean> {
    throw new NotImplementedError('showConfirm');
  }

  async showInput(_prompt: string, _placeholder?: string, _defaultValue?: string): Promise<string | undefined> {
    throw new NotImplementedError('showInput');
  }

  async getSetting(key: string): Promise<unknown> {
    if (!this.store) {
      throw new NotImplementedError('getSetting');
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

  async updateSettings(updates: Record<string, unknown>): Promise<void> {
    if (!this.store) {
      throw new NotImplementedError('updateSettings');
    }
    try {
      const currentSettings = this.store.getSettings();
      const newSettings = { ...currentSettings, ...updates } as SettingsData;
      this.store.saveSettings(newSettings);
    } catch (error) {
      this.log(`Failed to update settings: ${error}`, 'error');
      throw error;
    }
  }
}
