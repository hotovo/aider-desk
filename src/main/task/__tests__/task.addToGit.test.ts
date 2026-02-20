/**
 * Tests for the addToGit method in Task class
 * Tests both cases:
 * 1. Project IS a git repository - file should be added to staging
 * 2. Project is NOT a git repository - should skip without errors
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    stat: vi.fn().mockRejectedValue(new Error('File not found')),
    readdir: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockResolvedValue(undefined),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  stat: vi.fn().mockRejectedValue(new Error('File not found')),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
  filterIgnoredFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/constants', () => ({
  PROBE_BINARY_PATH: '/probe',
  AIDER_DESK_TASKS_DIR: '.aider-desk/tasks',
  AIDER_DESK_DIR: '.aider-desk',
  AIDER_DESK_TODOS_FILE: 'todos.json',
  AIDER_DESK_RULES_DIR: 'rules',
  AIDER_DESK_PROJECT_RULES_DIR: '.aider-desk/rules',
  AIDER_DESK_GLOBAL_RULES_DIR: '/home/.aider-desk/rules',
  AIDER_DESK_COMMANDS_DIR: '.aider-desk/commands',
  AIDER_DESK_HOOKS_DIR: '.aider-desk/hooks',
  AIDER_DESK_GLOBAL_HOOKS_DIR: '/home/.aider-desk/hooks',
  AIDER_DESK_PROMPTS_DIR: '.aider-desk/prompts',
  AIDER_DESK_DEFAULT_PROMPTS_DIR: '/resources/prompts',
  AIDER_DESK_GLOBAL_PROMPTS_DIR: '/home/.aider-desk/prompts',
  AIDER_DESK_AGENTS_DIR: '.aider-desk/agents',
  AIDER_DESK_TMP_DIR: '.aider-desk/tmp',
  AIDER_DESK_WATCH_FILES_LOCK: '.aider-desk/watch-files.lock',
  WORKTREE_BRANCH_PREFIX: 'aider-desk/task/',
  AIDER_DESK_MEMORY_FILE: '/data/memory.db',
  LOGS_DIR: '/logs',
}));

vi.mock('@/agent', () => ({
  Agent: class {
    run = vi.fn();
    dispose = vi.fn();
  },
  McpManager: class {},
  AgentProfileManager: class {},
}));

vi.mock('@/task/aider-manager', () => ({
  AiderManager: class {
    start = vi.fn();
    stop = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@/hooks/hook-manager', () => ({
  HookManager: class {
    trigger = vi.fn().mockResolvedValue({ event: {}, blocked: false });
    stopWatchingProject = vi.fn();
  },
}));

vi.mock('@/prompts', () => ({
  PromptsManager: class {},
}));

vi.mock('@/data-manager', () => ({
  DataManager: class {},
}));

vi.mock('@/telemetry', () => ({
  TelemetryManager: class {},
}));

vi.mock('@/models', () => ({
  ModelManager: class {},
}));

vi.mock('@/events', () => ({
  EventManager: class {
    sendTaskUpdated = vi.fn();
    sendTaskCreated = vi.fn();
    sendTaskDeleted = vi.fn();
  },
}));

vi.mock('@/memory/memory-manager', () => ({
  MemoryManager: class {},
}));

vi.mock('@/worktrees', () => ({
  WorktreeManager: class {},
}));

vi.mock('@/custom-commands', () => ({
  CustomCommandManager: class {},
}));

vi.mock('@/store', () => ({
  Store: class {},
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { Task } from '../task';

import type { SimpleGit } from 'simple-git';

describe('Task - addToGit', () => {
  let mockGit: Partial<SimpleGit>;
  let task: Task;
  let mockProject: any;
  let mockStore: any;
  let mockMcpManager: any;
  let mockCustomCommandManager: any;
  let mockAgentProfileManager: any;
  let mockTelemetryManager: any;
  let mockDataManager: any;
  let mockEventManager: any;
  let mockModelManager: any;
  let mockWorktreeManager: any;
  let mockMemoryManager: any;
  let mockHookManager: any;
  let mockPromptsManager: any;

  const baseDir = '/test/project';
  const taskId = 'test-task-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock git instance
    mockGit = {
      checkIsRepo: vi.fn(),
      add: vi.fn(),
    };

    // Create minimal mock dependencies
    mockProject = {
      baseDir,
      getProjectSettings: vi.fn(() => ({
        mainModel: 'default-model',
        agentProfileId: 'default-profile',
        modelEditFormats: {},
        currentMode: 'agent',
        autoApproveLocked: false,
      })),
    };

    mockStore = {
      getSettings: vi.fn(() => ({
        language: 'en',
        renderMarkdown: true,
        aider: { autoCommits: true, cachingEnabled: true, watchFiles: true },
        promptBehavior: { requireCommandConfirmation: {} },
      })),
    };

    mockMcpManager = {};
    mockCustomCommandManager = {};
    mockAgentProfileManager = {
      getProfile: vi.fn(() => null),
    };
    mockTelemetryManager = {};
    mockDataManager = {};
    mockEventManager = {
      sendTaskUpdated: vi.fn(),
      sendTaskCreated: vi.fn(),
      sendTaskDeleted: vi.fn(),
    };
    mockModelManager = {};
    mockWorktreeManager = {};
    mockMemoryManager = {};
    mockHookManager = {
      trigger: vi.fn((_hookName: string, event: any) => Promise.resolve({ event, blocked: false })),
    };
    mockPromptsManager = {};

    // Create Task instance
    task = new Task(
      mockProject,
      taskId,
      mockStore,
      mockMcpManager,
      mockCustomCommandManager,
      mockAgentProfileManager,
      mockTelemetryManager,
      mockDataManager,
      mockEventManager,
      mockModelManager,
      mockWorktreeManager,
      mockMemoryManager,
      mockHookManager,
      mockPromptsManager,
    );
  });

  describe('when project IS a git repository', () => {
    beforeEach(() => {
      // Set the git property to the mock
      (task as any).git = mockGit;
      // Mock checkIsRepo to return true
      vi.mocked(mockGit.checkIsRepo!).mockResolvedValue(true);
    });

    it('should add the file to git staging', async () => {
      const filePath = '/test/project/src/new-file.ts';

      // Mock updateAutocompletionData to avoid errors
      (task as any).updateAutocompletionData = vi.fn().mockResolvedValue(undefined);

      await task.addToGit(filePath);

      expect(mockGit.checkIsRepo).toHaveBeenCalledTimes(1);
      expect(mockGit.add).toHaveBeenCalledWith(filePath);
    });

    it('should call updateAutocompletionData after adding', async () => {
      const filePath = '/test/project/src/new-file.ts';
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      (task as any).updateAutocompletionData = mockUpdate;

      await task.addToGit(filePath);

      expect(mockUpdate).toHaveBeenCalledWith(undefined, true);
    });

    it('should handle git add errors gracefully', async () => {
      const filePath = '/test/project/src/new-file.ts';
      const mockAddLogMessage = vi.fn();
      (task as any).addLogMessage = mockAddLogMessage;
      (task as any).updateAutocompletionData = vi.fn().mockResolvedValue(undefined);

      vi.mocked(mockGit.add!).mockRejectedValue(new Error('git add failed'));

      await task.addToGit(filePath);

      expect(mockAddLogMessage).toHaveBeenCalledWith('warning', expect.stringContaining('Failed to add new file'), false, undefined);
    });
  });

  describe('when project is NOT a git repository', () => {
    beforeEach(() => {
      // Set the git property to the mock
      (task as any).git = mockGit;
      // Mock checkIsRepo to return false
      vi.mocked(mockGit.checkIsRepo!).mockResolvedValue(false);
    });

    it('should skip adding the file without calling git add', async () => {
      const filePath = '/test/project/src/new-file.ts';

      await task.addToGit(filePath);

      expect(mockGit.checkIsRepo).toHaveBeenCalledTimes(1);
      expect(mockGit.add).not.toHaveBeenCalled();
    });

    it('should not call updateAutocompletionData', async () => {
      const filePath = '/test/project/src/new-file.ts';
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      (task as any).updateAutocompletionData = mockUpdate;

      await task.addToGit(filePath);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should not log any warnings', async () => {
      const filePath = '/test/project/src/new-file.ts';
      const mockAddLogMessage = vi.fn();
      (task as any).addLogMessage = mockAddLogMessage;

      await task.addToGit(filePath);

      expect(mockAddLogMessage).not.toHaveBeenCalled();
    });
  });

  describe('when git is not initialized (null)', () => {
    beforeEach(() => {
      // Set git to null
      (task as any).git = null;
    });

    it('should return early without errors', async () => {
      const filePath = '/test/project/src/new-file.ts';

      // Should not throw
      await expect(task.addToGit(filePath)).resolves.toBeUndefined();
    });
  });
});
