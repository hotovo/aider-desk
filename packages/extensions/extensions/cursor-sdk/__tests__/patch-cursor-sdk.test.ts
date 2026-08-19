import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const patchScriptPath = fileURLToPath(new URL('../patch-cursor-sdk.mjs', import.meta.url));
const ORIGINAL = 'async getCwd(){return this.executor.getCwd()}';
const PATCHED = 'async getCwd(){return this.workspacePath||await this.executor.getCwd()}';
const MARKER = '/* aiderdesk-shell-cwd-patch 1.0.23-shell-cwd-1 */';

let workDir: string;

const createSdkTree = (version: string, occurrences = 1): void => {
  mkdirSync(join(workDir, 'node_modules', '@cursor', 'sdk', 'dist'), { recursive: true });
  cpSync(patchScriptPath, join(workDir, 'patch-cursor-sdk.mjs'));
  writeFileSync(join(workDir, 'node_modules', '@cursor', 'sdk', 'package.json'), JSON.stringify({ version }));
  for (const format of ['esm', 'cjs']) {
    const fileName = format === 'esm' ? '357.js' : '973.js';
    mkdirSync(join(workDir, 'node_modules', '@cursor', 'sdk', 'dist', format));
    writeFileSync(
      join(workDir, 'node_modules', '@cursor', 'sdk', 'dist', format, fileName),
      `const prefix=1;${ORIGINAL.repeat(occurrences)};const suffix=2;`,
    );
  }
};

const readBundle = (format: string): string => {
  const fileName = format === 'esm' ? '357.js' : '973.js';
  return readFileSync(join(workDir, 'node_modules', '@cursor', 'sdk', 'dist', format, fileName), 'utf8');
};

const runPatchScript = (): { status: number; stdout: string; stderr: string } => {
  const result = spawnSync(process.execPath, [join(workDir, 'patch-cursor-sdk.mjs')], { encoding: 'utf8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
};

describe('patch-cursor-sdk shell cwd patch', () => {
  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'cursor-sdk-patch-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('patches both esm and cjs bundles', () => {
    createSdkTree('1.0.23');
    const { status, stdout } = runPatchScript();

    expect(status).toBe(0);
    expect(stdout).toContain('shell cwd fallback');
    for (const format of ['esm', 'cjs']) {
      const patched = readBundle(format);
      expect(patched).toContain(PATCHED);
      expect(patched).not.toContain(ORIGINAL);
      expect(patched.startsWith(MARKER)).toBe(true);
    }
  });

  it('is idempotent when run twice', () => {
    createSdkTree('1.0.23');
    expect(runPatchScript().status).toBe(0);

    const firstRun = readBundle('esm');
    expect(runPatchScript().status).toBe(0);

    expect(readBundle('esm')).toBe(firstRun);
  });

  it('fails on an unexpected SDK version', () => {
    createSdkTree('1.0.24');

    expect(runPatchScript().status).not.toBe(0);
  });

  it('fails when the target string appears more than once', () => {
    createSdkTree('1.0.23', 2);

    const { status, stderr } = runPatchScript();

    expect(status).not.toBe(0);
    expect(stderr).toContain('expected 1');
  });
});
