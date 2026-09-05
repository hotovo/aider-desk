import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBmadInstallFixture } from './install-fixture';
import {
  deriveArtifactTracker,
  groupCatalogBySkill,
  listCatalog,
  normalizeWord,
  orderedPhases,
  outputTokens,
  readInstallation,
  readModuleConfigs,
  resolveCatalogId,
  resolveOutputLocation,
} from './install-registry';
import type { CatalogEntry } from './install-registry';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-install-registry-'));

const dirsToClean: string[] = [];

afterEach(() => {
  while (dirsToClean.length > 0) {
    const dir = dirsToClean.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const makeProject = (): string => {
  const dir = path.join(tmpRoot, `proj-${Math.random().toString(36).slice(2, 10)}`);
  fs.mkdirSync(dir, { recursive: true });
  dirsToClean.push(dir);
  return dir;
};

// A minimal but realistic install: core + bmm, incl. the two sprint-planning
// menu rows (SP plan + SS status) and an internal non-menu skill.
const CORE_BMM_SPEC = {
  version: '6.11.0',
  ides: ['amp'],
  modules: [
    {
      code: 'core',
      configYaml: 'output_folder: _bmad-output\n',
      helpRows: [
        { skill: 'bmad-help', 'display-name': 'Help', 'menu-code': 'BH', phase: 'anytime' },
        { skill: 'bmad-brainstorming', 'display-name': 'Brainstorm Project', 'menu-code': 'BP', phase: 'anytime' },
      ],
    },
    {
      code: 'bmm',
      configYaml: [
        '# BMM Module Configuration',
        '# Version: 6.11.0',
        'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
        'implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"',
        'output_folder: _bmad-output',
      ].join('\n'),
      helpRows: [
        { skill: 'bmad-product-brief', 'display-name': 'Create Brief', 'menu-code': 'CB', phase: 'plan', 'followed-by': 'bmad-prd' },
        {
          skill: 'bmad-prd',
          'display-name': 'Create Edit and Review PRD',
          'menu-code': 'PRD',
          description: 'Facilitated PRD workflow.',
          args: '-A',
          phase: '2-planning',
          'preceded-by': 'bmad-product-brief',
          required: 'true',
          'output-location': 'planning_artifacts',
          outputs: 'prd',
        },
        {
          skill: 'bmad-build',
          'display-name': 'Build',
          'menu-code': 'BD',
          phase: 'ship',
          'preceded-by': 'bmad-sprint-planning',
          required: 'true',
          'output-location': 'implementation_artifacts',
        },
        { skill: 'bmad-sprint-planning', 'display-name': 'Sprint Planning', 'menu-code': 'SP', phase: 'plan', required: 'true' },
        { skill: 'bmad-sprint-planning', 'display-name': 'Sprint Status', 'menu-code': 'SS', action: 'status', phase: 'anytime' },
      ],
    },
    {
      code: 'gds',
      // installed module without module-help.csv on disk
    },
  ],
  skills: [
    { id: 'bmad-help', module: 'core' },
    { id: 'bmad-brainstorming', module: 'core' },
    { id: 'bmad-product-brief', module: 'bmm' },
    { id: 'bmad-prd', module: 'bmm', description: 'Manifest PRD description.' },
    { id: 'bmad-build', module: 'bmm' },
    { id: 'bmad-sprint-planning', module: 'bmm' },
    // internal: installed but intentionally absent from any menu
    { id: 'bmad-agent-dev', module: 'bmm' },
  ],
};

describe('resolveCatalogId', () => {
  it('appends a normalized menu-code suffix', () => {
    expect(resolveCatalogId('bmad-prd', 'PRD')).toBe('bmad-prd#prd');
  });

  it('normalizes whitespace and handles a missing code', () => {
    expect(resolveCatalogId('x', 'Multi Word')).toBe('x#multi-word');
    expect(resolveCatalogId('x', undefined)).toBe('x');
  });
});

describe('readInstallation', () => {
  it('returns null without a standard installation', () => {
    expect(readInstallation(makeProject())).toBeNull();
  });

  it('parses version, modules and ides from the manifest', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const installation = readInstallation(dir);
    expect(installation).not.toBeNull();
    expect(installation!.version).toBe('6.11.0');
    expect(installation!.modules.map((m) => m.code)).toEqual(['core', 'bmm', 'gds']);
    expect(installation!.ides).toEqual(['amp']);
  });
});

describe('readModuleConfigs', () => {
  it('merges per-module configs with later modules winning', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const config = readModuleConfigs(dir);
    expect(config['planning_artifacts']).toBe('{project-root}/_bmad-output/planning-artifacts');
    // output_folder exists in both core and bmm configs - bmm wins
    expect(config['output_folder']).toBe('_bmad-output');
  });

  it('returns {} without an installation', () => {
    expect(readModuleConfigs(makeProject())).toEqual({});
  });
});

describe('listCatalog', () => {
  it('builds the catalog from the method menu joined with installed skills', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const catalog = listCatalog(dir);

    const prd = catalog.find((entry) => entry.skillId === 'bmad-prd');
    expect(prd).toBeDefined();
    expect(prd!.id).toBe('bmad-prd');
    expect(prd!.name).toBe('Create Edit and Review PRD');
    expect(prd!.menuCode).toBe('PRD');
    expect(prd!.module).toBe('bmm');
    expect(prd!.phase).toBe('2-planning');
    expect(prd!.required).toBe(true);
    expect(prd!.argsHint).toBe('-A');
    expect(prd!.description).toBe('Facilitated PRD workflow.');
    expect(prd!.precededBy).toEqual(['bmad-product-brief']);
    expect(prd!.outputLocation).toBe('planning_artifacts');
    expect(prd!.outputs).toEqual(['prd']);
    expect(prd!.skillPath).toBe('.agents/skills/bmad-prd/SKILL.md');
    expect(fs.existsSync(path.join(dir, prd!.skillPath))).toBe(true);
  });

  it('falls back to the manifest description when the menu row has none', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const brief = listCatalog(dir).find((entry) => entry.skillId === 'bmad-product-brief');
    expect(brief).toBeDefined();
    expect(brief!.name).toBe('Create Brief');
    expect(brief!.followedBy).toEqual(['bmad-prd']);
  });

  it('lists both menu rows of a skill with disambiguated ids', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const sprintEntries = listCatalog(dir).filter((entry) => entry.skillId === 'bmad-sprint-planning');
    expect(sprintEntries.map((e) => e.id).sort()).toEqual(['bmad-sprint-planning', 'bmad-sprint-planning#ss']);
    const statusRow = sprintEntries.find((e) => e.action === 'status');
    expect(statusRow?.menuCode).toBe('SS');
  });

  it('excludes internal skills that are absent from every menu', () => {
    const dir = createBmadInstallFixture(makeProject(), CORE_BMM_SPEC);
    const ids = listCatalog(dir).map((entry) => entry.skillId);
    expect(ids).not.toContain('bmad-agent-dev');
  });

  it('skips help rows whose skill is not installed on disk', () => {
    const spec = {
      ...CORE_BMM_SPEC,
      skills: CORE_BMM_SPEC.skills.filter((s) => s.id !== 'bmad-build'),
    };
    const dir = createBmadInstallFixture(makeProject(), spec);
    const ids = listCatalog(dir).map((entry) => entry.skillId);
    expect(ids).not.toContain('bmad-build');
    expect(ids).toContain('bmad-prd');
  });

  it('returns [] without an installation or a skills directory', () => {
    expect(listCatalog(makeProject())).toEqual([]);

    // Installation present but no tool skills dir -> nothing runnable
    const spec = { ...CORE_BMM_SPEC, ides: ['unknown-tool'], skillsDir: '.does-not-exist/skills' };
    const dir = createBmadInstallFixture(makeProject(), spec);
    expect(listCatalog(dir)).toEqual([]);
  });

  it('surfaces additional modules once they are installed', () => {
    const spec = {
      ...CORE_BMM_SPEC,
      modules: [
        ...CORE_BMM_SPEC.modules,
        {
          code: 'cis',
          helpRows: [{ skill: 'cis-create-strategy', 'display-name': 'Create Strategy', 'menu-code': 'CS', phase: 'anytime' }],
        },
      ],
      skills: [...CORE_BMM_SPEC.skills, { id: 'cis-create-strategy', module: 'cis' }],
    };
    const dir = createBmadInstallFixture(makeProject(), spec);
    const cisEntry = listCatalog(dir).find((entry) => entry.module === 'cis');
    expect(cisEntry).toBeDefined();
    expect(cisEntry!.name).toBe('Create Strategy');
  });
});

