/**
 * Tests for file deletion tool (power---file_delete)
 * Comprehensive tests covering path resolution, validation, and error handling
 */

import fs from 'fs/promises';
import os from 'os';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POWER_TOOL_GROUP_NAME as TOOL_GROUP_NAME, POWER_TOOL_FILE_DELETE as TOOL_FILE_DELETE } from '@common/tools';
import { FileDeleteToolSettings } from '@common/types';

import type { PathLike } from 'fs';

describe('File Delete Tool', () => {
  let createPowerToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockPromptContext: any;
  let mockAbortSignal: any;

  const TOOL_GROUP_SEPARATOR = '---';
  const TOOL_DELETE_KEY = `${TOOL_GROUP_NAME}${TOOL_GROUP_SEPARATOR}${TOOL_FILE_DELETE}`;
  const TASK_DIR = '/test/project/.aider-desk/worktree/task-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    mockAbortSignal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      throwIfAborted: vi.fn(),
    };

    mockTask = {
      taskId: 'task-123',
      getTaskDir: vi.fn(() => TASK_DIR),
      getProjectDir: vi.fn(() => '/test/project'),
      addToolMessage: vi.fn(),
      addLogMessage: vi.fn(),
      askQuestion: vi.fn(),
      hookManager: {
        trigger: vi.fn().mockResolvedValue({ result: true, reason: undefined }),
      },
      task: {
        autoApprove: false,
      },
    };

    mockProfile = {
      toolApprovals: {},
      toolSettings: {},
    };

    mockPromptContext = { id: 'test-prompt-context' };

    const powerModule = await import('../power');
    createPowerToolset = powerModule.createPowerToolset;
  });

  describe('Tool registration', () => {
    it('should register file delete tool', () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      expect(tools).toHaveProperty(TOOL_DELETE_KEY);
    });

    it('should have correct description', () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      expect(fileDeleteTool.description).toContain('delete');
      expect(fileDeleteTool.description).toContain('task directory');
    });

    it('should have proper input schema', () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      expect(fileDeleteTool.inputSchema).toBeDefined();
      expect(fileDeleteTool.inputSchema.shape).toBeDefined();

      expect(fileDeleteTool.inputSchema.shape.filePath).toBeDefined();
      expect(fileDeleteTool.inputSchema.shape.dryRun).toBeDefined();
      expect(fileDeleteTool.inputSchema.shape.isDirectory).toBeDefined();
    });
  });

  describe('Path traversal protection', () => {
    it('should reject path outside task directory with detailed error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '../../../etc/passwd' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory does not exist/);
      expect(result).toMatch(/etc\/passwd|\/test\/project/);
    });

    it('should reject absolute path outside task directory', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '/tmp/outside-task-dir.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|not found/);
      expect(result).toContain('/tmp/outside-task-dir.txt');
    });

    it('should reject path with .. that escapes task directory', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: 'subdir/../../sensitive.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory does not exist|not found/);
    });

    it('should handle path with mixed dot segments', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: 'foo/./bar/../baz/../../secret.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory does not exist/);
    });

    it('should handle complex traversal attempt', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: 'foo/bar/../../../../../etc/passwd' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory does not exist/);
    });

    it('should detect path traversal and return error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '../../../etc/passwd' }, { toolCallId: 'tool-call-123' });

      // Path traversal should be detected and return appropriate error
      expect(result).toMatch(/Path traversal detected|Parent directory/);
      expect(result).toMatch(/etc\/passwd|\/test\/project/);
    });
  });

  describe('Parent directory validation', () => {
    it('should return detailed error when parent directory does not exist', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });

      const result = await fileDeleteTool.execute({ filePath: 'nonexistent/path/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Parent directory does not exist');
      expect(result).toContain('nonexistent/path');
    });

    it('should return error when parent path is not a directory', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async () => {
        return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
      });

      const result = await fileDeleteTool.execute({ filePath: 'file-as-parent/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('is not a directory');
    });

    it('should log warn message when parent directory not found', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const loggerModule = await import('@/logger');
      const warnSpy = vi.spyOn(loggerModule.default, 'warn');

      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });

      await fileDeleteTool.execute({ filePath: 'missing/parent/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(warnSpy).toHaveBeenCalled();
      const warnCall = warnSpy.mock.calls.find((call) => call[0] && String(call[0]).includes?.('Parent directory'));
      expect(warnCall).toBeDefined();
    });

    it('should handle other errors when checking parent directory', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockRejectedValue(new Error('EACCES: permission denied') as NodeJS.ErrnoException as never);

      const result = await fileDeleteTool.execute({ filePath: 'some/path/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Could not access parent directory');
      expect(result).toContain('permission denied');
    });

    it('should show resolved absolute path in parent directory error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });

      const result = await fileDeleteTool.execute({ filePath: 'path/to/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('path/to/file.txt');
    });
  });

  describe('Tilde expansion', () => {
    it('should expand ~ to home directory and show in error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '~/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory|not found|is not a directory/);
      expect(result).toContain(os.homedir());
    });

    it('should handle ~ alone as home directory', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '~' }, { toolCallId: 'tool-call-123' });

      expect(result).toMatch(/Path traversal detected|Parent directory|not found|is not a directory/);
      expect(result).toContain(os.homedir());
    });
  });

  describe('Dry-run mode', () => {
    it('should return preview without modifying filesystem', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 1024, mtime: new Date('2024-01-01T12:00:00Z') } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'test-file.txt', dryRun: true }, { toolCallId: 'tool-call-123' });

      const unlinkSpy = vi.spyOn(fs, 'unlink');
      expect(unlinkSpy).not.toHaveBeenCalled();

      expect(result).toContain('dryRun');
      expect(result).toContain('true');
      expect(result).toContain('wouldDelete');
      expect(result).toContain('true');
      expect(result).toContain('test-file.txt');
      expect(result).toContain('1024');
    });

    it('should include file metadata in dry-run response', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const mockMtime = new Date('2024-06-15T10:30:00Z');

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 2048, mtime: mockMtime } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'example.txt', dryRun: true }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('fileSize');
      expect(result).toContain('2048');
      expect(result).toContain('lastModified');
      expect(result).toContain('2024-06-15T10:30:00.000Z');
    });

    it('should not require approval in dry-run mode', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      const handleApprovalSpy = vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([false, 'denied'] as never);

      await fileDeleteTool.execute({ filePath: 'file.txt', dryRun: true }, { toolCallId: 'tool-call-123' });

      expect(handleApprovalSpy).not.toHaveBeenCalled();
    });

    it('should show resolved paths in dry-run preview', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 500, mtime: new Date() } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'subdir/test.txt', dryRun: true }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('subdir/test.txt');
      expect(result).toContain('dryRun');
      expect(result).toContain('true');
    });
  });

  describe('Directory deletion', () => {
    it('should allow empty directory deletion', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'rmdir').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'empty-dir' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
      expect(result).toContain('empty-dir');

      const rmdirSpy = vi.spyOn(fs, 'rmdir');
      expect(rmdirSpy).toHaveBeenCalled();
    });

    it('should reject non-empty directories when allowRecursiveDirectoryDeletion is false', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue(['file1.txt', 'file2.txt'] as never);

      const result = await fileDeleteTool.execute({ filePath: 'non-empty-dir' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('not empty');
      expect(result).toContain('Enable recursive directory deletion');
    });

    it('should allow non-empty directory deletion when allowRecursiveDirectoryDeletion is true', async () => {
      const profileWithRecursiveDeletion = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowRecursiveDirectoryDeletion: true,
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithRecursiveDeletion, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue(['file1.txt', 'subdir'] as never);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'rm').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'non-empty-dir' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
      expect(result).toContain('non-empty-dir');

      const rmSpy = vi.spyOn(fs, 'rm');
      expect(rmSpy).toHaveBeenCalled();
    });

    it('should check allowedDirectoryPatterns for directory deletion', async () => {
      const profileWithDirPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowedDirectoryPatterns: ['temp/**', 'cache/**'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithDirPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const result = await fileDeleteTool.execute({ filePath: 'important-dir' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('does not match any allowed directory patterns');
    });

    it('should allow directories matching allowedDirectoryPatterns', async () => {
      const profileWithDirPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowedDirectoryPatterns: ['temp/**', 'cache/**'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithDirPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'rmdir').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'temp/cache' }, { toolCallId: 'tool-call-123' });

      expect(result).not.toContain('does not match any allowed directory patterns');
      expect(result).toContain('Successfully deleted');
    });

    it('should check deniedDirectoryPatterns for directory deletion', async () => {
      const profileWithDeniedDirPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            deniedDirectoryPatterns: ['**/.git/**', '**/node_modules/**'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithDeniedDirPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: '.git/objects' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('matches a protected directory pattern');
    });

    it('should provide detailed dry-run for directories', async () => {
      const profileWithRecursiveDeletion = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowRecursiveDirectoryDeletion: true,
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithRecursiveDeletion, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue(['file1.txt', 'subdir'] as never);

      const readdirWithFileTypes = vi.fn().mockImplementation((dir: string) => {
        if (dir.endsWith('test-dir')) {
          return Promise.resolve([
            { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
            { name: 'subdir', isFile: () => false, isDirectory: () => true },
          ]);
        }
        if (dir.endsWith('subdir')) {
          return Promise.resolve([{ name: 'nested.txt', isFile: () => true, isDirectory: () => false }]);
        }
        return Promise.resolve([]);
      });

      vi.spyOn(fs, 'readdir').mockImplementation(readdirWithFileTypes as never);

      const result = await fileDeleteTool.execute({ filePath: 'test-dir', dryRun: true }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('dryRun');
      expect(result).toContain('true');
      expect(result).toContain('type');
      expect(result).toContain('directory');
      expect(result).toContain('recursive');
      expect(result).toContain('true');
      expect(result).toContain('wouldDelete');
      expect(result).toContain('true');
      expect(result).toContain('contents');
    });

    it('should request approval with directory info before deletion', async () => {
      const profileWithRecursiveDeletion = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowRecursiveDirectoryDeletion: true,
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithRecursiveDeletion, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue(['file1.txt', 'subdir'] as never);

      const { ApprovalManager } = await import('../approval-manager');
      const handleApprovalSpy = vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      await fileDeleteTool.execute({ filePath: 'my-dir' }, { toolCallId: 'tool-call-123' });

      expect(handleApprovalSpy).toHaveBeenCalledWith(
        TOOL_DELETE_KEY,
        "Approve deleting directory 'my-dir'?",
        expect.stringContaining('Path: my-dir\nType: Directory (2 items, will be deleted recursively)'),
      );
    });

    it('should handle ENOTEMPTY error when trying to delete non-empty directory without recursive', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const enotemptyError = new Error('ENOTEMPTY: directory not empty') as NodeJS.ErrnoException;
      enotemptyError.code = 'ENOTEMPTY';
      vi.spyOn(fs, 'rmdir').mockRejectedValue(enotemptyError as never);

      const result = await fileDeleteTool.execute({ filePath: 'dir' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('is not empty');
    });
  });

  describe('File not found error', () => {
    it('should return error when file does not exist', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'nonexistent.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('not found');
      expect(result).toContain('nonexistent.txt');
    });

    it('should show resolved absolute path in not found error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'path/to/missing.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('path/to/missing.txt');
      expect(result).toContain('not found');
      expect(result).toContain('Resolved absolute path');
    });

    it('should handle ENOENT during unlink after approval', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const unlinkError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      unlinkError.code = 'ENOENT';
      vi.spyOn(fs, 'unlink').mockRejectedValue(unlinkError as never);

      const result = await fileDeleteTool.execute({ filePath: 'file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('not found');
      expect(result).toContain('may have been moved or deleted already');
    });

    it('should log debug message when path not found', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const loggerModule = await import('@/logger');
      const debugSpy = vi.spyOn(loggerModule.default, 'debug');

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
      });

      await fileDeleteTool.execute({ filePath: 'missing.txt' }, { toolCallId: 'tool-call-123' });

      expect(debugSpy).toHaveBeenCalled();
      const hasPathResolutionCall = debugSpy.mock.calls.some(
        (call) => (call[0] && String(call[0]).includes?.('Path')) || (call[0] && String(call[0]).includes?.('resolution')),
      );
      expect(hasPathResolutionCall).toBe(true);
    });
  });

  describe('Permission denied error', () => {
    it('should return error when permission denied', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      vi.spyOn(fs, 'unlink').mockRejectedValue(permError as never);

      const result = await fileDeleteTool.execute({ filePath: 'protected.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Permission denied');
      expect(result).toContain('protected.txt');
    });

    it('should show resolved path in permission denied error', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      vi.spyOn(fs, 'unlink').mockRejectedValue(permError as never);

      const result = await fileDeleteTool.execute({ filePath: 'subdir/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Permission denied');
      expect(result).toContain('subdir/file.txt');
    });

    it('should log warn message on permission denied', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const loggerModule = await import('@/logger');
      const warnSpy = vi.spyOn(loggerModule.default, 'warn');

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      vi.spyOn(fs, 'unlink').mockRejectedValue(permError as never);

      await fileDeleteTool.execute({ filePath: 'protected.txt' }, { toolCallId: 'tool-call-123' });

      expect(warnSpy).toHaveBeenCalled();
      const warnCall = warnSpy.mock.calls.find((call) => call[0] && String(call[0]).includes?.('Permission'));
      expect(warnCall).toBeDefined();
    });
  });

  describe('Size limits', () => {
    it('should reject files exceeding max size', async () => {
      const profileWithSizeLimit = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            maxFileSizeBytes: 1000,
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithSizeLimit, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 2048, mtime: new Date() } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'large-file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('exceeds maximum allowed size');
      expect(result).toContain('2048 bytes');
      expect(result).toContain('1000 bytes');
    });

    it('should allow files within size limit', async () => {
      const profileWithSizeLimit = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            maxFileSizeBytes: 5000,
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithSizeLimit, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 1024, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const result = await fileDeleteTool.execute({ filePath: 'small-file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).not.toContain('exceeds maximum allowed size');
    });
  });

  describe('Pattern matching - allowed patterns', () => {
    it('should reject files not matching allowed patterns', async () => {
      const profileWithAllowedPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowedPatterns: ['*.txt', 'src/**/*.ts'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithAllowedPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'script.py' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('does not match any allowed patterns');
      expect(result).toContain('script.py');
    });

    it('should allow files matching allowed patterns', async () => {
      const profileWithAllowedPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            allowedPatterns: ['*.txt', '*.md', 'src/**/*.ts'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithAllowedPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const result = await fileDeleteTool.execute({ filePath: 'readme.md' }, { toolCallId: 'tool-call-123' });

      expect(result).not.toContain('does not match any allowed patterns');
    });
  });

  describe('Pattern matching - denied patterns', () => {
    it('should reject files matching denied patterns', async () => {
      const profileWithDeniedPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            deniedPatterns: ['**/.git/**', '**/*.config.js', 'secrets/**'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithDeniedPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: '.git/config' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('matches a protected pattern');
      expect(result).toContain('.git/config');
    });

    it('should allow files not matching denied patterns', async () => {
      const profileWithDeniedPatterns = {
        ...mockProfile,
        toolSettings: {
          [TOOL_DELETE_KEY]: {
            deniedPatterns: ['**/.git/**', '**/*.config.js', 'secrets/**'],
          } as FileDeleteToolSettings,
        },
      };

      const tools = createPowerToolset(mockTask, profileWithDeniedPatterns, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      const result = await fileDeleteTool.execute({ filePath: 'src/main.ts' }, { toolCallId: 'tool-call-123' });

      expect(result).not.toContain('matches a protected pattern');
    });
  });

  describe('Debug logging', () => {
    it('should log path resolution details on successful validation', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const loggerModule = await import('@/logger');
      const debugSpy = vi.spyOn(loggerModule.default, 'debug');

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([false, 'denied'] as never);

      await fileDeleteTool.execute({ filePath: 'subdir/file.txt' }, { toolCallId: 'tool-call-123' });

      expect(debugSpy).toHaveBeenCalled();
      const debugCall = debugSpy.mock.calls.find((call) => call[0] && String(call[0]).includes?.('Path resolution')) as
        | [unknown, { originalPath: string; taskDir: string; resolvedPath: string }]
        | undefined;
      expect(debugCall).toBeDefined();
      const infoObject = debugCall![1];
      expect(infoObject.originalPath).toBe('subdir/file.txt');
      expect(infoObject.taskDir).toBe(TASK_DIR);
      expect(infoObject.resolvedPath).toBeDefined();
    });

    it('should log error on unexpected errors', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const loggerModule = await import('@/logger');
      const errorSpy = vi.spyOn(loggerModule.default, 'error');

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          throw new Error('EMFILE: too many open files');
        }
      });

      const result = await fileDeleteTool.execute({ filePath: 'file.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Could not access path');
      expect(errorSpy).toHaveBeenCalled();
      const errorCall = errorSpy.mock.calls.find((call) => call[0] && String(call[0]).includes?.('Unexpected error'));
      expect(errorCall).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file path gracefully', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const result = await fileDeleteTool.execute({ filePath: '' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Error');
      expect(result).toMatch(/Parent directory|Could not access|not found/);
    });

    it('should handle concurrent deletion attempts', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async () => {
        return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'rmdir').mockResolvedValue(undefined as never);

      const results = await Promise.all([
        fileDeleteTool.execute({ filePath: 'dir1' }, { toolCallId: 'tool-call-1' }),
        fileDeleteTool.execute({ filePath: 'dir2' }, { toolCallId: 'tool-call-2' }),
      ]);

      expect(results[0]).toContain('Successfully deleted');
      expect(results[1]).toContain('Successfully deleted');
    });

    it('should handle very long paths', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const longPath = 'a'.repeat(200) + '/b'.repeat(200) + '/file.txt';

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
          error.code = 'ENOENT';
          throw error;
        }
      });

      const result = await fileDeleteTool.execute({ filePath: longPath }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('not found');
    });

    it('should handle explicit isDirectory flag', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async () => {
        return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
      });

      vi.spyOn(fs, 'readdir').mockResolvedValue([]);

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'rmdir').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'new-dir', isDirectory: true }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
      expect(result).toContain('new-dir');
    });

    it('should handle explicit isDirectory: false for file', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'unlink').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'file.txt', isDirectory: false }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain original behavior for valid paths', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      let callCount = 0;
      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        callCount++;
        if (callCount === 1) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        } else {
          return { isDirectory: () => false, size: 100, mtime: new Date() } as never;
        }
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'unlink').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'test.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
      expect(result).toContain('test.txt');
    });

    it('should show improved error messages compared to old behavior', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      const traversalResult = await fileDeleteTool.execute({ filePath: '../../../etc/passwd' }, { toolCallId: 'tool-call-1' });

      expect(traversalResult).toContain('Error');
      expect(traversalResult).toMatch(/Parent directory|Path traversal|not found|is not a directory/);
      expect(traversalResult).toMatch(/etc\/passwd|\/test\/project/);
    });

    it('should handle symlinks correctly', async () => {
      const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext, mockAbortSignal);
      const fileDeleteTool = tools[TOOL_DELETE_KEY];

      vi.spyOn(fs, 'stat').mockImplementation(async (_path: PathLike) => {
        if (_path.toString().endsWith('task-123')) {
          return { isDirectory: () => true, size: 4096, mtime: new Date() } as never;
        }
        return { isDirectory: () => false, isSymbolicLink: () => true, size: 100, mtime: new Date() } as never;
      });

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleApproval').mockResolvedValue([true, undefined] as never);

      vi.spyOn(fs, 'unlink').mockResolvedValue(undefined as never);

      const result = await fileDeleteTool.execute({ filePath: 'symlink.txt' }, { toolCallId: 'tool-call-123' });

      expect(result).toContain('Successfully deleted');
    });
  });
});
