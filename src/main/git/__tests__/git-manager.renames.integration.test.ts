import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleGit } from 'simple-git';
import { UpdatedFilesGroupMode } from '@common/types';

import { GitManager } from '../git-manager';

vi.unmock('fs');
vi.unmock('path');

const originalContent = 'first line\nsecond line\nthird line\nfourth line\nfifth line\n';

describe('Updated Files renames', () => {
  let projectPath: string;
  let manager: GitManager;

  beforeEach(async () => {
    vi.stubEnv('GIT_INDEX_FILE', undefined);
    projectPath = await mkdtemp(join(tmpdir(), 'aiderdesk-renames-'));
    manager = new GitManager();
    const git = simpleGit(projectPath);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.invalid');
    await git.addConfig('diff.renames', 'false');
    await git.checkoutLocalBranch('main');
    await writeFile(join(projectPath, 'original.txt'), originalContent);
    await git.add('original.txt');
    await git.commit('initial');
    await git.checkoutLocalBranch('task');
  });

  afterEach(async () => {
    try {
      await rm(projectPath, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    { name: 'local', mode: 'local' as const, group: UpdatedFilesGroupMode.Grouped },
    { name: 'worktree grouped', mode: 'worktree' as const, group: UpdatedFilesGroupMode.Grouped },
    { name: 'worktree flat', mode: 'worktree' as const, group: UpdatedFilesGroupMode.Flat },
  ])('lists and reverts pure uncommitted renames in $name mode', async ({ mode, group }) => {
    await simpleGit(projectPath).mv('original.txt', 'renamed.txt');

    const files = await manager.getUpdatedFiles(projectPath, mode, 'main', group);

    expect(files).toEqual([{ path: 'renamed.txt', previousPath: 'original.txt', additions: 0, deletions: 0, diff: '' }]);
    const diff = await manager.getFileDiff(projectPath, mode, 'main', files[0].path, undefined, files[0].previousPath);
    expect(diff).toContain('rename from original.txt');
    expect(diff).toContain('rename to renamed.txt');
    expect(diff).not.toContain('new file mode');
    await expect(manager.getFileContents(projectPath, mode, 'main', files[0].path, undefined, files[0].previousPath)).resolves.toEqual({
      oldContent: originalContent,
      newContent: originalContent,
    });

    await manager.restoreFile(projectPath, files[0].path, files[0].previousPath);

    expect(await readFile(join(projectPath, 'original.txt'), 'utf8')).toBe(originalContent);
    await expect(readFile(join(projectPath, 'renamed.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await simpleGit(projectPath).status()).files).toEqual([]);
  });

  it.each(['renamed file.txt', 'tab\tand\nnewline.txt', 'quote"and$(literal).txt'])('preserves unusual paths and edits: %j', async (newPath) => {
    const git = simpleGit(projectPath);
    await git.mv('original.txt', newPath);
    await writeFile(join(projectPath, newPath), `${originalContent}added line\n`);
    await git.add(newPath);
    await git.commit('rename and edit');
    const commitHash = (await git.revparse(['HEAD'])).trim();

    const files = await manager.getUpdatedFiles(projectPath, 'worktree', 'main');

    expect(files).toEqual([
      { path: newPath, previousPath: 'original.txt', additions: 1, deletions: 0, diff: '', commitHash, commitMessage: 'rename and edit' },
    ]);
    const diff = await manager.getFileDiff(projectPath, 'worktree', 'main', newPath, commitHash, 'original.txt');
    expect(diff).toContain('rename from original.txt');
    expect(diff).toContain('+added line');
    expect(diff).not.toContain('new file mode');
    await expect(manager.getFileContents(projectPath, 'worktree', 'main', newPath, commitHash, 'original.txt')).resolves.toEqual({
      oldContent: originalContent,
      newContent: `${originalContent}added line\n`,
    });
    expect(await manager.getUpdatedFiles(projectPath, 'worktree', 'main', UpdatedFilesGroupMode.Flat)).toEqual([
      { path: newPath, previousPath: 'original.txt', additions: 1, deletions: 0, diff: '' },
    ]);
  });

  it('reverts only the uncommitted rename when flat mode spans multiple renames', async () => {
    const git = simpleGit(projectPath);
    await git.mv('original.txt', 'intermediate.txt');
    await git.commit('first rename');
    await git.mv('intermediate.txt', 'final.txt');
    const files = await manager.getUpdatedFiles(projectPath, 'worktree', 'main', UpdatedFilesGroupMode.Flat);
    expect(files[0]).toMatchObject({ path: 'final.txt', previousPath: 'original.txt' });

    await manager.restoreFile(projectPath, files[0].path, files[0].previousPath);

    expect(await readFile(join(projectPath, 'intermediate.txt'), 'utf8')).toBe(originalContent);
    await expect(readFile(join(projectPath, 'final.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await git.status()).files).toEqual([]);
  });

  it('reverts edits without undoing an already committed rename', async () => {
    const git = simpleGit(projectPath);
    await git.mv('original.txt', 'renamed.txt');
    await git.commit('rename');
    await writeFile(join(projectPath, 'renamed.txt'), `${originalContent}local edit\n`);
    const files = await manager.getUpdatedFiles(projectPath, 'worktree', 'main', UpdatedFilesGroupMode.Flat);

    await manager.restoreFile(projectPath, files[0].path, files[0].previousPath);

    expect(await readFile(join(projectPath, 'renamed.txt'), 'utf8')).toBe(originalContent);
    expect((await git.status()).files).toEqual([]);
  });

  it('preserves unusual source paths and binary rename records', async () => {
    const git = simpleGit(projectPath);
    const oldPath = 'old\tname\n.bin';
    await writeFile(join(projectPath, oldPath), Buffer.from([0, 1, 2, 3]));
    await git.add(oldPath);
    await git.commit('binary file');
    await git.mv(oldPath, 'new.bin');

    expect(await manager.getUpdatedFiles(projectPath)).toEqual([{ path: 'new.bin', previousPath: oldPath, additions: 0, deletions: 0, diff: '' }]);
    await manager.restoreFile(projectPath, 'new.bin', oldPath);
    expect((await git.status()).files).toEqual([]);
  });

  it('consumes old and new paths before parsing subsequent ordinary file records', async () => {
    const git = simpleGit(projectPath);
    await git.mv('original.txt', 'renamed.txt');
    await writeFile(join(projectPath, 'z-last.txt'), 'new file\n');
    await git.add('z-last.txt');

    expect(await manager.getUpdatedFiles(projectPath)).toEqual([
      { path: 'renamed.txt', previousPath: 'original.txt', additions: 0, deletions: 0, diff: '' },
      { path: 'z-last.txt', additions: 1, deletions: 0, diff: '' },
    ]);
  });
});