describe('orderedPhases', () => {
  const entry = (phase: string): CatalogEntry =>
    ({
      id: `x-${phase}`,
      skillId: 'x',
      name: 'X',
      module: 'bmm',
      description: '',
      phase,
      required: false,
      precededBy: [],
      followedBy: [],
      skillPath: '.agents/skills/x/SKILL.md',
    }) as CatalogEntry;

  it('orders known phases by lifecycle and appends unknown ones', () => {
    const order = orderedPhases([entry('ship'), entry('anytime'), entry('future-phase'), entry('plan')]);
    expect(order).toEqual(['plan', 'ship', 'anytime', 'future-phase']);
  });

  it('includes 2-planning between plan and ship', () => {
    const order = orderedPhases([entry('2-planning'), entry('plan'), entry('ship')]);
    expect(order).toEqual(['plan', '2-planning', 'ship']);
  });

  it('returns [] for an empty catalog', () => {
    expect(orderedPhases([])).toEqual([]);
  });
});

describe('normalizeWord', () => {
  it('folds grammatical variants onto a shared stem', () => {
    expect(normalizeWord('Brainstorming')).toBe('brainstorm');
    expect(normalizeWord('briefs')).toBe('brief');
    expect(normalizeWord('stories')).toBe('story');
    expect(normalizeWord('research')).toBe('research');
    expect(normalizeWord('SPEC')).toBe('spec');
    // The naive stem applies equally to tokens and file names, so matching
    // stays consistent even when the stem looks clipped.
    expect(normalizeWord('status')).toBe('statu');
  });
});

