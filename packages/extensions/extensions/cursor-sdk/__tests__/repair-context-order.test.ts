import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { repairContextOrder, repairFile } from '../repair-context-order.mjs';

const call = (id: string, scope?: string) => ({
  id: `assistant-${id}`,
  role: 'assistant',
  content: [
    {
      type: 'tool-call',
      toolCallId: id,
      toolName: 'power---bash',
      input: { command: 'pwd' },
    },
  ],
  ...(scope ? { promptContext: { id: scope } } : {}),
});
const result = (id: string, scope?: string) => ({
  id,
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: id,
      output: { type: 'text', value: 'output' },
    },
  ],
  ...(scope ? { promptContext: { id: scope } } : {}),
});
const user = { id: 'user', role: 'user', content: 'prompt' };
const document = (messages: unknown[]) => ({
  version: 1,
  contextFiles: ['untouched'],
  contextMessages: messages,
});

const scriptPath = fileURLToPath(new URL('../repair-context-order.mjs', import.meta.url));
const runCli = (...args: string[]) => spawnSync(process.execPath, [scriptPath, ...args], { encoding: 'utf8' });

describe('context ordering repair', () => {
  it('supports single-file dry-run and apply without touching neighboring files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-order-cli-'));
    try {
      const path = join(directory, 'context.json');
      const neighbor = join(directory, 'other-context.json');
      const original = JSON.stringify(document([user, result('one'), call('one')]));
      await writeFile(path, original);
      await writeFile(neighbor, original);
      const dryRun = runCli('--file', path);
      expect(dryRun.status).toBe(0);
      expect(JSON.parse(dryRun.stdout)).toMatchObject({ mode: 'dry-run', files: 1, changed: 1, movedResults: 1 });
      expect(await readFile(path, 'utf8')).toBe(original);
      const applied = runCli('--file', path, '--apply');
      expect(applied.status).toBe(0);
      const report = JSON.parse(applied.stdout);
      expect(report).toMatchObject({ mode: 'apply', files: 1, changed: 1, skipped: 0 });
      expect(await readFile(report.details[0].backup, 'utf8')).toBe(original);
      expect(await readFile(neighbor, 'utf8')).toBe(original);
      expect(JSON.parse(runCli('--file', path).stdout)).toMatchObject({ changed: 0, skipped: 0 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects conflicting targets and reports missing individual files', () => {
    expect(runCli('--project', '/tmp', '--file', '/tmp/context.json').status).not.toBe(0);
    const missing = runCli('--file', join(tmpdir(), 'cursor-order-missing', 'context.json'));
    expect(missing.status).not.toBe(0);
    expect(JSON.parse(missing.stdout)).toMatchObject({ files: 0, skipped: 1 });
  });
  it('reorders results after their owning calls without changing message contents', () => {
    const input = document([
      user,
      result('one'),
      result('two'),
      {
        ...call('one'),
        content: [...call('one').content, ...call('two').content],
      },
    ]);
    const repaired = repairContextOrder(input);
    expect(repaired.changed).toBe(true);
    expect(repaired.document.contextMessages).toEqual([user, input.contextMessages[3], input.contextMessages[1], input.contextMessages[2]]);
    expect(repaired.document.contextFiles).toEqual(input.contextFiles);
    expect(repairContextOrder(repaired.document).changed).toBe(false);
  });

  it('leaves correctly ordered files untouched', () => {
    const input = document([user, call('one'), result('one')]);
    expect(repairContextOrder(input)).toMatchObject({
      changed: false,
      issues: [],
    });
  });

  it('does not cross user-turn boundaries or guess missing calls', () => {
    const input = document([result('one'), user, call('one')]);
    expect(repairContextOrder(input)).toMatchObject({
      changed: false,
      document: input,
    });
    expect(repairContextOrder(input).issues).toHaveLength(1);
  });

  it('skips an entire file containing ambiguous call IDs', () => {
    const input = document([user, result('one'), call('one'), call('one')]);
    expect(repairContextOrder(input)).toMatchObject({
      changed: false,
      document: input,
    });
    expect(repairContextOrder(input).issues[0].reason).toBe('ambiguous call');
  });

  it('uses subagent scopes when matching repeated call IDs', () => {
    const input = document([user, result('one', 'a'), call('one', 'a'), result('one', 'b'), call('one', 'b')]);
    expect(repairContextOrder(input)).toMatchObject({
      changed: true,
      issues: [],
      movedResults: 2,
    });
    expect(repairContextOrder(document([user, result('one', 'a'), call('one', 'b')])).changed).toBe(false);
  });

  it('dry-runs without writing, backs up applied repairs, and applies idempotently', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cursor-order-'));
    try {
      const path = join(directory, 'context.json');
      const original = JSON.stringify(document([user, result('one'), call('one')]), null, 2) + '\n';
      await writeFile(path, original);
      expect((await repairFile(path)).changed).toBe(true);
      expect(await readFile(path, 'utf8')).toBe(original);
      expect(await readdir(directory)).toEqual(['context.json']);
      const applied = await repairFile(path, true);
      expect(await readFile(applied.backup, 'utf8')).toBe(original);
      expect(JSON.parse(await readFile(path, 'utf8')).contextMessages.map((message: { role: string }) => message.role)).toEqual([
        'user',
        'assistant',
        'tool',
      ]);
      expect((await repairFile(path, true)).changed).toBe(false);
      expect(await readdir(directory)).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
