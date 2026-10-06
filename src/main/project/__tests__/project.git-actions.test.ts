// Mock all dependencies BEFORE importing the test file
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/store');
vi.mock('@/agent');
vi.mock('@/data-manager');
vi.mock('@/models');
vi.mock('@/custom-commands');
vi.mock('@/telemetry');
vi.mock('@/events');
vi.mock('@/project/migrations');
vi.mock('@/git');
vi.mock('@/memory/memory-manager');
vi.mock('@/prompts');
vi.mock('@/extensions/extension-manager');
vi.mock('@/constants');
vi.mock('@/utils');
vi.mock('fs/promises');
vi.mock('@/utils/atomic-write');
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `uuid-${String(uuidCounter++).padStart(8, '0')}-${Math.random()}`),
}));

import * as fs from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Project } from '../project';

import { McpManager, AgentProfileManager } from '@/agent';
import { DataManager } from '@/data-manager';
import { EventManager } from '@/events';
import { MemoryManager } from '@/memory/memory-manager';
import { ModelManager } from '@/models';
import { PromptsManager } from '@/prompts';
import { ExtensionManager } from '@/extensions/extension-manager';
import { Store } from '@/store';
import { Task } from '@/task';
import { TelemetryManager } from '@/telemetry';
import { GitManager } from '@/git';
import { migrateSessionsToTasks } from '@/project/migrations';

describe('Project - listBranches', () => {
  let project: Project;
  let mockGitManager: Partial<GitManager>;
  let baseDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;

    baseDir = '/test/project';

    const mockStore = {
      getSettings: vi.fn(() => ({ taskSettings: { defaultWorkingMode: 'local' } })),
    };
    const mockEventManager = {
      sendTaskCreated: vi.fn(),
      sendProjectStarted: vi.fn(),
      sendTaskUpdated: vi.fn(),
      sendContextFilesUpdated: vi.fn(),
      sendInputHistoryUpdated: vi.fn(),
      sendTaskDeleted: vi.fn(),
    };
    const mockModelManager = {
      getProviderModels: vi.fn(() => Promise.resolve({ models: [] })),
      getAiderModelMapping: vi.fn(() => ({ modelName: 'default-model', environmentVariables: {} })),
    };
    mockGitManager = {
      close: vi.fn(() => Promise.resolve()),
      listBranches: vi.fn(() => Promise.resolve([])),
    };
    const mockAgentProfileManager = {
      initializeForProject: vi.fn(() => Promise.resolve()),
      removeProject: vi.fn(),
    };
    const mockPromptsManager = {
      watchProject: vi.fn(() => Promise.resolve()),
      unwatchProject: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(),
    } as unknown as PromptsManager;
    (mockPromptsManager as any).start = vi.fn(() => Promise.resolve());
    const mockExtensionManager = {
      reloadProjectExtensions: vi.fn(() => Promise.resolve()),
      stopProjectWatcher: vi.fn(),
      dispatchEvent: vi.fn(() => Promise.resolve({} as any)),
    };

    // Mock file system operations
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Mock migrations
    vi.mocked(migrateSessionsToTasks).mockResolvedValue(undefined);

    // Mock Task methods to avoid complex initialization
    Task.prototype['resetContext'] = vi.fn().mockResolvedValue(undefined);

    project = new Project(
      baseDir,
      mockStore as unknown as Store,
      {} as McpManager,
      { initializeForProject: vi.fn(), removeProject: vi.fn() } as any,
      {} as TelemetryManager,
      {} as DataManager,
      mockEventManager as unknown as EventManager,
      mockModelManager as unknown as ModelManager,
      mockGitManager as GitManager,
      mockAgentProfileManager as unknown as AgentProfileManager,
      {} as MemoryManager,
      mockPromptsManager as PromptsManager,
      mockExtensionManager as unknown as ExtensionManager,
      {} as any,
    );

    await (project as any).tasksLoadingPromise;
  });

  it('lists branches of the project base dir', async () => {
    await project.listBranches();
    expect(mockGitManager.listBranches).toHaveBeenCalledWith('/test/project');
  });
});
