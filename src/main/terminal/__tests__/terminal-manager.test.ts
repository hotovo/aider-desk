/**
 * Tests for TerminalManager - specifically the CWD fix for worktree subtasks
 *
 * This tests the fix that handles the case where a subtask inherits its parent's worktree.
 * The createTerminal method now checks for parent's worktree when the task doesn't have its own.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { v4 as uuidv4 } from 'uuid';

import { TerminalManager } from '../terminal-manager';

import type { EventManager } from '@/events';
import type { WorktreeManager } from '@/worktrees/worktree-manager';
import type { ProjectManager } from '@/project/project-manager';
import type { TelemetryManager } from '@/telemetry';

// Mock dependencies BEFORE importing the module
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@homebridge/node-pty-prebuilt-multiarch', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
  })),
}));

// Track UUID call count for unique IDs
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-terminal-id-${++uuidCounter}`),
}));

// Reset uuidCounter before each test
beforeEach(() => {
  uuidCounter = 0;
});

describe('TerminalManager - createTerminal CWD handling for worktree subtasks', () => {
  let mockEventManager: Partial<EventManager>;
  let mockWorktreeManager: Partial<WorktreeManager>;
  let mockProjectManager: Partial<ProjectManager>;
  let mockTelemetryManager: Partial<TelemetryManager>;
  let terminalManager: TerminalManager;
  let ptySpawnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up PTY spawn mock before creating TerminalManager
    ptySpawnMock = vi.fn().mockReturnValue({
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
    });
    (pty as any).spawn = ptySpawnMock;

    // Mock EventManager
    mockEventManager = {
      sendTerminalData: vi.fn(),
      sendTerminalExit: vi.fn(),
    };

    // Mock WorktreeManager
    mockWorktreeManager = {
      getTaskWorktree: vi.fn(),
    };

    // Mock ProjectManager with structure for task lookup
    mockProjectManager = {
      getProject: vi.fn((_baseDir: string) => ({
        getTask: vi.fn((taskId: string) => {
          // Return task data based on taskId
          if (taskId === 'task-with-worktree') {
            return {
              task: { parentId: null, worktree: null },
            };
          }
          if (taskId === 'subtask-no-own-worktree') {
            return {
              task: { parentId: 'parent-task-with-worktree', worktree: null },
            };
          }
          if (taskId === 'subtask-parent-no-worktree') {
            return {
              task: { parentId: 'parent-task-no-worktree', worktree: null },
            };
          }
          if (taskId === 'top-level-task') {
            return {
              task: { parentId: null, worktree: null },
            };
          }
          return null;
        }),
      })),
    };

    // Mock TelemetryManager
    mockTelemetryManager = {
      captureTerminalCreated: vi.fn(),
    };

    terminalManager = new TerminalManager(
      mockEventManager as EventManager,
      mockWorktreeManager as WorktreeManager,
      mockProjectManager as ProjectManager,
      mockTelemetryManager as TelemetryManager,
    );
  });

  afterEach(() => {
    terminalManager.close();
  });

  describe('Task with its own worktree', () => {
    it('should use task worktree path as CWD when task has its own worktree', async () => {
      const baseDir = '/test/project';
      const taskId = 'task-with-own-worktree';
      const worktreePath = '/test/project/.worktrees/task-with-own-worktree';

      // Mock worktree manager to return a worktree for this task
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue({
        path: worktreePath,
      });

      // Create terminal
      await terminalManager.createTerminal(baseDir, taskId);

      // Verify PTY was spawned with correct CWD
      expect(ptySpawnMock).toHaveBeenCalledWith(
        expect.any(String), // shell
        expect.any(Array), // args
        expect.objectContaining({
          cwd: worktreePath,
        }),
      );

      // Verify worktree was looked up
      expect(mockWorktreeManager.getTaskWorktree).toHaveBeenCalledWith(baseDir, taskId);
    });
  });

  describe('Subtask inheriting parent worktree', () => {
    it('should use parent worktree path as CWD when subtask has no own worktree but parent has one', async () => {
      const baseDir = '/test/project';
      const taskId = 'subtask-inheriting';
      const parentWorktreePath = '/test/project/.worktrees/parent-task';

      // Mock worktree manager to return null (subtask has no own worktree)
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);

      // Mock project manager to return parent with worktree
      vi.mocked(mockProjectManager.getProject).mockReturnValue({
        getTask: vi.fn((taskId: string) => {
          if (taskId === 'subtask-inheriting') {
            return {
              task: { parentId: 'parent-task-id', worktree: null },
            };
          }
          if (taskId === 'parent-task-id') {
            return {
              task: { parentId: null, worktree: { path: parentWorktreePath } },
            };
          }
          return null;
        }),
      });

      // Create terminal
      await terminalManager.createTerminal(baseDir, taskId);

      // Verify PTY was spawned with parent's worktree path as CWD
      expect(ptySpawnMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: parentWorktreePath,
        }),
      );

      // Verify worktree was checked for this task first
      expect(mockWorktreeManager.getTaskWorktree).toHaveBeenCalledWith(baseDir, taskId);

      // Verify project was looked up for parent inheritance
      expect(mockProjectManager.getProject).toHaveBeenCalledWith(baseDir);
    });
  });

  describe('Task with no worktree', () => {
    it('should use baseDir as CWD when task has no worktree and no parent', async () => {
      const baseDir = '/test/project';
      const taskId = 'task-no-worktree';

      // Mock worktree manager to return null
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);

      // Create terminal
      await terminalManager.createTerminal(baseDir, taskId);

      // Verify PTY was spawned with baseDir as CWD
      expect(ptySpawnMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: baseDir,
        }),
      );
    });
  });

  describe('Subtask with parent but parent has no worktree', () => {
    it('should use baseDir as CWD when parent task also has no worktree', async () => {
      const baseDir = '/test/project';
      const taskId = 'subtask-parent-no-worktree';

      // Mock worktree manager to return null
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);

      // Mock project manager to return parent without worktree
      vi.mocked(mockProjectManager.getProject).mockReturnValue({
        getTask: vi.fn((taskId: string) => {
          if (taskId === 'subtask-parent-no-worktree') {
            return {
              task: { parentId: 'parent-task-no-worktree', worktree: null },
            };
          }
          if (taskId === 'parent-task-no-worktree') {
            return {
              task: { parentId: null, worktree: null },
            };
          }
          return null;
        }),
      });

      // Create terminal
      await terminalManager.createTerminal(baseDir, taskId);

      // Verify PTY was spawned with baseDir as CWD (fallback)
      expect(ptySpawnMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          cwd: baseDir,
        }),
      );
    });
  });

  describe('CWD priority order', () => {
    it('should check own worktree first, then parent worktree, then fallback to baseDir', async () => {
      const baseDir = '/test/project';
      const taskId = 'task-priority-test';
      const ownWorktreePath = '/test/project/.worktrees/own';
      const parentWorktreePath = '/test/project/.worktrees/parent';

      // Test priority 1: Own worktree takes precedence
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue({
        path: ownWorktreePath,
      });

      await terminalManager.createTerminal(baseDir, taskId);

      expect(ptySpawnMock).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ cwd: ownWorktreePath }));

      // Reset for next test
      ptySpawnMock.mockClear();

      // Test priority 2: Parent worktree when no own worktree
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);
      vi.mocked(mockProjectManager.getProject).mockReturnValue({
        getTask: vi.fn((taskId: string) => {
          if (taskId === 'task-priority-test') {
            return {
              task: { parentId: 'parent-id', worktree: null },
            };
          }
          if (taskId === 'parent-id') {
            return {
              task: { parentId: null, worktree: { path: parentWorktreePath } },
            };
          }
          return null;
        }),
      });

      await terminalManager.createTerminal(baseDir, taskId);

      expect(ptySpawnMock).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ cwd: parentWorktreePath }));

      // Reset for next test
      ptySpawnMock.mockClear();

      // Test priority 3: baseDir when no worktrees available
      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);
      vi.mocked(mockProjectManager.getProject).mockReturnValue({
        getTask: vi.fn((taskId: string) => {
          if (taskId === 'task-priority-test') {
            return {
              task: { parentId: 'parent-id', worktree: null },
            };
          }
          if (taskId === 'parent-id') {
            return {
              task: { parentId: null, worktree: null },
            };
          }
          return null;
        }),
      });

      await terminalManager.createTerminal(baseDir, taskId);

      expect(ptySpawnMock).toHaveBeenCalledWith(expect.any(String), expect.any(Array), expect.objectContaining({ cwd: baseDir }));
    });
  });

  describe('UUID generation', () => {
    it('should generate a unique terminal ID for each terminal', async () => {
      const baseDir = '/test/project';
      const taskId = 'task-id';

      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);

      // Create first terminal
      const terminalId1 = await terminalManager.createTerminal(baseDir, taskId);

      // Create second terminal
      const terminalId2 = await terminalManager.createTerminal(baseDir, taskId);

      // Verify UUID was called twice
      expect(uuidv4).toHaveBeenCalledTimes(2);

      // Verify terminal IDs are different by checking they contain different counters
      expect(terminalId1).toContain('test-terminal-id-1');
      expect(terminalId2).toContain('test-terminal-id-2');
    });
  });

  describe('Error handling', () => {
    it('should log error and throw when PTY spawn fails', async () => {
      const baseDir = '/test/project';
      const taskId = 'task-error-test';

      vi.mocked(mockWorktreeManager.getTaskWorktree).mockResolvedValue(null);

      // Mock PTY spawn to throw an error
      ptySpawnMock.mockImplementation(() => {
        throw new Error('PTY spawn failed');
      });

      // Should throw an error
      await expect(terminalManager.createTerminal(baseDir, taskId)).rejects.toThrow('PTY spawn failed');
    });
  });
});

describe('TerminalManager - terminal instance management', () => {
  let mockEventManager: Partial<EventManager>;
  let mockWorktreeManager: Partial<WorktreeManager>;
  let mockProjectManager: Partial<ProjectManager>;
  let mockTelemetryManager: Partial<TelemetryManager>;
  let terminalManager: TerminalManager;
  let ptySpawnMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    ptySpawnMock = vi.fn().mockReturnValue({
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      kill: vi.fn(),
      resize: vi.fn(),
    });
    (pty as any).spawn = ptySpawnMock;

    mockEventManager = {
      sendTerminalData: vi.fn(),
      sendTerminalExit: vi.fn(),
    };

    mockWorktreeManager = {
      getTaskWorktree: vi.fn().mockResolvedValue(null),
    };

    mockProjectManager = {
      getProject: vi.fn().mockReturnValue({
        getTask: vi.fn().mockReturnValue({
          task: { parentId: null, worktree: null },
        }),
      }),
    };

    mockTelemetryManager = {
      captureTerminalCreated: vi.fn(),
    };

    terminalManager = new TerminalManager(
      mockEventManager as EventManager,
      mockWorktreeManager as WorktreeManager,
      mockProjectManager as ProjectManager,
      mockTelemetryManager as TelemetryManager,
    );
  });

  afterEach(() => {
    terminalManager.close();
  });

  it('should track created terminals internally', async () => {
    const baseDir = '/test/project';
    const taskId = 'task-track';

    const terminalId = await terminalManager.createTerminal(baseDir, taskId);

    // Verify terminal is tracked
    const terminal = terminalManager.getTerminalForTask(taskId);
    expect(terminal).toBeDefined();
    expect(terminal?.id).toBe(terminalId);
    expect(terminal?.baseDir).toBe(baseDir);
    expect(terminal?.taskId).toBe(taskId);
  });

  it('should support getting all terminals for a task', async () => {
    const baseDir = '/test/project';
    const taskId = 'task-multi';

    // Create multiple terminals for same task
    await terminalManager.createTerminal(baseDir, taskId);
    await terminalManager.createTerminal(baseDir, taskId);

    const terminals = terminalManager.getTerminalsForTask(taskId);
    expect(terminals.length).toBe(2);
  });

  it('should write data to correct terminal', async () => {
    const baseDir = '/test/project';
    const taskId = 'task-write';
    const testData = 'test command';

    const terminalId = await terminalManager.createTerminal(baseDir, taskId);
    const terminal = terminalManager.getTerminalForTask(taskId);

    const result = terminalManager.writeToTerminal(terminalId, testData);

    expect(result).toBe(true);
    expect(terminal?.ptyProcess.write).toHaveBeenCalledWith(testData);
  });

  it('should return false when writing to non-existent terminal', async () => {
    const result = terminalManager.writeToTerminal('non-existent-id', 'test');
    expect(result).toBe(false);
  });

  it('should resize terminal correctly', async () => {
    const baseDir = '/test/project';
    const taskId = 'task-resize';

    const terminalId = await terminalManager.createTerminal(baseDir, taskId);
    const terminal = terminalManager.getTerminalForTask(taskId);

    const result = terminalManager.resizeTerminal(terminalId, 120, 40);

    expect(result).toBe(true);
    expect(terminal?.ptyProcess.resize).toHaveBeenCalledWith(120, 40);
    expect(terminal?.cols).toBe(120);
    expect(terminal?.rows).toBe(40);
  });

  it('should close terminal and clean up resources', async () => {
    const baseDir = '/test/project';
    const taskId = 'task-close';

    const terminalId = await terminalManager.createTerminal(baseDir, taskId);
    const terminal = terminalManager.getTerminalForTask(taskId);

    const result = terminalManager.closeTerminal(terminalId);

    expect(result).toBe(true);
    expect(terminal?.ptyProcess.kill).toHaveBeenCalled();
    expect(terminalManager.getTerminalForTask(taskId)).toBeUndefined();
  });

  it('should close all terminals for a project', async () => {
    const baseDir = '/test/project';
    const taskId1 = 'task-close-1';
    const taskId2 = 'task-close-2';

    await terminalManager.createTerminal(baseDir, taskId1);
    await terminalManager.createTerminal(baseDir, taskId2);

    terminalManager.closeTerminalForProject(baseDir);

    expect(terminalManager.getTerminalsForTask(taskId1).length).toBe(0);
    expect(terminalManager.getTerminalsForTask(taskId2).length).toBe(0);
  });
});
