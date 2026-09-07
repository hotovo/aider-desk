import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  balanceFences,
  loadBmadConfig,
  normalizePythonCommands,
  preprocessSkillContent,
} from './skill-preprocessor';

describe('normalizePythonCommands', () => {
  it('rewrites bare python3 invocations to uv run', () => {
    expect(normalizePythonCommands('python3 scripts/gen.py')).toBe('uv run scripts/gen.py');
    expect(normalizePythonCommands('PYTHON3 tool.py')).toBe('uv run tool.py');
    expect(normalizePythonCommands('run `python3 x.py` now')).toBe('run `uv run x.py` now');
  });

  it('leaves uv-run invocations untouched', () => {
    expect(normalizePythonCommands('uv run python3 scripts/gen.py')).toBe('uv run python3 scripts/gen.py');
    expect(normalizePythonCommands('uv  run   python3 x.py')).toBe('uv  run   python3 x.py');
  });

  it('ignores plain python without the 3 suffix', () => {
    expect(normalizePythonCommands('python --version')).toBe('python --version');
  });
});

describe('balanceFences', () => {
  it('appends a closing fence for an odd fence count', () => {
    const fragment = 'text\n```md\ncode\n';
    expect(balanceFences(fragment)).toBe(fragment + '\n```\n');
  });

  it('keeps balanced fragments unchanged', () => {
    const fragment = '```md\ncode\n```\nafter';
    expect(balanceFences(fragment)).toBe(fragment);
  });
});

describe('preprocessSkillContent', () => {
  it('resolves known placeholders from config with defaults', () => {
    const out = preprocessSkillContent(
      'Hello {user_name}, write to {planning_artifacts} on {project-root}.',
      { projectDir: 'C:/proj', skillsDir: '.agents/skills', skillName: 'bmad-prd' },
    );
    expect(out).toContain('Hello User,');
    expect(out).toContain('_bmad-output/planning-artifacts');
    expect(out).toContain('C:/proj');
  });

  it('prefers config values over defaults and keeps $ in values literal', () => {
    const out = preprocessSkillContent(
      'Owner {user_name}, budget $100.',
      {
        projectDir: '/p',
        skillsDir: '.agents/skills',
        skillName: 's',
        config: { user_name: 'Team & Co' },
      },
    );
    expect(out).toContain('Owner Team & Co, budget $100.');
  });

  it('normalizes python3 inside the preprocessed content', () => {
    const out = preprocessSkillContent('Run: python3 build.py', {
      projectDir: '/p',
      skillsDir: '.agents/skills',
      skillName: 'bmad-build',
    });
    expect(out).toBe('Run: uv run build.py');
  });
});

describe('loadBmadConfig', () => {
  const createdDirs: string[] = [];

  afterAll(() => {
    for (const dir of createdDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  const makeProject = (files: Record<string, string>): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-config-'));
    createdDirs.push(dir);
    for (const [relPath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    return dir;
  };

  it('prefers config.user.yaml over bmm base and core config', () => {
    const dir = makeProject({
      '_bmad/core/config.yaml': 'user_name: Core\n',
      '_bmad/bmm/config.yaml': 'user_name: Base\n',
      '_bmad/bmm/config.user.yaml': 'user_name: Real\n',
    });
    expect(loadBmadConfig(dir).user_name).toBe('Real');
  });

  it('prefers bmm base config over core when no user override exists', () => {
    const dir = makeProject({
      '_bmad/core/config.yaml': 'user_name: Core\n',
      '_bmad/bmm/config.yaml': 'user_name: Base\n',
    });
    expect(loadBmadConfig(dir).user_name).toBe('Base');
  });

  it('falls back to core config and tolerates missing files', () => {
    const dir = makeProject({ '_bmad/core/config.yaml': 'user_name: Core\n' });
    expect(loadBmadConfig(dir)).toEqual({ user_name: 'Core' });
  });
});
