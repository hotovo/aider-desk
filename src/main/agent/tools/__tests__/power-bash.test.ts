/**
 * Tests for the bash tool's environment initialization behavior.
 *
 * Verifies that the bash tool prepends the shell init prefix returned by
 * getShellInitCommand() to the user's command before executing it. This
 * ensures the user's shell environment (rc files, direnv, etc.) is loaded
 * before the command runs.
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetShellInitCommand = vi.fn();
const mockGetShellCommandArgs = vi.fn();
const mockGetShellPath = vi.fn(() => '/usr/bin:/bin');

vi.mock('@/utils/shell', () => ({
  getShellInitCommand: mockGetShellInitCommand,
  getShellCommandArgs: mockGetShellCommandArgs,
  getShellPath: mockGetShellPath,
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: vi.fn(),
  };
});

const POWER_TOOL_GROUP_NAME = 'power';
const TOOL_GROUP_NAME_SEPARATOR = '---';
const POWER_TOOL_BASH = 'bash';

describe('Power Tools - bash shell initialization', () => {
  let createPowerToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockPromptContext: any;
  let lastSpawnArgs: any;
  let lastSpawnOptions: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetShellInitCommand.mockReset();
    mockGetShellCommandArgs.mockReset();
    mockGetShellPath.mockReset();
    mockGetShellPath.mockReturnValue('/usr/bin:/bin');
    mockGetShellCommandArgs.mockImplementation((cmd: string) => ({
      shell: '/bin/bash',
      args: ['-c', cmd],
    }));

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

    vi.mocked(spawn).mockImplementation(((_shell: string, args: string[], options: any) => {
      lastSpawnArgs = args;
      lastSpawnOptions = options;

      const cp = new EventEmitter() as any;
      cp.stdout = new EventEmitter();
      cp.stderr = new EventEmitter();
      cp.pid = 12345;
      cp.kill = vi.fn();

      // Use setTimeout(0) rather than process.nextTick so the bash tool has
      // a chance to attach its 'exit'/'close' listeners synchronously
      // after spawn() returns, before our 'close' event fires.
      setTimeout(() => {
        cp.emit('exit', 0, null);
        cp.emit('close', 0, null);
      }, 0);

      return cp;
    }) as any);

    const approvalModule = await import('../approval-manager');
    vi.spyOn(approvalModule.ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

    const powerModule = await import('../power');
    createPowerToolset = powerModule.createPowerToolset;
  }, 30000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getBashTool = () => {
    const tools = createPowerToolset(mockTask, mockProfile, mockPromptContext);
    const bashToolKey = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`;
    return tools[bashToolKey];
  };

  const execBash = async (command: string, options: { cwd?: string; timeout?: number } = {}) => {
    const bashTool = getBashTool();
    const { cwd, timeout = 5000 } = options;
    return bashTool.execute(
      { command, cwd, timeout },
      { toolCallId: `bash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    ) as Promise<{ stdout: string; stderr: string; exitCode: number }>;
  };

  describe('command construction with shell init prefix', () => {
    it('prepends the bash init prefix to the user command', async () => {
      const initPrefix = 'source /etc/profile; source /home/user/.bashrc; eval "$(direnv export bash)"; ';
      mockGetShellInitCommand.mockReturnValue(initPrefix);

      const result = await execBash('echo hello');

      expect(result.exitCode).toBe(0);
      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toBe(`${initPrefix} echo hello`);
    });

    it('prepends the zsh init prefix to the user command', async () => {
      const initPrefix = 'source /etc/zprofile; source /home/user/.zshrc; eval "$(direnv export zsh)"; ';
      mockGetShellInitCommand.mockReturnValue(initPrefix);

      const result = await execBash('ls -la');

      expect(result.exitCode).toBe(0);
      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toBe(`${initPrefix} ls -la`);
    });

    it('prepends the fish init prefix to the user command', async () => {
      const initPrefix = 'source /home/user/.config/fish/config.fish; direnv export fish | source; ';
      mockGetShellInitCommand.mockReturnValue(initPrefix);

      const result = await execBash('pwd');

      expect(result.exitCode).toBe(0);
      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toBe(`${initPrefix} pwd`);
    });

    it('uses only the user command when init prefix is empty (e.g. Windows cmd)', async () => {
      mockGetShellInitCommand.mockReturnValue('');

      const result = await execBash('dir');

      expect(result.exitCode).toBe(0);
      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toBe('dir');
    });

    it('passes the combined command to getShellCommandArgs', async () => {
      const initPrefix = 'source /etc/profile; eval "$(direnv export bash)"; ';
      mockGetShellInitCommand.mockReturnValue(initPrefix);

      await execBash('npm test');

      expect(mockGetShellCommandArgs).toHaveBeenCalledWith(`${initPrefix} npm test`);
    });

    it('passes only the user command to getShellCommandArgs when prefix is empty', async () => {
      mockGetShellInitCommand.mockReturnValue('');

      await execBash('npm test');

      expect(mockGetShellCommandArgs).toHaveBeenCalledWith('npm test');
    });

    it('uses the args returned by getShellCommandArgs for spawn', async () => {
      mockGetShellInitCommand.mockReturnValue('source /home/user/.bashrc; ');
      mockGetShellCommandArgs.mockReturnValue({
        shell: '/bin/zsh',
        args: ['-c', 'source /home/user/.bashrc;  npm test'],
      });

      await execBash('npm test');

      expect(lastSpawnArgs[0]).toBe('-c');
      expect(lastSpawnArgs[1]).toBe('source /home/user/.bashrc;  npm test');
    });

    it('uses the spawned shell PATH from getShellPath in env', async () => {
      mockGetShellInitCommand.mockReturnValue('');
      mockGetShellPath.mockReturnValue('/custom/path:/another/path');

      await execBash('echo hello');

      expect(lastSpawnOptions.env.PATH).toBe('/custom/path:/another/path');
    });

    it('preserves complex user commands in the combined output', async () => {
      const initPrefix = 'source /etc/profile; ';
      mockGetShellInitCommand.mockReturnValue(initPrefix);

      const userCmd = 'echo "hello world" && ls -la | grep foo';
      await execBash(userCmd);

      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toBe(`${initPrefix} ${userCmd}`);
    });
  });

  describe('integration with getShellInitCommand and getShellCommandArgs', () => {
    it('combines init prefix and command so direnv export appears before the user command', async () => {
      mockGetShellInitCommand.mockReturnValue(
        'source /etc/profile >/dev/null 2>&1 || true; ' +
          'source /home/user/.bash_profile >/dev/null 2>&1 || true; ' +
          'source /home/user/.bashrc >/dev/null 2>&1 || true; ' +
          'command -v direnv >/dev/null 2>&1 && eval "$(direnv export bash 2>/dev/null)" 2>/dev/null || true; ',
      );
      mockGetShellCommandArgs.mockImplementation((cmd: string) => ({
        shell: '/bin/bash',
        args: ['-c', cmd],
      }));

      await execBash('direnv status');

      const fullCommand = lastSpawnArgs[1] as string;
      expect(fullCommand).toContain('direnv export bash');
      expect(fullCommand).toContain('direnv status');
      expect(fullCommand.indexOf('direnv export bash')).toBeLessThan(fullCommand.indexOf('direnv status'));
    });
  });
});
