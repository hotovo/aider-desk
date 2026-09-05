import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BmadManager, DEFAULT_STATUS_CACHE_TTL_MS, resolveStatusCacheTtlMs, resolveUpdatePackage, STATUS_CACHE_TTL_ENV } from './bmad-manager';
import { createBmadInstallFixture } from './install-fixture';
import type { UpdateInfo } from './types';
import type { ExtensionContext } from '@aiderdesk/extensions';

const fakeContext = { log: () => undefined } as unknown as ExtensionContext;

describe('resolveUpdatePackage (C1: update must move past the pin)', () => {
  const info = (patch: Partial<UpdateInfo>): UpdateInfo => ({
    currentVersion: '6.11.0',
    latestPatchVersion: '',
    updateAvailable: false,
    lastChecked: 0,
    ...patch,
  });

  it('returns the concrete target spec when an update is available', () => {
    expect(resolveUpdatePackage(info({ updateAvailable: true, latestPatchVersion: '6.11.3' }))).toBe(
      'bmad-method@6.11.3',
    );
  });

  it('returns undefined when no update is available', () => {
    expect(resolveUpdatePackage(info({ updateAvailable: false, latestPatchVersion: '6.11.0' }))).toBeUndefined();
  });

  it('returns undefined for unparseable target versions', () => {
    expect(resolveUpdatePackage(info({ updateAvailable: true, latestPatchVersion: 'next' }))).toBeUndefined();
    expect(resolveUpdatePackage(info({ updateAvailable: true, latestPatchVersion: '' }))).toBeUndefined();
  });

  it('returns undefined for null/undefined input', () => {
    expect(resolveUpdatePackage(null)).toBeUndefined();
    expect(resolveUpdatePackage(undefined)).toBeUndefined();
  });
});

describe('BmadManager.resetWorkflow', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-reset-'));
    fs.mkdirSync(path.join(dir, '_bmad-output'), { recursive: true });
    fs.writeFileSync(path.join(dir, '_bmad-output', 'artifact.md'), '# done\n');
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('moves _bmad-output to a timestamped trash folder instead of deleting', async () => {
    const manager = new BmadManager(dir, fakeContext);
    const result = await manager.resetWorkflow();
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(dir, '_bmad-output'))).toBe(false);
    const trashDirs = fs.readdirSync(dir).filter((n) => n.startsWith('_bmad-output-trash-'));
    expect(trashDirs.length).toBe(1);
    expect(fs.existsSync(path.join(dir, trashDirs[0], 'artifact.md'))).toBe(true);
    expect(result.message).toContain(trashDirs[0]);
  });

  it('creates a second trash folder on repeated resets', async () => {
    const manager = new BmadManager(dir, fakeContext);
    await manager.resetWorkflow();
    fs.mkdirSync(path.join(dir, '_bmad-output'), { recursive: true });
    await manager.resetWorkflow();
    const trashDirs = fs.readdirSync(dir).filter((n) => n.startsWith('_bmad-output-trash-'));
    expect(trashDirs.length).toBe(2);
  });

  it('succeeds without touching anything when no output dir exists', async () => {
    fs.rmSync(path.join(dir, '_bmad-output'), { recursive: true, force: true });
    const manager = new BmadManager(dir, fakeContext);
    const result = await manager.resetWorkflow();
    expect(result.success).toBe(true);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });
});

