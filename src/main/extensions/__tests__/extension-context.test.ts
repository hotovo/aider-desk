import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionContextImpl, NotImplementedError } from '../extension-context';

import type { AgentProfile, Model, ProviderModelsData, ProviderProfile, SettingsData, TaskData } from '@common/types';
import type { AgentProfileManager } from '@/agent';
import type { ModelManager } from '@/models';
import type { Project } from '@/project';
import type { Store } from '@/store';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import logger from '@/logger';
const createMockStore = (settings: Partial<SettingsData> = {}, providers: ProviderProfile[] = []): Store => {
  const fullSettings: SettingsData = {
    language: 'en',
    theme: 'dark',
    ...settings,
  } as SettingsData;

  return {
    getSettings: vi.fn(() => fullSettings),
    saveSettings: vi.fn(),
    getProviders: vi.fn(() => providers),
  } as unknown as Store;
};

const createMockProject = (): Project => {
  return {
    createNewTask: vi.fn(),
    baseDir: '/project/path',
  } as unknown as Project;
};

const createMockAgentProfileManager = (profiles: AgentProfile[] = []): AgentProfileManager => {
  return {
    getAllProfiles: vi.fn(() => profiles),
  } as unknown as AgentProfileManager;
};

const createMockModelManager = (models: Model[] = []): ModelManager => {
  return {
    getProviderModels: vi.fn(async () => ({ models }) as ProviderModelsData),
  } as unknown as ModelManager;
};

