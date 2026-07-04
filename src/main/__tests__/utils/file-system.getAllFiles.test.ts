import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('fs');
vi.unmock('path');

const execFileAsync = promisify(execFile);

let getAllFiles: typeof import('@/utils/file-system').getAllFiles;
let AIDER_DESK_PROJECT_RULES_DIR: typeof import('@/constants').AIDER_DESK_PROJECT_RULES_DIR;

const tempDirs: string[] = [];

const createProject = async () => {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-desk-files-'));
  tempDirs.push(projectDir);

  await fs.writeFile(path.join(projectDir, '.gitignore'), '.aider-desk/\n');
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'src', 'tracked.ts'), 'export {};\n');
  await fs.mkdir(path.join(projectDir, AIDER_DESK_PROJECT_RULES_DIR), { recursive: true });
  await fs.writeFile(path.join(projectDir, AIDER_DESK_PROJECT_RULES_DIR, 'copied.md'), '# Rule\n');

  await execFileAsync('git', ['init'], { cwd: projectDir });
  await execFileAsync('git', ['add', '.gitignore', 'src/tracked.ts'], { cwd: projectDir });

  return projectDir;
};

describe('getAllFiles', () => {
  beforeAll(async () => {
    ({ getAllFiles } = await import('@/utils/file-system'));
    ({ AIDER_DESK_PROJECT_RULES_DIR } = await import('@/constants'));
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('includes copied project rule files when using git-backed file discovery', async () => {
    const projectDir = await createProject();

    const files = await getAllFiles(projectDir, true);

    expect(files).toContain('src/tracked.ts');
    expect(files).toContain('.aider-desk/rules/copied.md');
  });

  it('includes copied project rule files when filesystem discovery filters gitignored files', async () => {
    const projectDir = await createProject();

    const files = await getAllFiles(projectDir, false);

    expect(files).toContain('src/tracked.ts');
    expect(files).toContain('.aider-desk/rules/copied.md');
  });
});