describe('BmadManager status against a standard installation', () => {
  let dir: string;
  beforeEach(() => {
    // These tests mutate artifacts between status calls and rely on freshness.
    process.env[STATUS_CACHE_TTL_ENV] = '0';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-status-'));
  });
  afterEach(() => {
    delete process.env[STATUS_CACHE_TTL_ENV];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const install = (): void => {
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      ides: ['amp'],
      modules: [
        { code: 'core', configYaml: 'output_folder: _bmad-output\n' },
        {
          code: 'bmm',
          configYaml: [
            'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
            'output_folder: _bmad-output',
          ].join('\n'),
          helpRows: [
            { skill: 'bmad-prd', 'display-name': 'Create PRD', 'menu-code': 'PRD', phase: '2-planning', required: 'true', 'output-location': 'planning_artifacts', outputs: 'prd' },
            { skill: 'bmad-help', 'display-name': 'Help', 'menu-code': 'BH', phase: 'anytime' },
          ],
        },
      ],
      skills: [
        { id: 'bmad-help', module: 'core' },
        { id: 'bmad-prd', module: 'bmm' },
        { id: 'bmad-agent-dev', module: 'bmm' },
      ],
    });
  };

  it('detects any standard installation via the manifest (not the bmm folder)', () => {
    const manager = new BmadManager(dir, fakeContext);
    expect(manager.checkInstallation()).toBe(false);
    install();
    expect(manager.checkInstallation()).toBe(true);
  });

  it('reads the installed version from manifest.yaml', () => {
    const manager = new BmadManager(dir, fakeContext);
    expect(manager.getVersion()).toBeUndefined();
    install();
    expect(manager.getVersion()).toBe('6.11.0');
  });

  it('builds the status from the method catalog and derives tracking globs', async () => {
    install();
    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();

    expect(status.installed).toBe(true);
    expect(status.version).toBe('6.11.0');
    expect(status.modules.map((m) => m.code)).toEqual(['core', 'bmm']);
    expect(status.skillsDir).toBe('.agents/skills');

    // Menu entries only - internal skills stay out of the catalog
    expect(status.catalog.map((e) => e.skillId).sort()).toEqual(['bmad-help', 'bmad-prd']);

    // prd has a resolvable output location; help has none
    expect(Object.keys(status.trackedEntries)).toEqual(['bmad-prd']);
    expect(status.trackedEntries['bmad-prd']).toEqual({
      baseDir: '_bmad-output/planning-artifacts',
      tokens: expect.arrayContaining(['prd']),
    });
  });

  it('classifies artifact completion generically from frontmatter status', async () => {
    install();
    const manager = new BmadManager(dir, fakeContext);

    // No artifacts yet
    let status = await manager.getBmadStatus();
    expect(status.completedWorkflows).toEqual([]);
    expect(status.inProgressWorkflows).toEqual([]);

    // Draft PRD -> in progress
    const prdDir = path.join(dir, '_bmad-output', 'planning-artifacts', 'prds', 'epic-1');
    fs.mkdirSync(prdDir, { recursive: true });
    fs.writeFileSync(path.join(prdDir, 'prd.md'), '---\nstatus: draft\n---\n# PRD');
    status = await manager.getBmadStatus();
    expect(status.inProgressWorkflows).toEqual(['bmad-prd']);
    expect(status.detectedArtifacts['bmad-prd']?.status).toBe('draft');
    expect(status.incompleteWorkflows?.[0]?.workflowId).toBe('bmad-prd');

    // Finalized -> completed
    fs.writeFileSync(path.join(prdDir, 'prd.md'), '---\nstatus: approved\n---\n# PRD');
    status = await manager.getBmadStatus();
    expect(status.completedWorkflows).toEqual(['bmad-prd']);
    expect(status.inProgressWorkflows).toEqual([]);

    // Artifact without frontmatter -> completed ("no status = completed")
    fs.writeFileSync(path.join(prdDir, 'prd.md'), '# PRD no frontmatter');
    status = await manager.getBmadStatus();
    expect(status.completedWorkflows).toEqual(['bmad-prd']);
  });

  it('treats stale active-status artifacts as completed (recency rule)', async () => {
    // Brief + PRD rows so a downstream artifact can outdate an active-status
    // draft (BMAD never finalizes briefs - 'draft' is their resting state).
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      ides: ['amp'],
      modules: [
        { code: 'core', configYaml: 'output_folder: _bmad-output\n' },
        {
          code: 'bmm',
          configYaml: [
            'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
            'output_folder: _bmad-output',
          ].join('\n'),
          helpRows: [
            { skill: 'bmad-product-brief', 'display-name': 'Create Brief', 'menu-code': 'CB', phase: 'plan', 'output-location': 'planning_artifacts', outputs: 'product brief' },
            { skill: 'bmad-prd', 'display-name': 'Create PRD', 'menu-code': 'PRD', phase: '2-planning', required: 'true', 'preceded-by': 'bmad-product-brief', 'output-location': 'planning_artifacts', outputs: 'prd' },
          ],
        },
      ],
      skills: [
        { id: 'bmad-help', module: 'core' },
        { id: 'bmad-product-brief', module: 'bmm' },
        { id: 'bmad-prd', module: 'bmm' },
      ],
    });

    const manager = new BmadManager(dir, fakeContext);
    const briefPath = path.join(dir, '_bmad-output', 'planning-artifacts', 'briefs', 'run-1', 'brief.md');
    const prdPath = path.join(dir, '_bmad-output', 'planning-artifacts', 'prds', 'run-1', 'prd.md');
    fs.mkdirSync(path.dirname(briefPath), { recursive: true });
    fs.mkdirSync(path.dirname(prdPath), { recursive: true });

    // A finished brief (draft is its resting status) that predates the
    // finalized PRD: the draft must NOT keep the brief "in progress".
    fs.writeFileSync(briefPath, '---\nstatus: draft\n---\n# Brief');
    fs.writeFileSync(prdPath, '---\nstatus: final\n---\n# PRD');
    const past = new Date(Date.now() - 86_400_000);
    fs.utimesSync(briefPath, past, past);

    const status = await manager.getBmadStatus();
    expect(status.inProgressWorkflows).toEqual([]);
    expect([...status.completedWorkflows].sort()).toEqual(['bmad-prd', 'bmad-product-brief']);

    // A draft that IS the newest artifact stays in progress (real active work).
    fs.writeFileSync(briefPath, '---\nstatus: draft\n---\n# Brief v2');
    const active = await manager.getBmadStatus();
    expect(active.inProgressWorkflows).toEqual(['bmad-product-brief']);
    expect(active.completedWorkflows).toEqual(['bmad-prd']);
  });

  it('resolves catalog entries for continuation lookups and rejects unknown ids', async () => {
    install();
    const manager = new BmadManager(dir, fakeContext);

    expect(manager.getCatalogEntry('bmad-prd')?.menuCode).toBe('PRD');
    expect(manager.getCatalogEntry('create-prd')).toBeUndefined(); // clean break vs v1 ids
  });
});