describe('ExtensionContextImpl', () => {
  let context: ExtensionContextImpl;
  const extensionId = 'test-extension';

  beforeEach(() => {
    vi.clearAllMocks();
    context = new ExtensionContextImpl(extensionId);
  });

  describe('constructor', () => {
    it('should create context with extension id', () => {
      expect(context).toBeDefined();
    });

    it('should create context with project', () => {
      const mockProject = createMockProject();
      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);
      expect(contextWithProject.getProjectDir()).toBe('/project/path');
    });
  });

  describe('log', () => {
    it('should log info messages', () => {
      context.log('test message');

      expect(logger.info).toHaveBeenCalledWith('[Extension:test-extension] test message');
    });

    it('should log error messages', () => {
      context.log('error message', 'error');

      expect(logger.error).toHaveBeenCalledWith('[Extension:test-extension] error message');
    });

    it('should log warning messages', () => {
      context.log('warning message', 'warn');

      expect(logger.warn).toHaveBeenCalledWith('[Extension:test-extension] warning message');
    });

    it('should log debug messages', () => {
      context.log('debug message', 'debug');

      expect(logger.debug).toHaveBeenCalledWith('[Extension:test-extension] debug message');
    });

    it('should default to info log type', () => {
      context.log('default message');

      expect(logger.info).toHaveBeenCalledWith('[Extension:test-extension] default message');
    });
  });

  describe('getProjectDir', () => {
    it('should return empty string when no project is set', () => {
      expect(context.getProjectDir()).toBe('');
    });

    it('should return project path when set', () => {
      const mockProject = createMockProject();
      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);
      expect(contextWithProject.getProjectDir()).toBe('/project/path');
    });
  });

  describe('getCurrentTask', () => {
    it('should return null when no task is set', () => {
      expect(context.getCurrentTask()).toBeNull();
    });

    it('should return task when provided', () => {
      const mockTask = {
        id: 'task-1',
        baseDir: '/project',
        name: 'Test Task',
        aiderTotalCost: 0,
        agentTotalCost: 0,
        mainModel: 'test-model',
      };
      const contextWithTask = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, undefined, mockTask);

      expect(contextWithTask.getCurrentTask()).toEqual(mockTask);
    });
  });

  describe('NotImplementedError async methods', () => {
    it('createTask should throw NotImplementedError', async () => {
      try {
        await context.createTask('New Task');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotImplementedError);
        expect((error as Error).message).toContain('createTask');
      }
    });

    it('createSubtask should throw NotImplementedError', async () => {
      try {
        await context.createSubtask('Subtask', 'parent-id');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotImplementedError);
        expect((error as Error).message).toContain('createSubtask');
      }
    });

    it('showNotification should throw NotImplementedError', async () => {
      try {
        await context.showNotification('message');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotImplementedError);
        expect((error as Error).message).toContain('showNotification');
      }
    });

    it('showConfirm should throw NotImplementedError', async () => {
      try {
        await context.showConfirm('message');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotImplementedError);
        expect((error as Error).message).toContain('showConfirm');
      }
    });

    it('showInput should throw NotImplementedError', async () => {
      try {
        await context.showInput('prompt');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NotImplementedError);
        expect((error as Error).message).toContain('showInput');
      }
    });
  });

  describe('getSetting', () => {
    it('should return setting value when Store is available', async () => {
      const mockStore = createMockStore({ language: 'zh', theme: 'light' });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      const result = await contextWithStore.getSetting('language');
      expect(result).toBe('zh');
    });

    it('should support dot notation for nested settings', async () => {
      const mockStore = createMockStore({
        aider: {
          options: '--model gpt-4',
          environmentVariables: '',
          addRuleFiles: true,
          autoCommits: true,
          cachingEnabled: false,
          watchFiles: false,
          confirmBeforeEdit: false,
        },
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      const result = await contextWithStore.getSetting('aider.options');
      expect(result).toBe('--model gpt-4');
    });

    it('should return undefined for non-existent keys', async () => {
      const mockStore = createMockStore();
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      const result = await contextWithStore.getSetting('nonexistent.key');
      expect(result).toBeUndefined();
    });

    it('should throw error when Store not available', async () => {
      await expect(context.getSetting('theme')).rejects.toThrow(NotImplementedError);
    });

    it('should handle errors gracefully', async () => {
      const mockStore = createMockStore();
      vi.mocked(mockStore.getSettings).mockImplementation(() => {
        throw new Error('Store error');
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      await expect(contextWithStore.getSetting('theme')).rejects.toThrow('Store error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should call Store.saveSettings with updated settings', async () => {
      const mockStore = createMockStore({ language: 'en', theme: 'dark' });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      await contextWithStore.updateSettings({ theme: 'light' });

      expect(mockStore.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', theme: 'light' }));
    });

    it('should merge updates with existing settings', async () => {
      const mockStore = createMockStore({ language: 'en', theme: 'dark' });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      await contextWithStore.updateSettings({ language: 'zh' });

      expect(mockStore.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'zh', theme: 'dark' }));
    });

    it('should throw error when Store not available', async () => {
      await expect(context.updateSettings({ theme: 'light' })).rejects.toThrow(NotImplementedError);
    });

    it('should handle errors gracefully', async () => {
      const mockStore = createMockStore();
      vi.mocked(mockStore.saveSettings).mockImplementation(() => {
        throw new Error('Save error');
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, mockStore);

      await expect(contextWithStore.updateSettings({ theme: 'light' })).rejects.toThrow('Save error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createTask', () => {
    it('should create task using Project.createNewTask', async () => {
      const mockProject = createMockProject();
      const mockTask = { id: 'task-123', name: 'New Task' } as TaskData;
      vi.mocked(mockProject.createNewTask).mockResolvedValue(mockTask);

      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);

      const result = await contextWithProject.createTask('New Task');

      expect(result).toBe('task-123');
      expect(mockProject.createNewTask).toHaveBeenCalledWith({ name: 'New Task' });
    });

    it('should create task with parent ID', async () => {
      const mockProject = createMockProject();
      const mockTask = { id: 'task-456', name: 'Subtask' } as TaskData;
      vi.mocked(mockProject.createNewTask).mockResolvedValue(mockTask);

      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);

      const result = await contextWithProject.createTask('Subtask', 'parent-task-id');

      expect(result).toBe('task-456');
      expect(mockProject.createNewTask).toHaveBeenCalledWith({ name: 'Subtask', parentId: 'parent-task-id' });
    });

    it('should throw error when Project not available', async () => {
      await expect(context.createTask('New Task')).rejects.toThrow(NotImplementedError);
    });

    it('should handle errors from Project gracefully', async () => {
      const mockProject = createMockProject();
      vi.mocked(mockProject.createNewTask).mockRejectedValue(new Error('Task creation failed'));

      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);

      await expect(contextWithProject.createTask('New Task')).rejects.toThrow('Task creation failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('createSubtask', () => {
    it('should create subtask using Project.createNewTask with parentId', async () => {
      const mockProject = createMockProject();
      const mockTask = { id: 'subtask-789', name: 'Subtask' } as TaskData;
      vi.mocked(mockProject.createNewTask).mockResolvedValue(mockTask);

      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);

      const result = await contextWithProject.createSubtask('Subtask', 'parent-task-id');

      expect(result).toBe('subtask-789');
      expect(mockProject.createNewTask).toHaveBeenCalledWith({ name: 'Subtask', parentId: 'parent-task-id' });
    });

    it('should throw error when Project not available', async () => {
      await expect(context.createSubtask('Subtask', 'parent-id')).rejects.toThrow(NotImplementedError);
    });

    it('should handle errors from Project gracefully', async () => {
      const mockProject = createMockProject();
      vi.mocked(mockProject.createNewTask).mockRejectedValue(new Error('Subtask creation failed'));

      const contextWithProject = new ExtensionContextImpl(extensionId, undefined, undefined, undefined, mockProject);

      await expect(contextWithProject.createSubtask('Subtask', 'parent-id')).rejects.toThrow('Subtask creation failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAgentProfiles', () => {
    it('should return agent profiles from AgentProfileManager', async () => {
      const mockProfiles: AgentProfile[] = [{ id: 'profile-1', name: 'Profile 1' } as AgentProfile, { id: 'profile-2', name: 'Profile 2' } as AgentProfile];
      const mockAgentProfileManager = createMockAgentProfileManager(mockProfiles);

      const contextWithProfileManager = new ExtensionContextImpl(extensionId, undefined, mockAgentProfileManager);

      const result = await contextWithProfileManager.getAgentProfiles();
      expect(result).toEqual(mockProfiles);
    });

    it('should return empty array when AgentProfileManager not available', async () => {
      const result = await context.getAgentProfiles();
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully and return empty array', async () => {
      const mockAgentProfileManager = createMockAgentProfileManager();
      vi.mocked(mockAgentProfileManager.getAllProfiles).mockImplementation(() => {
        throw new Error('Profile error');
      });

      const contextWithProfileManager = new ExtensionContextImpl(extensionId, undefined, mockAgentProfileManager);

      const result = await contextWithProfileManager.getAgentProfiles();
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getModelConfigs', () => {
    it('should return model configs from ModelManager', async () => {
      const mockModels: Model[] = [{ id: 'model-1', providerId: 'provider-1' } as Model, { id: 'model-2', providerId: 'provider-2' } as Model];
      const mockModelManager = createMockModelManager(mockModels);

      const contextWithModelManager = new ExtensionContextImpl(extensionId, undefined, undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual(mockModels);
    });

    it('should return empty array when ModelManager not available', async () => {
      const result = await context.getModelConfigs();
      expect(result).toEqual([]);
    });

    it('should return empty array when no models in ModelManager', async () => {
      const mockModelManager = createMockModelManager([]);

      const contextWithModelManager = new ExtensionContextImpl(extensionId, undefined, undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully and return empty array', async () => {
      const mockModelManager = createMockModelManager();
      vi.mocked(mockModelManager.getProviderModels).mockImplementation(async () => {
        throw new Error('Model manager error');
      });

      const contextWithModelManager = new ExtensionContextImpl(extensionId, undefined, undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('NotImplementedError class', () => {
    it('should have correct name', () => {
      const error = new NotImplementedError('testMethod');
      expect(error.name).toBe('NotImplementedError');
    });

    it('should include method name in message', () => {
      const error = new NotImplementedError('myMethod');
      expect(error.message).toContain('myMethod');
    });

    it('should include helpful message', () => {
      const error = new NotImplementedError('someMethod');
      expect(error.message).toContain('not implemented');
      expect(error.message).toContain('future epic');
    });
  });
});