describe('outputTokens', () => {
  it('collects normalized words and drops generic stopwords', () => {
    expect(outputTokens(['brainstorming session'])).toEqual(['brainstorm', 'session']);
    expect(outputTokens(['product brief'])).toEqual(['product', 'brief']);
    expect(outputTokens(['SPEC.md + companion files'])).toEqual(['spec', 'companion', 'file']);
    expect(outputTokens(['findings JSON array + markdown report'])).toEqual([
      'finding',
      'array',
      'markdown',
      'report',
    ]);
  });

  it('returns [] without outputs', () => {
    expect(outputTokens([])).toEqual([]);
  });
});

describe('resolveOutputLocation (nested templates)', () => {
  const configs = {
    'project-root': '',
    output_folder: '{project-root}/_bmad-output',
    planning_artifacts: '{project-root}/_bmad-output/planning-artifacts',
  };

  it('resolves config values that themselves contain templates (bmad-method 6.11 style)', () => {
    // This nesting is what broke research tracking in real projects.
    expect(resolveOutputLocation('{planning_artifacts}/research', configs)).toBe(
      '_bmad-output/planning-artifacts/research',
    );
    expect(resolveOutputLocation('{output_folder}/specs/spec-{slug}', configs)).toBeUndefined();
  });

  it('still rejects unknown tokens', () => {
    expect(resolveOutputLocation('{unknown_key}/x', configs)).toBeUndefined();
  });
});

