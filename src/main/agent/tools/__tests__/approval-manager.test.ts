import { describe, expect, it, vi } from 'vitest';
import { AgentProfile, AutonomyMode, ToolApprovalState } from '@common/types';
import { jsonSchema, type ToolSet } from 'ai';

import { ApprovalManager } from '../approval-manager';

import type { Task } from '@/task';

const setup = (mode: AutonomyMode, state: ToolApprovalState, toolName = 'power---file_read') => {
  const askQuestion = vi.fn(async () => ['y', undefined]);
  const dispatchExtensionEvent = vi.fn(async (_name: string, event: Record<string, unknown>) => event);
  const data = { autonomyMode: mode };
  const task = {
    task: data,
    taskId: 'task',
    getProjectDir: () => '/project',
    askQuestion,
    dispatchExtensionEvent,
  } as unknown as Task;
  const profile = { toolApprovals: { [toolName]: state } } as AgentProfile;
  const manager = new ApprovalManager(task, profile);
  const tools: ToolSet = { [toolName]: { execute: vi.fn(), inputSchema: jsonSchema({ type: 'object', properties: {} }) } };
  return { approve: manager.createProviderToolApprovalHandler(tools), askQuestion, dispatchExtensionEvent, data, toolName, profile };
};

describe('provider-executed tool approvals', () => {
  for (const toolName of ['power---file_read', 'power---bash']) {
    for (const mode of [AutonomyMode.Manual, AutonomyMode.Guided, AutonomyMode.Autonomous]) {
      for (const state of [ToolApprovalState.Always, ToolApprovalState.Ask, ToolApprovalState.Never]) {
        it(`${toolName}: ${mode} respects ${state}`, async () => {
          const test = setup(mode, state, toolName);
          const input = toolName.endsWith('bash') ? { command: 'pwd' } : { filePath: '/project/file' };
          const decision = await test.approve(toolName, input, 'Approve tool', 'Tool approval');
          expect(decision[0]).toBe(state !== ToolApprovalState.Never);
          expect(test.askQuestion).toHaveBeenCalledTimes(mode === AutonomyMode.Manual && state === ToolApprovalState.Ask ? 1 : 0);
          if (state !== ToolApprovalState.Never) {
            expect(test.dispatchExtensionEvent).toHaveBeenCalledWith('onToolApproval', { toolName, input });
          }
          if (mode === AutonomyMode.Manual && state === ToolApprovalState.Ask) {
            expect(test.askQuestion).toHaveBeenCalledWith(expect.objectContaining({ key: toolName }));
          }
        });
      }
    }
  }

  it('preserves always-for-this-run without approving other tools', async () => {
    const test = setup(AutonomyMode.Manual, ToolApprovalState.Ask);
    test.askQuestion.mockResolvedValue(['r', undefined]);
    await test.approve(test.toolName, {}, 'Approve');
    await test.approve(test.toolName, {}, 'Approve again');
    expect(test.askQuestion).toHaveBeenCalledOnce();
    expect((await test.approve('power---bash', {}, 'Other tool'))[0]).toBe(false);
  });

  it('honors extension vetoes even in Autonomous mode', async () => {
    const test = setup(AutonomyMode.Autonomous, ToolApprovalState.Always);
    test.dispatchExtensionEvent.mockImplementation(async (_name, event) => ({ ...event, blocked: 'Blocked by extension' }));
    expect(await test.approve(test.toolName, {}, 'Approve')).toEqual([false, 'Blocked by extension']);
    expect(test.askQuestion).not.toHaveBeenCalled();
  });

  it('honors onHandleApproval vetoes', async () => {
    const test = setup(AutonomyMode.Guided, ToolApprovalState.Ask);
    test.dispatchExtensionEvent.mockImplementation(async (name, event) => (name === 'onHandleApproval' ? { ...event, blocked: true } : event));
    expect((await test.approve(test.toolName, {}, 'Approve'))[0]).toBe(false);
    expect(test.askQuestion).not.toHaveBeenCalled();
  });

  it('uses current task autonomy after a mode change', async () => {
    const test = setup(AutonomyMode.Manual, ToolApprovalState.Ask);
    await test.approve(test.toolName, {}, 'Approve');
    test.data.autonomyMode = AutonomyMode.Guided;
    await test.approve(test.toolName, {}, 'Approve');
    expect(test.askQuestion).toHaveBeenCalledOnce();
  });

  it('returns the user rejection reason', async () => {
    const test = setup(AutonomyMode.Manual, ToolApprovalState.Ask);
    test.askQuestion.mockResolvedValue(['n', 'Do not read this file']);
    expect(await test.approve(test.toolName, {}, 'Approve')).toEqual([false, 'Do not read this file']);
  });
  it('denies matching bash patterns even when tools auto-approve', async () => {
    const test = setup(AutonomyMode.Autonomous, ToolApprovalState.Always, 'power---bash');
    test.profile.toolSettings = { 'power---bash': { deniedPattern: '^rm;', allowedPattern: '.*' } };
    expect((await test.approve(test.toolName, { command: 'rm file' }, 'Approve'))[0]).toBe(false);
    expect(test.askQuestion).not.toHaveBeenCalled();
  });

  it('skips a Manual prompt for matching allowed bash patterns', async () => {
    const test = setup(AutonomyMode.Manual, ToolApprovalState.Ask, 'power---bash');
    test.profile.toolSettings = { 'power---bash': { allowedPattern: '^pwd$;^ls', deniedPattern: '' } };
    expect((await test.approve(test.toolName, { command: 'pwd' }, 'Approve'))[0]).toBe(true);
    expect(test.askQuestion).not.toHaveBeenCalled();
  });

  it('does not let allowed bash patterns bypass an extension veto', async () => {
    const test = setup(AutonomyMode.Manual, ToolApprovalState.Ask, 'power---bash');
    test.profile.toolSettings = { 'power---bash': { allowedPattern: '.*', deniedPattern: '' } };
    test.dispatchExtensionEvent.mockImplementation(async (_name, event) => ({ ...event, blocked: 'Denied' }));
    expect(await test.approve(test.toolName, { command: 'pwd' }, 'Approve')).toEqual([false, 'Denied']);
    expect(test.askQuestion).not.toHaveBeenCalled();
  });

  it('does not approve Never tools through an allowed bash pattern', async () => {
    const test = setup(AutonomyMode.Autonomous, ToolApprovalState.Never, 'power---bash');
    test.profile.toolSettings = { 'power---bash': { allowedPattern: '.*', deniedPattern: '' } };
    expect((await test.approve(test.toolName, { command: 'pwd' }, 'Approve'))[0]).toBe(false);
  });
});
