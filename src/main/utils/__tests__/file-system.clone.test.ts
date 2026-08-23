import * as fs from 'fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleGit } from 'simple-git';

import { cloneProjectRepository, parseRepositoryUrl } from '../file-system';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/constants', () => ({
  AIDER_DESK_PROJECTS_DIR: '/home/user/.aider-desk/projects',
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    clone: vi.fn(),
  })),
}));

vi.mock('filenamify', () => {
  const filenamify = (name: string) => name;
  return { __esModule: true, default: Object.assign(filenamify, { default: filenamify }) };
});

describe('parseRepositoryUrl', () => {
  it('parses https URL with .git suffix', () => {
    expect(parseRepositoryUrl('https://github.com/owner/repo.git')).toEqual({
      cloneUrl: 'https://github.com/owner/repo.git',
      repoName: 'repo',
    });
  });

  it('parses https URL without .git suffix and trailing slash', () => {
    expect(parseRepositoryUrl('https://github.com/owner/repo/')).toEqual({
      cloneUrl: 'https://github.com/owner/repo',
      repoName: 'repo',
    });
  });

  it('rejects ssh, SCP-style, and shorthand forms', () => {
    expect(parseRepositoryUrl('ssh://git@github.com:22/owner/repo.git')).toBeNull();
    expect(parseRepositoryUrl('git@github.com:owner/repo.git')).toBeNull();
    expect(parseRepositoryUrl('owner/repo')).toBeNull();
    expect(parseRepositoryUrl('owner/repo.git')).toBeNull();
  });

  it('parses http URL', () => {
    expect(parseRepositoryUrl('http://github.com/owner/repo.git')).toEqual({
      cloneUrl: 'http://github.com/owner/repo.git',
      repoName: 'repo',
    });
  });

  it('trims whitespace', () => {
    expect(parseRepositoryUrl('  https://github.com/owner/repo.git  ')).toEqual({
      cloneUrl: 'https://github.com/owner/repo.git',
      repoName: 'repo',
    });
  });

  it('returns null for invalid URLs', () => {
    expect(parseRepositoryUrl('')).toBeNull();
    expect(parseRepositoryUrl('not a url')).toBeNull();
    expect(parseRepositoryUrl('http://github.com')).toBeNull();
    expect(parseRepositoryUrl('ftp://github.com/owner/repo')).toBeNull();
  });
});

describe('cloneProjectRepository', () => {
  const targetDir = '/tmp/aider-desk-projects';

  const getMockClone = () => {
    const git = vi.mocked(simpleGit).mock.results[0]?.value as { clone: ReturnType<typeof vi.fn> };
    return git.clone;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.promises.readdir).mockResolvedValue([]);
  });

  it('throws on invalid repository URL', async () => {
    await expect(cloneProjectRepository('invalid', targetDir)).rejects.toThrow('Invalid repository URL');
    expect(fs.promises.mkdir).not.toHaveBeenCalled();
  });

  it('uses the default directory when no target directory is provided', async () => {
    const result = await cloneProjectRepository('https://github.com/owner/my-repo.git');

    expect(result).toBe('/home/user/.aider-desk/projects/my-repo');
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/home/user/.aider-desk/projects', { recursive: true });
  });

  it('uses the default directory when target directory is blank', async () => {
    const result = await cloneProjectRepository('https://github.com/owner/my-repo.git', '   ');

    expect(result).toBe('/home/user/.aider-desk/projects/my-repo');
    expect(fs.promises.mkdir).toHaveBeenCalledWith('/home/user/.aider-desk/projects', { recursive: true });
  });

  it('clones repository into target directory', async () => {
    const result = await cloneProjectRepository('https://github.com/owner/my-repo.git', targetDir);

    expect(result).toBe('/tmp/aider-desk-projects/my-repo');
    expect(fs.promises.mkdir).toHaveBeenCalledWith(targetDir, { recursive: true });
    expect(getMockClone()).toHaveBeenCalledWith('https://github.com/owner/my-repo.git', '/tmp/aider-desk-projects/my-repo');
  });

  it('appends suffix when directory name already exists', async () => {
    vi.mocked(fs.promises.readdir).mockResolvedValue(['my-repo'] as unknown as Awaited<ReturnType<typeof fs.promises.readdir>>);

    const result = await cloneProjectRepository('https://github.com/owner/my-repo.git', targetDir);

    expect(result).toBe('/tmp/aider-desk-projects/my-repo-2');
    expect(getMockClone()).toHaveBeenCalledWith('https://github.com/owner/my-repo.git', '/tmp/aider-desk-projects/my-repo-2');
  });

  it('removes partial clone and rethrows on failure', async () => {
    const cloneError = new Error('repository not found');
    vi.mocked(simpleGit).mockImplementation(
      () =>
        ({
          clone: vi.fn().mockRejectedValue(cloneError),
        }) as never,
    );

    await expect(cloneProjectRepository('https://github.com/owner/my-repo.git', targetDir)).rejects.toThrow('repository not found');
    expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/aider-desk-projects/my-repo', { recursive: true, force: true });
  });
});
