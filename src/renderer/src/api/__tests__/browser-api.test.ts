import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskExecutionMode } from '@common/types';

import { BrowserApi } from '../browser-api';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  on: vi.fn(),
}));

vi.mock('axios', () => ({
  create: () => ({
    post: mocks.post,
    interceptors: { response: { use: vi.fn() } },
  }),
}));

vi.mock('socket.io-client', () => ({
  io: () => ({
    connected: true,
    on: mocks.on,
    io: { on: vi.fn() },
  }),
}));

describe('BrowserApi prompt submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { taskId: 'task-1' } });
  });

  it('opts into background execution without waiting for completion', async () => {
    const api = new BrowserApi();
    expect(api.runPrompt('/project', 'task-1', 'Hello', 'agent', ['image'])).toBeUndefined();
    await vi.waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/run-prompt', {
        projectDir: '/project',
        taskId: 'task-1',
        prompt: 'Hello',
        mode: 'agent',
        images: ['image'],
        requestId: expect.any(String),
        executionMode: TaskExecutionMode.RunInBackground,
      }),
    );
  });

  it('reports submission errors only to log listeners for the affected task', async () => {
    const api = new BrowserApi();
    const onLog = vi.fn();
    const otherTask = vi.fn();
    const otherProject = vi.fn();
    api.addLogListener('/project', 'task-1', onLog);
    api.addLogListener('/project', 'task-2', otherTask);
    api.addLogListener('/other', 'task-1', otherProject);
    mocks.post.mockRejectedValueOnce(new Error('Submission failed'));
    api.runPrompt('/project', 'task-1', 'Hello');
    await vi.waitFor(() =>
      expect(onLog).toHaveBeenCalledWith({
        baseDir: '/project',
        taskId: 'task-1',
        level: 'error',
        message: 'Submission failed',
        finished: true,
      }),
    );
    expect(otherTask).not.toHaveBeenCalled();
    expect(otherProject).not.toHaveBeenCalled();
  });

  it('continues delivering completion and background error events through the socket', () => {
    const api = new BrowserApi();
    const onCompleted = vi.fn();
    const onLog = vi.fn();
    api.addResponseCompletedListener('/project', 'task-1', onCompleted);
    api.addLogListener('/project', 'task-1', onLog);
    const onEvent = mocks.on.mock.calls.find((call) => call[0] === 'event')?.[1];
    const completed = { baseDir: '/project', taskId: 'task-1', content: 'Done' };
    const error = { baseDir: '/project', taskId: 'task-1', level: 'error', message: 'Execution failed', finished: true };
    onEvent({ type: 'response-completed', data: completed });
    onEvent({ type: 'log', data: error });
    expect(onCompleted).toHaveBeenCalledWith(completed);
    expect(onLog).toHaveBeenCalledWith(error);
  });
});

const taskOperationCases = [
  {
    path: '/project/custom-commands',
    submit: (api: BrowserApi) => api.runCustomCommand('/project', 'task-1', 'review', ['file'], 'agent', ['image']),
    extra: { commandName: 'review', args: ['file'], mode: 'agent', images: ['image'] },
  },
  {
    path: '/project/compact-conversation',
    submit: (api: BrowserApi) => api.compactConversation('/project', 'task-1', 'agent', 'Keep details'),
    extra: { mode: 'agent', customInstructions: 'Keep details' },
  },
  { path: '/project/handoff-conversation', submit: (api: BrowserApi) => api.handoffConversation('/project', 'task-1', 'Tests'), extra: { focus: 'Tests' } },
  {
    path: '/project/init-rules',
    submit: (api: BrowserApi) => api.initProjectRulesFile('/project', 'task-1', 'Focus on tests'),
    extra: { args: 'Focus on tests' },
  },
  { path: '/project/git/resolve-error-with-agent', submit: (api: BrowserApi) => api.resolveGitErrorWithAgent('/project', 'task-1'), extra: {} },
];

describe.each(taskOperationCases)('BrowserApi $path submission', ({ path, submit, extra }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { taskId: 'task-1' } });
  });

  it('requests background execution with a fresh submission ID', async () => {
    const api = new BrowserApi();
    await submit(api);
    await vi.waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(path, {
        ...extra,
        projectDir: '/project',
        taskId: 'task-1',
        executionMode: TaskExecutionMode.RunInBackground,
        requestId: expect.any(String),
      }),
    );
    const firstId = mocks.post.mock.calls[0][1].requestId;
    await submit(api);
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls[1][1].requestId).not.toBe(firstId);
  });

  it('reports submission failures to affected task logs without an unhandled rejection', async () => {
    const api = new BrowserApi();
    const onLog = vi.fn();
    const otherTask = vi.fn();
    const otherProject = vi.fn();
    api.addLogListener('/project', 'task-1', onLog);
    api.addLogListener('/project', 'task-2', otherTask);
    api.addLogListener('/other', 'task-1', otherProject);
    mocks.post.mockRejectedValueOnce(new Error('Submission failed'));
    await submit(api);
    await vi.waitFor(() =>
      expect(onLog).toHaveBeenCalledWith({
        baseDir: '/project',
        taskId: 'task-1',
        level: 'error',
        message: 'Submission failed',
        finished: true,
      }),
    );
    expect(otherTask).not.toHaveBeenCalled();
    expect(otherProject).not.toHaveBeenCalled();
  });
});

it('keeps conflict resolution and code-change requests on their existing contracts', async () => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: {} });
  const api = new BrowserApi();
  await api.resolveConflictsWithAgent('/project', 'task-1');
  expect(mocks.post).toHaveBeenCalledWith('/project/git/resolve-conflicts-with-agent', { projectDir: '/project', taskId: 'task-1' });
  api.runCodeChangeRequests('/project', 'task-1', []);
  await vi.waitFor(() =>
    expect(mocks.post).toHaveBeenCalledWith('/project/run-code-change-requests', {
      projectDir: '/project',
      taskId: 'task-1',
      requests: [],
      createNewTask: undefined,
    }),
  );
});

describe('BrowserApi compaction checkpoints', () => {
  it.each([undefined, 'context.pre-compaction.001.json'])('forwards the checkpoint %s when restoring context', async (checkpointId) => {
    mocks.post.mockReset().mockResolvedValue({ data: { undone: true } });
    const api = new BrowserApi();
    expect(await api.undoContextChange('/project', 'task-1', checkpointId)).toBe(true);
    expect(mocks.post).toHaveBeenCalledWith('/project/undo-context-change', { projectDir: '/project', taskId: 'task-1', checkpointId });
  });
});
