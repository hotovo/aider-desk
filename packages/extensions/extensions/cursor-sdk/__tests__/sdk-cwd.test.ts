import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

const sdkDir = fileURLToPath(new URL('../node_modules/@cursor/sdk', import.meta.url));

type Executor = { cwd: string; getCwd: () => Promise<string>; clone: (cwd?: string) => Executor };
type ShellCore = { getCwd: (id?: string) => Promise<string>; executorFor: (id?: string) => Executor };

const makeExecutor = (cwd: string): Executor => ({
  cwd,
  async getCwd() {
    return this.cwd;
  },
  clone(nextCwd) {
    return makeExecutor(nextCwd ?? this.cwd);
  },
});

describe.skipIf(!existsSync(sdkDir))('installed Cursor SDK workspace routing', () => {
  it.each(['esm', 'cjs'])('uses conversation workspace executors without patching (%s)', (format) => {
    expect(JSON.parse(readFileSync(join(sdkDir, 'package.json'), 'utf8')).version).toBe('1.0.37');
    const directory = join(sdkDir, 'dist', format);
    const source = readdirSync(directory)
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(directory, name), 'utf8'))
      .find((text) => text.includes('conversationExecutors=new Map'));
    expect(source).toBeDefined();
    const text = source!;
    const offset = text.indexOf('conversationExecutors=new Map');
    const start = text.lastIndexOf('class ', offset);
    const end = text.indexOf('class ', offset);
    const classSource = text.slice(start, end);
    const name = classSource.match(/^class (\w+)/)?.[1];
    expect(name).toBeDefined();
    const Core = runInNewContext(`${classSource};${name}`) as new (executor: Executor, workspace: string) => ShellCore;
    const core = new Core(makeExecutor('/host-launch-dir'), '/task-workspace');
    return (async () => {
      expect(await core.getCwd('parent')).toBe('/task-workspace');
      core.executorFor('parent').cwd = '/task-workspace/subdir';
      expect(await core.getCwd('parent')).toBe('/task-workspace/subdir');
      expect(await core.getCwd('child')).toBe('/task-workspace');
      expect(await core.getCwd()).toBe('/host-launch-dir');
    })();
  });
});
