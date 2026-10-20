import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertToOpencodePrompt } from 'ai-sdk-provider-opencode-sdk';

import { historyFingerprint, SessionState } from '../session';

import type { ContextMessage } from '@aiderdesk/extensions';
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'opencode-free-sessions-test-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const history = [
  { id: 'one', role: 'user', content: 'Remember the earlier context' },
  { id: 'two', role: 'assistant', content: 'Acknowledged' },
] as ContextMessage[];
const state = (scope = 'main', workspace = '/workspace', model = 'opencode/free', task = 'task') =>
  new SessionState(root, '/project', task, 'profile', scope, workspace, model);
const checkpoint = async (session: SessionState) => {
  await session.observe({ opencode: { sessionId: 'ses_test' } });
  await session.checkpoint(history);
};

describe('persistent session compatibility', () => {
  it('restores a completed session in a new runtime or extension instance', async () => {
    await checkpoint(state());
    const getSession = vi.fn(async () => ({}));
    expect(await state().restore(historyFingerprint(history), getSession)).toBe('ses_test');
    expect(getSession).toHaveBeenCalledExactlyOnceWith('ses_test');
  });

  it.each(['edited', 'cleared'])('rebuilds after history is %s', async (change) => {
    await checkpoint(state());
    const getSession = vi.fn();
    const changed = change === 'cleared' ? [] : [{ ...history[0], content: 'Edited context' }, history[1]];
    expect(await state().restore(historyFingerprint(changed as ContextMessage[]), getSession)).toBeUndefined();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rebuilds after a model or workspace change', async () => {
    await checkpoint(state());
    expect(await state('main', '/other-workspace').restore(historyFingerprint(history), vi.fn())).toBeUndefined();
    expect(await state('main', '/workspace', 'opencode/other-free').restore(historyFingerprint(history), vi.fn())).toBeUndefined();
  });

  it('keeps task branches and subagent scopes separate', () => {
    expect(state().directory).not.toBe(state('subagent:group-one').directory);
    expect(state('subagent:group-one').directory).not.toBe(state('subagent:group-two').directory);
    expect(state().directory).not.toBe(state('main', '/workspace', 'opencode/free', 'branched-task').directory);
  });

  it('imports history instead of resuming a missing native session', async () => {
    await checkpoint(state());
    expect(await state().restore(historyFingerprint(history), vi.fn().mockRejectedValue({ status: 404 }))).toBeUndefined();
  });

  it('does not silently retry a network failure as a new conversation', async () => {
    await checkpoint(state());
    await expect(state().restore(historyFingerprint(history), vi.fn().mockRejectedValue(new Error('offline')))).rejects.toThrow('offline');
  });

  it('invalidates the old checkpoint before dispatch and requires successful completion', async () => {
    const first = state();
    await checkpoint(first);
    const next = state();
    await next.restore(historyFingerprint(history), vi.fn());
    await next.invalidate();
    expect(await state().restore(historyFingerprint(history), vi.fn())).toBeUndefined();
    await next.checkpoint(history);
    expect(await state().restore(historyFingerprint(history), vi.fn())).toBe('ses_test');
  });

  it('does not reuse a session after an interrupted first turn', async () => {
    await state().observe({ opencode: { sessionId: 'ses_incomplete' } });
    expect(await state().restore(historyFingerprint(history), vi.fn())).toBeUndefined();
  });

  it('tolerates missing or corrupted session records', async () => {
    expect(await state().restore(historyFingerprint(history), vi.fn())).toBeUndefined();
    const session = state();
    await session.invalidate();
    await writeFile(join(session.directory, 'session.json'), '{invalid');
    expect(await state().restore(historyFingerprint(history), vi.fn())).toBeUndefined();
  });

  it('stores the session ID and history checkpoint without embedding transcript text', async () => {
    const session = state();
    await checkpoint(session);
    const file = await readFile(join(session.directory, 'session.json'), 'utf8');
    expect(JSON.parse(file)).toMatchObject({ sessionId: 'ses_test', historyHash: historyFingerprint(history), workspace: '/workspace' });
    expect(file).not.toContain('Remember the earlier context');
  });

  it('ignores message IDs and object-key order, but detects changed content', () => {
    expect(historyFingerprint(history)).toBe(historyFingerprint(history.map((message) => ({ ...message, id: 'different' }))));
    expect(historyFingerprint(history)).not.toBe(historyFingerprint(history.slice(1)));
  });
});

describe('initial history import versus session resume', () => {
  const prompt: LanguageModelV4Prompt = [
    { role: 'user', content: [{ type: 'text', text: 'My secret is FIRST_TURN_TOKEN' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'I will remember it' }] },
    { role: 'user', content: [{ type: 'text', text: 'What was my secret?' }] },
  ];

  it('imports the entire prior context for a fresh SDK-owned session', async () => {
    const result = await convertToOpencodePrompt(prompt, { sessionMode: 'ephemeral' });
    expect(JSON.stringify(result)).toContain('FIRST_TURN_TOKEN');
    expect(JSON.stringify(result)).toContain('What was my secret?');
  });

  it('sends only new input when resuming a populated session', async () => {
    const result = await convertToOpencodePrompt(prompt, { sessionMode: 'existing' });
    expect(JSON.stringify(result)).not.toContain('FIRST_TURN_TOKEN');
    expect(JSON.stringify(result)).toContain('What was my secret?');
  });
});
