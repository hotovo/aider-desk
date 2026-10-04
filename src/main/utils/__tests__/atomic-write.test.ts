import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

import { v4 as uuidv4 } from 'uuid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { atomicWriteJsonFile, cleanupStaleTempFiles } from '@/utils/atomic-write';

describe('atomicWriteJsonFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `aider-desk-atomic-write-${uuidv4()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes pretty-printed JSON to the target file', async () => {
    const target = path.join(tmpDir, 'test.json');
    const data = { name: 'test', value: 42 };

    await atomicWriteJsonFile(target, data);

    const content = await fs.readFile(target, 'utf8');
    expect(JSON.parse(content)).toEqual(data);
    expect(content).toContain('  "name"');
  });

  it('creates missing parent directories', async () => {
    const target = path.join(tmpDir, 'nested', 'dir', 'test.json');

    await atomicWriteJsonFile(target, { ok: true });

    expect(JSON.parse(await fs.readFile(target, 'utf8'))).toEqual({ ok: true });
  });

  it('overwrites an existing file completely', async () => {
    const target = path.join(tmpDir, 'test.json');

    await atomicWriteJsonFile(target, { version: 1, largePayload: 'x'.repeat(5000) });
    await atomicWriteJsonFile(target, { version: 2 });

    const content = await fs.readFile(target, 'utf8');
    expect(JSON.parse(content)).toEqual({ version: 2 });
    expect(content.length).toBeLessThan(100);
  });

  it('leaves no temp files after a successful write', async () => {
    const target = path.join(tmpDir, 'test.json');

    await atomicWriteJsonFile(target, { ok: true });

    const files = await fs.readdir(tmpDir);
    expect(files).toEqual(['test.json']);
  });

  it('does not leave temp files behind when serialization fails', async () => {
    const target = path.join(tmpDir, 'test.json');
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(atomicWriteJsonFile(target, circular)).rejects.toThrow(TypeError);

    const files = await fs.readdir(tmpDir);
    expect(files).toEqual([]);
    await expect(fs.access(target)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('cleanupStaleTempFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `aider-desk-atomic-cleanup-${uuidv4()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes orphaned temp files but keeps the target and other files', async () => {
    const target = path.join(tmpDir, 'test.json');
    await fs.writeFile(target, '{}', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'test.json.123.abc.tmp'), 'partial', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'other.json.456.def.tmp'), 'partial', 'utf8');
    await fs.writeFile(path.join(tmpDir, 'unrelated.json'), '{}', 'utf8');

    await cleanupStaleTempFiles(target);

    const files = (await fs.readdir(tmpDir)).sort();
    expect(files).toEqual(['other.json.456.def.tmp', 'test.json', 'unrelated.json']);
  });

  it('does not throw when the directory does not exist', async () => {
    await expect(cleanupStaleTempFiles(path.join(tmpDir, 'missing', 'test.json'))).resolves.toBeUndefined();
  });
});