describe('BmadManager.getBmadStatus cache', () => {
  let dir: string;
  let install: () => void;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-statuscache-'));
    install = () => {
      createBmadInstallFixture(dir, {
        version: '6.11.0',
        ides: ['amp'],
        modules: [
          { code: 'core', configYaml: 'output_folder: _bmad-output\n' },
          { code: 'bmm', configYaml: 'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"\n' },
        ],
        skills: [{ id: 'bmad-help', module: 'core' }],
      });
    };
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('returns the same object within the TTL window (one scan)', async () => {
    install();
    const manager = new BmadManager(dir, fakeContext);

    const first = await manager.getBmadStatus();
    const second = await manager.getBmadStatus();
    expect(second).toBe(first);
  });

  it('recomputes after the configured TTL elapsed', async () => {
    process.env[STATUS_CACHE_TTL_ENV] = '5';
    try {
      install();
      const manager = new BmadManager(dir, fakeContext);

      const first = await manager.getBmadStatus();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const second = await manager.getBmadStatus();
      expect(second).not.toBe(first);
    } finally {
      delete process.env[STATUS_CACHE_TTL_ENV];
    }
  });

  it('TTL 0 disables caching entirely', async () => {
    process.env[STATUS_CACHE_TTL_ENV] = '0';
    try {
      install();
      const manager = new BmadManager(dir, fakeContext);

      const first = await manager.getBmadStatus();
      const second = await manager.getBmadStatus();
      expect(second).not.toBe(first);
    } finally {
      delete process.env[STATUS_CACHE_TTL_ENV];
    }
  });

  it('resetWorkflow invalidates the cache immediately', async () => {
    install();
    fs.mkdirSync(path.join(dir, '_bmad-output'), { recursive: true });
    fs.writeFileSync(path.join(dir, '_bmad-output', 'artifact.md'), '# done\n');
    const manager = new BmadManager(dir, fakeContext);

    const first = await manager.getBmadStatus();
    const second = await manager.getBmadStatus();
    expect(second).toBe(first);

    await manager.resetWorkflow();

    const afterReset = await manager.getBmadStatus();
    expect(afterReset).not.toBe(first);
  });
});

