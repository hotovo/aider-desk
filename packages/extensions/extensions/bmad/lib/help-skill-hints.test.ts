import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

import {
  applyStateHintsToSkill,
  buildStateHints,
  hasStateHints,
  injectHelpSkillStateHints,
  STATE_HINTS_END,
  STATE_HINTS_START,
  stripStateHints,
} from './help-skill-hints';
import { createBmadInstallFixture } from './install-fixture';

const BMM_CONFIG = [
  'output_folder: "{project-root}/_bmad-output"',
  'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
  'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"',
].join('\n');

const CATALOG_PROJECT = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hints-catalog-'));
  createBmadInstallFixture(dir, {
    modules: [
      {
        code: 'bmm',
        configYaml: BMM_CONFIG,
        helpRows: [
          {
            skill: 'bmad-prd',
            'display-name': 'PRD',
            'menu-code': 'PRD',
            phase: 'plan',
            required: 'true',
            'output-location': 'planning_artifacts',
            outputs: 'prd',
          },
          {
            skill: 'bmad-create-epics-and-stories',
            'display-name': 'Create Epics and Stories',
            'menu-code': 'CE',
            phase: 'plan',
            'preceded-by': 'bmad-architecture',
            required: 'true',
            'output-location': 'planning_artifacts',
            outputs: 'epics and stories',
          },
          {
            skill: 'bmad-sprint-planning',
            'display-name': 'Sprint Planning',
            'menu-code': 'SP',
            phase: 'ship',
            'preceded-by': 'bmad-create-epics-and-stories',
            required: 'true',
          },
          {
            skill: 'bmad-sprint-planning',
            action: 'status',
            'display-name': 'Sprint Status',
            'menu-code': 'SS',
            phase: 'ship',
            'output-location': 'implementation_artifacts',
            outputs: 'sprint status',
          },
        ],
      },
    ],
    skills: [
      { id: 'bmad-prd', module: 'bmm' },
      { id: 'bmad-create-epics-and-stories', module: 'bmm' },
      { id: 'bmad-sprint-planning', module: 'bmm' },
      { id: 'bmad-architecture', module: 'bmm' },
      { id: 'bmad-help', module: 'core' },
    ],
  });
  return dir;
};

const HELPLESS_PROJECT = (): string => {
  // A catalog whose every row lacks artifact metadata: nothing trackable.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hints-empty-'));
  createBmadInstallFixture(dir, {
    modules: [
      {
        code: 'bmm',
        configYaml: BMM_CONFIG,
        helpRows: [{ skill: 'bmad-help', phase: 'anytime' }],
      },
    ],
    skills: [{ id: 'bmad-help', module: 'core' }],
  });
  return dir;
};

describe('buildStateHints', () => {
  it('emits one line per tracked row with resolved roots and folded tokens', () => {
    const hints = buildStateHints(CATALOG_PROJECT());

    expect(hints).toContain(STATE_HINTS_START);
    expect(hints).toContain(STATE_HINTS_END);
    // epics row: raw outputs wording, folding is explained by rule 1
    expect(hints).toContain(
      '- [CE] `bmad-create-epics-and-stories`: scan `_bmad-output/planning-artifacts` recursively; expected words: epics, stories',
    );
    // prd row shares the root but keeps its own signature
    expect(hints).toContain('- [PRD] `bmad-prd`: scan `_bmad-output/planning-artifacts`');
    // sprint status row resolves through implementation_artifacts
    expect(hints).toContain('`bmad-sprint-planning`: scan `_bmad-output/implementation-artifacts`');
    // Row without output-location is not listed as scannable (only as a
    // shared-skill exception in rule 4)
    expect(hints).not.toContain('- [SP]');
  });

  it('lists untracked rows sharing a skill with a tracked row as an exception', () => {
    const hints = buildStateHints(CATALOG_PROJECT());

    // In the fixture, [SP] Sprint Planning has no output-location while the
    // [SS] Sprint Status row of the same skill is tracked.
    expect(hints).toContain(
      'Exception: [SP] `bmad-sprint-planning` share their skill with a tracked row - treat them as done whenever that tracked row\'s artifact exists.',
    );
  });

  it('names sprint-status.yaml as the implementation authority', () => {
    const hints = buildStateHints(CATALOG_PROJECT());

    expect(hints).toContain('_bmad-output/implementation-artifacts/sprint-status.yaml');
    expect(hints).toContain('development_status');
    expect(hints).toContain('epics.md');
  });

  it('returns an empty string when no catalog row is trackable', () => {
    expect(buildStateHints(HELPLESS_PROJECT())).toBe('');
  });
});

