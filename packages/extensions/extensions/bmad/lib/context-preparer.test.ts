import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import type { ExtensionContext } from '@aiderdesk/extensions';

import { ContextPreparer } from './context-preparer';
import { createBmadInstallFixture } from './install-fixture';
import { listCatalog } from './install-registry';

const fakeContext = { log: (m: string, lvl?: string) => { if (lvl === 'error' || lvl === 'warn') { console.log(`[${lvl}] ${m}`); } } } as unknown as ExtensionContext;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-preparer-'));
const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    fs.rmSync(dirs.pop()!, { recursive: true, force: true });
  }
});

const makeProject = (): string => {
  const dir = path.join(tmpRoot, `proj-${Math.random().toString(36).slice(2, 10)}`);
  dirs.push(dir);
  return createBmadInstallFixture(dir, {
    version: '6.11.0',
    modules: [
      {
        code: 'core',
        configYaml: 'output_folder: _bmad-output\n',
        helpRows: [{ skill: 'bmad-help', 'display-name': 'Help', 'menu-code': 'BH', phase: 'anytime' }],
      },
      {
        code: 'bmm',
        configYaml: 'planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"\noutput_folder: _bmad-output\n',
        helpRows: [
          { skill: 'bmad-prd', 'display-name': 'Create PRD', 'menu-code': 'PRD', phase: '2-planning' },
          // menu variant with an action hint (like Sprint Status SS)
          { skill: 'bmad-sprint-planning', 'display-name': 'Sprint Status', 'menu-code': 'SS', action: 'status', phase: 'anytime' },
        ],
      },
    ],
    skills: [
      { id: 'bmad-help', module: 'core', content: '# HELP SKILL' },
      { id: 'bmad-prd', module: 'bmm', content: '# PRD SKILL CONTENT' },
      { id: 'bmad-sprint-planning', module: 'bmm', content: '# SPRINT SKILL' },
      { id: 'bmad-agent-dev', module: 'bmm', content: '# AGENT DEV SKILL' },
      { id: 'cis-strategy', module: 'cis', content: '# CIS STRATEGY SKILL' },
    ],
  });
};

describe('ContextPreparer.prepareEntry', () => {
  it('injects the ORIGINAL SKILL.md via the single generic template', async () => {
    const dir = makeProject();
    const entry = listCatalog(dir).find((e) => e.skillId === 'bmad-prd')!;
    const preparer = new ContextPreparer(dir, fakeContext);

    const prepared = await preparer.prepareEntry(entry);

    expect(prepared.execute).toBe(true);
    expect(prepared.taskName).toBe('Create PRD');
    expect(prepared.contextMessages.length).toBeGreaterThan(0);

    const first = prepared.contextMessages[0];
    expect(first.role).toBe('user');
    expect(String(first.content)).toContain('.agents/skills/bmad-prd/SKILL.md');

    // The tool-result message carries the full original skill content
    const toolMessage = prepared.contextMessages.find(
      (m) => Array.isArray(m.content) && m.content.some((part: any) => part?.type === 'tool-result'),
    );
    expect(JSON.stringify(toolMessage?.content)).toContain('PRD SKILL CONTENT');

    // The module config is loaded as context
    const contents = JSON.stringify(prepared.contextMessages.map((m) => m.content));
    expect(contents).toContain('planning_artifacts');
  });

  it('passes the action intent for menu variants of one skill', async () => {
    const dir = makeProject();
    const statusEntry = listCatalog(dir).find((e) => e.action === 'status')!;
    const preparer = new ContextPreparer(dir, fakeContext);

    const prepared = await preparer.prepareEntry(statusEntry);
    const first = String(prepared.contextMessages[0].content);
    expect(first).toContain('action: status');
    expect(first).toContain('Sprint Status');
  });

  it('omits the action sentence for plain entries', async () => {
    const dir = makeProject();
    const entry = listCatalog(dir).find((e) => e.skillId === 'bmad-prd')!;
    const preparer = new ContextPreparer(dir, fakeContext);

    const prepared = await preparer.prepareEntry(entry);
    expect(String(prepared.contextMessages[0].content)).not.toContain('action:');
  });
});

describe('ContextPreparer.prepareSkill', () => {
  it('works for internal skills without a menu row', async () => {
    const dir = makeProject();
    const preparer = new ContextPreparer(dir, fakeContext);

    const prepared = await preparer.prepareSkill({
      id: 'bmad-agent-dev',
      name: 'bmad-agent-dev',
      description: '',
      module: 'bmm',
      skillPath: '.agents/skills/bmad-agent-dev/SKILL.md',
    });

    expect(prepared.contextMessages.length).toBeGreaterThan(0);
    // Module has a config.yaml -> used directly
    expect(JSON.stringify(prepared.contextMessages)).toContain('_bmad/bmm/config.yaml');
  });

  it('falls back to the core module when the skill module has no config.yaml', async () => {
    const dir = makeProject();
    const preparer = new ContextPreparer(dir, fakeContext);

    const prepared = await preparer.prepareSkill({
      id: 'cis-strategy',
      name: 'cis-strategy',
      description: '',
      module: 'cis',
      skillPath: '.agents/skills/cis-strategy/SKILL.md',
    });

    expect(JSON.stringify(prepared.contextMessages)).toContain('_bmad/core/config.yaml');
  });
});