describe('resolveStatusCacheTtlMs', () => {
  it('falls back to the default for missing or invalid values', () => {
    expect(resolveStatusCacheTtlMs(undefined)).toBe(3000);
    expect(resolveStatusCacheTtlMs('not-a-number')).toBe(3000);
    expect(resolveStatusCacheTtlMs('-5')).toBe(3000);
  });

  it('accepts explicit overrides including 0 (disabled)', () => {
    expect(resolveStatusCacheTtlMs('0')).toBe(0);
    expect(resolveStatusCacheTtlMs('500')).toBe(500);
  });

  it('exposes the default TTL constant used by resolveStatusCacheTtlMs', () => {
    expect(DEFAULT_STATUS_CACHE_TTL_MS).toBeGreaterThan(0);
  });
});

describe('artifact detection against real bmad-method 6.11 output layouts', () => {
  let dir: string;
  beforeEach(() => {
    // These tests mutate artifacts between status calls and rely on freshness.
    process.env[STATUS_CACHE_TTL_ENV] = '0';
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-detect-'));
  });
  afterEach(() => {
    delete process.env[STATUS_CACHE_TTL_ENV];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const install = (): void => {
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      ides: ['amp'],
      modules: [
        { code: 'core', configYaml: 'output_folder: _bmad-output\n' },
        {
          code: 'bmm',
          configYaml: [
            'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"',
            'output_folder: _bmad-output',
          ].join('\n'),
          helpRows: [
            { skill: 'bmad-brainstorming', 'display-name': 'Brainstorm Project', 'menu-code': 'BP', phase: 'plan', 'output-location': '{output_folder}/brainstorming', outputs: 'brainstorming session' },
            { skill: 'bmad-deep-recon', 'display-name': 'Deep Recon', 'menu-code': 'RS', phase: 'anytime', 'output-location': '{planning_artifacts}/research', outputs: 'research report/summary + optional html briefing' },
            { skill: 'bmad-product-brief', 'display-name': 'Create Brief', 'menu-code': 'CB', phase: 'plan', 'output-location': 'planning_artifacts', outputs: 'product brief' },
          ],
        },
      ],
      skills: [
        { id: 'bmad-help', module: 'core' },
        { id: 'bmad-brainstorming', module: 'bmm' },
        { id: 'bmad-deep-recon', module: 'bmm' },
        { id: 'bmad-product-brief', module: 'bmm' },
      ],
    });
  };

  it('counts brainstorm-* artifacts as completed brainstorming (no frontmatter)', async () => {
    install();
    const brainstormDir = path.join(dir, '_bmad-output', 'brainstorming', 'brainstorm-cli-agent-2026-08-25');
    fs.mkdirSync(brainstormDir, { recursive: true });
    // Real-world naming: no frontmatter, gerund-less file name
    fs.writeFileSync(path.join(brainstormDir, 'brainstorm-intent.md'), '# Brainstorm Intent\n');

    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();
    expect(status.completedWorkflows).toContain('bmad-brainstorming');
  });

  it('resolves nested config templates so research artifacts are tracked', async () => {
    install();
    const researchDir = path.join(
      dir,
      '_bmad-output',
      'planning-artifacts',
      'research',
      'technical-stack-2026-08-25',
    );
    fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(
      path.join(researchDir, 'research.md'),
      '---\ntitle: technical research\ntype: technical\n---\n# Research',
    );

    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();
    expect(status.trackedEntries['bmad-deep-recon']).toBeDefined();
    expect(status.completedWorkflows).toContain('bmad-deep-recon');
  });

  it('prefers briefs/ over unrelated brief.md files for the product brief', async () => {
    install();
    const briefsDir = path.join(dir, '_bmad-output', 'planning-artifacts', 'briefs', 'brief-agent-one-2026-08-25');
    fs.mkdirSync(briefsDir, { recursive: true });
    fs.writeFileSync(path.join(briefsDir, 'brief.md'), '# Product Brief\n');
    const researchDir = path.join(dir, '_bmad-output', 'planning-artifacts', 'research', 'technical-x-2026-08-25');
    fs.mkdirSync(researchDir, { recursive: true });
    fs.writeFileSync(path.join(researchDir, 'brief.md'), '# Research brief digest\n');

    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();
    expect(status.detectedArtifacts['bmad-product-brief']?.path).toContain('briefs');
  });

  it('tracks {slug} locations via their known prefix and lists truly unresolvable entries', async () => {
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      ides: ['amp'],
      modules: [
        {
          code: 'core',
          configYaml: 'output_folder: _bmad-output\n',
          helpRows: [
            { skill: 'bmad-spec', 'display-name': 'Spec', 'menu-code': 'SPC', phase: 'anytime', 'output-location': '{output_folder}/specs/spec-{slug}', outputs: 'SPEC.md + companion files' },
            { skill: 'bmad-review', 'display-name': 'Review', 'menu-code': 'RV', phase: 'anytime', outputs: 'findings JSON array + markdown report' },
            { skill: 'bmad-customize', 'display-name': 'Customize', 'menu-code': 'BC', phase: 'anytime', 'output-location': '{unknown_root}/overrides', outputs: 'TOML override files' },
          ],
        },
      ],
      skills: [
        { id: 'bmad-help', module: 'core' },
        { id: 'bmad-spec', module: 'core' },
        { id: 'bmad-review', module: 'core' },
        { id: 'bmad-customize', module: 'core' },
      ],
    });

    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();

    // {slug} degrades to the known prefix + stem token instead of vanishing
    expect(status.trackedEntries['bmad-spec']).toMatchObject({ baseDir: '_bmad-output/specs' });

    // Entries with partial or fully unresolvable artifact metadata are surfaced
    expect(status.untrackedWorkflows).toEqual([
      { id: 'bmad-review', name: 'Review', reason: 'no-output-location' },
      { id: 'bmad-customize', name: 'Customize', reason: 'unresolvable-location' },
    ]);

    // The spec artifact is found under the degraded base directory
    const specDir = path.join(dir, '_bmad-output', 'specs', 'spec-agent-one');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'SPEC.md'), '# SPEC\n');
    const after = await manager.getBmadStatus();
    expect(after.completedWorkflows).toContain('bmad-spec');
  });

  it('does not list pure helper skills (help, party mode) as untracked', async () => {
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      ides: ['amp'],
      modules: [
        {
          code: 'core',
          configYaml: 'output_folder: _bmad-output\n',
          helpRows: [{ skill: 'bmad-help', 'display-name': 'Help', 'menu-code': 'BH', phase: 'anytime' }],
        },
      ],
      skills: [{ id: 'bmad-help', module: 'core' }],
    });

    const manager = new BmadManager(dir, fakeContext);
    const status = await manager.getBmadStatus();
    expect(status.untrackedWorkflows ?? []).toEqual([]);
  });
});