describe('deriveArtifactTracker', () => {
  const baseConfigs = { output_folder: '_bmad-output' };

  it('tracks the brainstorming folder even when files are named brainstorm-*', () => {
    const result = deriveArtifactTracker(
      { outputLocation: '{output_folder}/brainstorming', outputs: ['brainstorming session'], skillId: 'bmad-brainstorming' },
      baseConfigs,
    );
    expect(result).toMatchObject({ ok: true, baseDir: '_bmad-output/brainstorming' });
    if (result.ok) {
      expect(result.tokens).toContain('brainstorm');
    }
  });

  it('falls back to the known prefix when a template segment is unresolvable ({slug})', () => {
    const result = deriveArtifactTracker(
      { outputLocation: '{output_folder}/specs/spec-{slug}', outputs: ['SPEC.md + companion files'], skillId: 'bmad-spec' },
      baseConfigs,
    );
    expect(result).toMatchObject({ ok: true, baseDir: '_bmad-output/specs' });
    if (result.ok) {
      expect(result.tokens).toContain('spec');
    }
  });

  it('resolves bare config keys with nested templates (product brief)', () => {
    const result = deriveArtifactTracker(
      {
        outputLocation: 'planning_artifacts',
        outputs: ['product brief'],
        skillId: 'bmad-product-brief',
      },
      { planning_artifacts: '{project-root}/_bmad-output/planning-artifacts' },
    );
    expect(result).toMatchObject({ ok: true, baseDir: '_bmad-output/planning-artifacts' });
    if (result.ok) {
      expect(result.tokens).toEqual(expect.arrayContaining(['product', 'brief']));
    }
  });

  it('adds the base folder name as a recognition token (deep recon)', () => {
    const result = deriveArtifactTracker(
      {
        outputLocation: '{planning_artifacts}/research',
        outputs: ['research report/summary + optional html briefing'],
        skillId: 'bmad-deep-recon',
      },
      { planning_artifacts: '{project-root}/_bmad-output/planning-artifacts' },
    );
    expect(result).toMatchObject({ ok: true, baseDir: '_bmad-output/planning-artifacts/research' });
    if (result.ok) {
      expect(result.tokens).toContain('research');
    }
  });

  it('reports why an entry cannot be tracked', () => {
    expect(deriveArtifactTracker({ outputLocation: undefined, outputs: ['prd'], skillId: 'a' }, {})).toEqual({
      ok: false,
      reason: 'no-output-location',
    });
    expect(deriveArtifactTracker({ outputLocation: '_bmad-output', outputs: [], skillId: 'b' }, {})).toEqual({
      ok: false,
      reason: 'no-outputs',
    });
    expect(
      deriveArtifactTracker({ outputLocation: '{unknown_root}/reports', outputs: ['research report'], skillId: 'c' }, {}),
    ).toEqual({
      ok: false,
      reason: 'unresolvable-location',
    });
    expect(deriveArtifactTracker({ outputLocation: '{project-root}', outputs: ['prd'], skillId: 'd' }, {})).toEqual({
      ok: false,
      reason: 'unresolvable-location',
    });
  });
});

describe('groupCatalogBySkill', () => {
  const row = (id: string, skillId: string, module: string): CatalogEntry =>
    ({
      id,
      skillId,
      name: id,
      module,
      description: '',
      phase: 'anytime',
      required: false,
      precededBy: [],
      followedBy: [],
      skillPath: '.agents/skills/x/SKILL.md',
    }) as CatalogEntry;

  it('collapses duplicate menu rows of one skill across modules', () => {
    const groups = groupCatalogBySkill([
      row('bmad-brainstorming#bp', 'bmad-brainstorming', 'bmm'),
      row('bmad-prd', 'bmad-prd', 'bmm'),
      row('bmad-brainstorming#bsp', 'bmad-brainstorming', 'core'),
    ]);
    expect(groups.map((g) => g.skillId)).toEqual(['bmad-brainstorming', 'bmad-prd']);
    const brainstorming = groups[0];
    expect(brainstorming.entries.map((e) => e.id)).toEqual(['bmad-brainstorming#bp', 'bmad-brainstorming#bsp']);
    expect(brainstorming.representative.id).toBe('bmad-brainstorming#bp');
    expect(brainstorming.representative.module).toBe('bmm');
  });

  it('prefers a lifecycle-phase row as representative when the first row is anytime', () => {
    const group = groupCatalogBySkill([
      row('bmad-brainstorming#bsp', 'bmad-brainstorming', 'core'),
      { ...row('bmad-brainstorming#bp', 'bmad-brainstorming', 'bmm'), phase: 'plan' },
    ]);
    // core lists brainstorming as 'anytime' helper, bmm under 'plan': the
    // lifecycle row must win so progress attributes the skill correctly.
    expect(group[0].representative.id).toBe('bmad-brainstorming#bp');
    expect(group[0].representative.phase).toBe('plan');
  });
});