describe('applyStateHintsToSkill / stripStateHints', () => {
  const BASE = '# BMad Help\n\n## Constraints\n\n- fresh context\n';

  it('appends the block while preserving the original content', () => {
    const composed = applyStateHintsToSkill(BASE, `${STATE_HINTS_START}\nHINTS\n${STATE_HINTS_END}`);

    expect(composed.startsWith(BASE)).toBe(true);
    expect(hasStateHints(composed)).toBe(true);
    expect(composed.endsWith(`${STATE_HINTS_END}\n`)).toBe(true);
  });

  it('strips previously injected blocks completely', () => {
    const composed = applyStateHintsToSkill(BASE, `${STATE_HINTS_START}\nOLD HINTS\n${STATE_HINTS_END}`);
    // The separator lines ahead of the marker are not part of the block.
    expect(stripStateHints(composed)).toBe('# BMad Help\n\n## Constraints\n\n- fresh context\n\n');
  });
});

describe('injectHelpSkillStateHints', () => {
  it('writes the block once and reports unchanged on re-runs (idempotent)', () => {
    const dir = CATALOG_PROJECT();
    const skillPath = path.join(dir, '.agents', 'skills', 'bmad-help', 'SKILL.md');
    const original = fs.readFileSync(skillPath, 'utf-8');

    expect(injectHelpSkillStateHints(dir)).toBe('updated');

    const once = fs.readFileSync(skillPath, 'utf-8');
    expect(hasStateHints(once)).toBe(true);
    expect(once.startsWith(original.trimEnd())).toBe(true);

    const markerCount = once.split(STATE_HINTS_START).length - 1;
    expect(markerCount).toBe(1);

    expect(injectHelpSkillStateHints(dir)).toBe('unchanged');
    expect(fs.readFileSync(skillPath, 'utf-8')).toBe(once);
  });

  it('replaces a stale block when upstream content changed between runs', () => {
    const dir = CATALOG_PROJECT();
    const skillPath = path.join(dir, '.agents', 'skills', 'bmad-help', 'SKILL.md');

    injectHelpSkillStateHints(dir);
    // Simulate an installer update: fresh upstream SKILL.md that still carries
    // a previous hints block from the last extension session.
    fs.writeFileSync(
      skillPath,
      `# BMad Help v6.11.1-new-menu\n\n${STATE_HINTS_START}\n\n## State detection hints\n\n- STALE CONTENT ROW: scan \`/gone\`\n${STATE_HINTS_END}\n`,
      'utf-8',
    );

    expect(injectHelpSkillStateHints(dir)).toBe('updated');
    const result = fs.readFileSync(skillPath, 'utf-8');
    expect(result).toContain('# BMad Help v6.11.1-new-menu');
    expect(result.split(STATE_HINTS_START).length - 1).toBe(1);
    expect(result).not.toContain('STALE CONTENT');
    expect(result).toContain('[CE]');
  });

  it('reports unchanged (no write) when there is nothing trackable to say', () => {
    const dir = HELPLESS_PROJECT();
    const skillPath = path.join(dir, '.agents', 'skills', 'bmad-help', 'SKILL.md');
    const before = fs.readFileSync(skillPath, 'utf-8');

    expect(injectHelpSkillStateHints(dir)).toBe('unchanged');
    expect(fs.readFileSync(skillPath, 'utf-8')).toBe(before);
  });

  it('skips projects without an installed bmad-help skill', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-hints-bare-'));
    fs.mkdirSync(path.join(dir, '_bmad', '_config'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, '_bmad', '_config', 'manifest.yaml'),
      'installation:\n  version: 6.11.0\nmodules:\nides:\n  - amp\n',
      'utf-8',
    );

    expect(injectHelpSkillStateHints(dir)).toBe('skipped');
  });
});
