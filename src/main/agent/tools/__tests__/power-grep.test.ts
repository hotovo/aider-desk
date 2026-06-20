/**
 * Tests for power tools grep functionality.
 * Mocks child_process.spawn to test output parsing and formatting logic
 * without requiring the real ripgrep binary (compatible with CI).
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/ripgrep', () => ({
  ensureRipgrepBinary: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/constants')>();
  return {
    ...actual,
    RIPGREP_BINARY_PATH: '/mock/rg',
  };
});

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

const POWER_TOOL_GROUP_NAME = 'power';
const TOOL_GROUP_NAME_SEPARATOR = '---';
const POWER_TOOL_GREP = 'grep';

describe('Power Tools - grep functionality', () => {
  let createPowerToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockPromptContext: any;
  let lastMockProcess: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTask = {
      taskId: 'current-task-id',
      getTaskDir: vi.fn(() => '/mock/task/dir'),
      addToolMessage: vi.fn(),
      addLogMessage: vi.fn(),
      addToGit: vi.fn(),
    };

    mockProfile = {
      toolApprovals: {},
      toolSettings: {},
    };

    mockPromptContext = { id: 'test-prompt-context' };

    const approvalModule = await import('../approval-manager');
    vi.spyOn(approvalModule.ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

    const powerModule = await import('../power');
    createPowerToolset = powerModule.createPowerToolset;
  }, 30000);

  const getGrepTool = () => {
    if (!createPowerToolset) {
      throw new Error('createPowerToolset not initialized');
    }
    const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext);
    const grepToolKey = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_GREP}`;
    return tools[grepToolKey];
  };

  const execGrep = async (filePattern: string, searchTerm: string, options: { contextLines?: number; caseSensitive?: boolean; maxResults?: number } = {}) => {
    const grepTool = getGrepTool();
    const { contextLines = 0, caseSensitive = false, maxResults = 50 } = options;
    return grepTool.execute(
      { filePattern, searchTerm, contextLines, caseSensitive, maxResults },
      { toolCallId: `grep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ) as Promise<string>;
  };

  const setSpawnOutput = (stdoutLines: string[], stderr: string = '') => {
    vi.mocked(spawn).mockImplementation((() => {
      const cp = new EventEmitter() as any;
      cp.stdout = new EventEmitter();
      cp.stderr = new EventEmitter();
      cp.pid = 12345;
      cp.kill = vi.fn();
      lastMockProcess = cp;

      process.nextTick(() => {
        if (stdoutLines.length > 0) {
          cp.stdout.emit('data', Buffer.from(stdoutLines.join('\n') + '\n'));
        }
        if (stderr) {
          cp.stderr.emit('data', Buffer.from(stderr));
        }
        cp.emit('close', 0, null);
      });

      return cp;
    }) as any);
  };

  const getLastSpawnArgs = (): string[] => {
    const calls = vi.mocked(spawn).mock.calls;
    return calls[calls.length - 1][1] as string[];
  };

  describe('argument construction', () => {
    it('should pass correct base arguments to ripgrep', async () => {
      setSpawnOutput([]);
      await execGrep('*.ts', 'searchTerm');

      const args = getLastSpawnArgs();
      expect(args).toContain('--no-heading');
      expect(args).toContain('--line-number');
      expect(args).toContain('--color');
      expect(args[args.indexOf('--color') + 1]).toBe('never');
      expect(args).toContain('-g');
      expect(args[args.indexOf('-g') + 1]).toBe('*.ts');
      expect(args).toContain('--');
      expect(args[args.indexOf('--') + 1]).toBe('searchTerm');
      expect(args[args.lastIndexOf('--') + 1]).toBe('searchTerm');
      expect(args).toContain('.');
    });

    it('should use case-insensitive search by default', async () => {
      setSpawnOutput([]);
      await execGrep('*.ts', 'searchTerm', { caseSensitive: false });

      expect(getLastSpawnArgs()).toContain('-i');
    });

    it('should not use -i flag for case-sensitive search', async () => {
      setSpawnOutput([]);
      await execGrep('*.ts', 'searchTerm', { caseSensitive: true });

      expect(getLastSpawnArgs()).not.toContain('-i');
    });

    it('should pass context lines argument when contextLines > 0', async () => {
      setSpawnOutput([]);
      await execGrep('*.ts', 'searchTerm', { contextLines: 3 });

      const args = getLastSpawnArgs();
      expect(args).toContain('-C');
      expect(args[args.indexOf('-C') + 1]).toBe('3');
    });

    it('should not pass context lines argument when contextLines is 0', async () => {
      setSpawnOutput([]);
      await execGrep('*.ts', 'searchTerm', { contextLines: 0 });

      expect(getLastSpawnArgs()).not.toContain('-C');
    });
  });

  describe('output parsing and formatting', () => {
    it('should parse and format matches from a single file', async () => {
      setSpawnOutput(["component.tsx:1:import React from 'react';"]);

      const result = await execGrep('*.tsx', 'React');

      expect(result).toContain('component.tsx');
      expect(result).toContain("import React from 'react'");
      expect(result).toContain('1 match');
    });

    it('should parse and format matches across multiple files', async () => {
      setSpawnOutput(['file1.ts:1:const value = 42;', 'file2.ts:1:const value = 99;']);

      const result = await execGrep('*.ts', 'value');

      expect(result).toContain('file1.ts');
      expect(result).toContain('file2.ts');
      expect(result).toContain('const value = 42');
      expect(result).toContain('const value = 99');
      expect(result).toContain('2 matches');
    });

    it('should count matches correctly in the result header', async () => {
      setSpawnOutput(['test.ts:1:const hello = 1;', 'test.ts:2:const hello2 = 2;']);

      const result = await execGrep('*.ts', 'hello');

      expect(result).toContain('2 matches');
    });
  });

  describe('no matches', () => {
    it('should return no matches message when pattern not found', async () => {
      setSpawnOutput([]);

      const result = await execGrep('*.ts', 'nonexistent_pattern_xyz123');

      expect(result).toContain('No matches');
    });

    it('should return error message when stderr has content and no matches', async () => {
      setSpawnOutput([], 'Some error occurred');

      const result = await execGrep('*.ts', 'value');

      expect(result).toContain('Error during grep');
      expect(result).toContain('Some error occurred');
    });
  });

  describe('context lines', () => {
    it('should include context lines around matches', async () => {
      setSpawnOutput(['test.ts-2-line2', 'test.ts:3:TARGET_LINE', 'test.ts-4-line4']);

      const result = await execGrep('*.ts', 'TARGET_LINE', { contextLines: 1 });

      expect(result).toContain('TARGET_LINE');
      expect(result).toContain('line2');
      expect(result).toContain('line4');
    });

    it('should not include context lines when contextLines is 0', async () => {
      setSpawnOutput(['test.ts:3:TARGET_LINE']);

      const result = await execGrep('*.ts', 'TARGET_LINE', { contextLines: 0 });

      expect(result).toContain('TARGET_LINE');
    });
  });

  describe('maxResults limiting', () => {
    it('should limit results to maxResults', async () => {
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`file_${i}.ts:1:const match${i} = ${i};`);
      }
      setSpawnOutput(lines);

      const result = await execGrep('*.ts', 'match', { maxResults: 10 });

      expect(result).toContain('10 matches');
      expect(result).toContain('limit reached');
    });

    it('should not show limit notice when under maxResults', async () => {
      setSpawnOutput(['test.ts:1:const hello = 1;']);

      const result = await execGrep('*.ts', 'hello', { maxResults: 50 });

      expect(result).not.toContain('limit reached');
    });
  });

  describe('large output handling', () => {
    it('should handle many matches without errors', async () => {
      const numFiles = 30;
      const linesPerFile = 200;

      const lines: string[] = [];
      for (let f = 0; f < numFiles; f++) {
        for (let i = 0; i < linesPerFile; i++) {
          lines.push(`file_${f}.ts:${i + 1}:const searchTerm_${f}_${i} = ${i};`);
        }
      }
      setSpawnOutput(lines);

      const result = await execGrep('*.ts', 'searchTerm', { maxResults: 6000 });

      expect(result).not.toContain('maxBuffer');
      expect(result).not.toContain('Error during grep');
      expect(result).toContain('matches');
    });

    it('should kill ripgrep early when maxResults is reached, even with massive output', async () => {
      const numFiles = 50;
      const linesPerFile = 500;

      const lines: string[] = [];
      for (let f = 0; f < numFiles; f++) {
        for (let i = 0; i < linesPerFile; i++) {
          lines.push(`file_${f}.ts:${i + 1}:const searchTerm_${f}_${i} = ${i};`);
        }
      }
      setSpawnOutput(lines);

      const result = await execGrep('*.ts', 'searchTerm', { maxResults: 5 });

      expect(result).not.toContain('maxBuffer');
      expect(result).not.toContain('Error during grep');
      expect(result).toContain('5 matches');
      expect(result).toContain('limit reached');
      expect(lastMockProcess.kill).toHaveBeenCalled();
    });
  });
});
