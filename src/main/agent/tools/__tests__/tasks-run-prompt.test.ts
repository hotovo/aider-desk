import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutonomyMode, DefaultTaskState, TaskExecutionMode } from '@common/types';
import { z } from 'zod';

import { createTasksToolset } from '../tasks';
import { ApprovalManager } from '../approval-manager';

import type { AgentProfile, SettingsData } from '@common/types';
import type { Tool } from 'ai';

import { Task } from '@/task';

vi.mock('@/utils/probe', () => ({ search: vi.fn() }));

type RunInput = {
  taskId: string;
  prompt?: string;
  mode?: string;
  autonomyMode?: AutonomyMode;
  executionMode?: TaskExecutionMode.WaitForFinish | TaskExecutionMode.RunInBackground;
};

const deferred = () => {
  let resolve = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('Tasks Tools - run_prompt', () => {
  const targetTask = {
    task: { state: DefaultTaskState.Todo, autonomyMode: AutonomyMode.Guided },
    init: vi.fn(),
    isPromptRunning: vi.fn(),
    saveTask: vi.fn(),
    runPrompt: vi.fn(),
    resumeTask: vi.fn(),
    getContextMessages: vi.fn(),
    addLogMessage: vi.fn(),
  };
  const project = { getTask: vi.fn(), getAgentProfiles: vi.fn(() => []) };
  const caller = { taskId: 'caller', getProject: () => project, addToolMessage: vi.fn() };
  const settings = { taskSettings: { autoGenerateTaskName: true } } as SettingsData;
  const profile = { toolApprovals: {} } as AgentProfile;
  let runTool: Tool<RunInput>;

  const execute = (input: RunInput) => runTool.execute!(input, { toolCallId: 'call', messages: [], context: undefined });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined]);
    targetTask.task = { state: DefaultTaskState.Todo, autonomyMode: AutonomyMode.Guided };
    targetTask.init.mockResolvedValue(undefined);
    targetTask.isPromptRunning.mockReturnValue(false);
    targetTask.saveTask.mockResolvedValue(undefined);
    targetTask.runPrompt.mockResolvedValue([]);
    targetTask.resumeTask.mockResolvedValue(undefined);
    targetTask.getContextMessages.mockResolvedValue([{ role: 'user', content: 'Saved prompt' }]);
    project.getTask.mockReturnValue(targetTask);
    project.getAgentProfiles.mockReturnValue([]);
    runTool = createTasksToolset(settings, caller as unknown as Task, profile)['tasks---run_prompt'] as Tool<RunInput>;
  });

  it('defaults to waiting, allows omitted prompt, and rejects create_only', () => {
    const schema = runTool.inputSchema as z.ZodType<RunInput>;
    expect(schema.parse({ taskId: 'target' })).toEqual({ taskId: 'target', executionMode: TaskExecutionMode.WaitForFinish });
    expect(() => schema.parse({ taskId: 'target', executionMode: TaskExecutionMode.CreateOnly })).toThrow();
    expect(() => schema.parse({ taskId: 'target', prompt: '' })).toThrow();
  });

  it('starts or resumes without adding a new prompt and preserves autonomy when omitted', async () => {
    const result = await execute({ taskId: 'target' });
    expect(targetTask.init).toHaveBeenCalled();
    expect(targetTask.resumeTask).toHaveBeenCalledWith(undefined);
    expect(targetTask.runPrompt).not.toHaveBeenCalled();
    expect(targetTask.saveTask).not.toHaveBeenCalled();
    expect(result).toMatchObject({ taskId: 'target', lastMessage: { content: 'Saved prompt' } });
  });

  it('runs supplied instructions with the requested mode', async () => {
    await execute({ taskId: 'target', prompt: 'Follow up', mode: 'code' });
    expect(targetTask.runPrompt).toHaveBeenCalledWith('Follow up', 'code', false);
    expect(targetTask.resumeTask).not.toHaveBeenCalled();
  });

  it('passes an explicit mode to resume', async () => {
    await execute({ taskId: 'target', mode: 'code' });
    expect(targetTask.resumeTask).toHaveBeenCalledWith('code');
  });

  it('saves explicit autonomy before execution', async () => {
    targetTask.resumeTask.mockImplementation(async () => {
      expect(targetTask.saveTask).toHaveBeenCalledWith({ autonomyMode: AutonomyMode.Autonomous });
    });
    await execute({ taskId: 'target', autonomyMode: AutonomyMode.Autonomous });
    expect(targetTask.resumeTask).toHaveBeenCalled();
  });

  it.each([undefined, 'New prompt'])('waits for execution when prompt is %s', async (prompt) => {
    const execution = deferred();
    const started = deferred();
    const run = async () => {
      started.resolve();
      await execution.promise;
    };
    targetTask.runPrompt.mockImplementation(run);
    targetTask.resumeTask.mockImplementation(run);
    let returned = false;
    const resultPromise = (async () => {
      const result = await execute({ taskId: 'target', prompt });
      returned = true;
      return result;
    })();
    await started.promise;
    expect(returned).toBe(false);
    targetTask.task.state = DefaultTaskState.Interrupted;
    execution.resolve();
    expect(await resultPromise).toMatchObject({ state: DefaultTaskState.Interrupted, result: 'Task has been interrupted' });
  });

  it.each([undefined, 'New prompt'])('returns before background execution finishes when prompt is %s', async (prompt) => {
    const execution = deferred();
    targetTask.runPrompt.mockReturnValue(execution.promise);
    targetTask.resumeTask.mockReturnValue(execution.promise);
    const result = await execute({ taskId: 'target', prompt, executionMode: TaskExecutionMode.RunInBackground });
    expect(result).toMatchObject({ result: 'Task has been started in the background' });
    expect(result).not.toHaveProperty('lastMessage');
    expect(targetTask.saveTask).not.toHaveBeenCalled();
    execution.resolve();
  });

  it('logs background failures on the target task', async () => {
    const execution = deferred();
    targetTask.resumeTask.mockReturnValue(execution.promise);
    await execute({ taskId: 'target', executionMode: TaskExecutionMode.RunInBackground });
    execution.reject(new Error('Execution failed'));
    await execution.promise.catch(() => {});
    expect(targetTask.addLogMessage).toHaveBeenCalledWith('error', 'Background task execution failed: Execution failed');
  });

  it('reports execution errors when waiting', async () => {
    targetTask.resumeTask.mockRejectedValue(new Error('Execution failed'));
    expect(await execute({ taskId: 'target' })).toBe('Error running prompt on task: Execution failed');
  });

  it('rejects self-execution', async () => {
    expect(await execute({ taskId: 'caller' })).toContain('Cannot run the current task');
    expect(targetTask.resumeTask).not.toHaveBeenCalled();
  });

  it.each([true, false])('rejects running tasks (isPromptRunning: %s)', async (running) => {
    targetTask.isPromptRunning.mockReturnValue(running);
    targetTask.task.state = DefaultTaskState.InProgress;
    expect(await execute({ taskId: 'target', autonomyMode: AutonomyMode.Autonomous })).toContain('already running');
    expect(targetTask.saveTask).not.toHaveBeenCalled();
    expect(targetTask.resumeTask).not.toHaveBeenCalled();
  });

  it('requires instructions when there is no saved conversation', async () => {
    targetTask.getContextMessages.mockResolvedValue([]);
    expect(await execute({ taskId: 'target' })).toContain('no saved prompt or conversation');
    expect(targetTask.resumeTask).not.toHaveBeenCalled();
    await execute({ taskId: 'target', prompt: 'Start' });
    expect(targetTask.runPrompt).toHaveBeenCalled();
  });

  it('reports missing tasks', async () => {
    project.getTask.mockReturnValue(undefined);
    expect(await execute({ taskId: 'missing' })).toBe('Task with ID missing not found');
  });

  it('does not change or start the target when approval is denied', async () => {
    vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([false, 'Denied']);
    expect(await execute({ taskId: 'target', autonomyMode: AutonomyMode.Autonomous })).toContain('denied by user');
    expect(targetTask.init).not.toHaveBeenCalled();
    expect(targetTask.saveTask).not.toHaveBeenCalled();
    expect(targetTask.resumeTask).not.toHaveBeenCalled();
  });
});
