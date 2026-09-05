import { describe, expect, it } from 'vitest';

import { balanceFences, normalizePythonCommands, preprocessSkillContent } from './skill-preprocessor';

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
