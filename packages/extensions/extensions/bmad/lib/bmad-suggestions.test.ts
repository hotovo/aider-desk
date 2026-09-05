import { describe, expect, it } from 'vitest';

import { generateSuggestions } from './bmad-suggestions';
import type { BmadStatus, CatalogEntry } from './types';

const entry = (id: string, phase = 'plan', overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  skillId: id,
  name: id,
  module: 'bmm',
  description: '',
  phase,
  required: false,
  precededBy: [],
  followedBy: [],
  skillPath: `.agents/skills/${id}/SKILL.md`,
  ...overrides,
});

const status = (overrides: Partial<BmadStatus>): BmadStatus => ({
  projectDir: '/p',
  installed: true,
  modules: [],
  catalog: [],
  trackedEntries: {},
  completedWorkflows: [],
  inProgressWorkflows: [],
  incompleteWorkflows: [],
  detectedArtifacts: {},
  sprintStatus: undefined,
  ...overrides,
});

describe('generateSuggestions', () => {
  it('suggests required entries of the earliest phase on a fresh project', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('bmad-help', 'anytime'),
          entry('brief', 'plan', { required: false }),
          entry('prd', 'plan', { required: true }),
          entry('arch', 'ship', { required: true }),
        ],
      }),
    );
    expect(suggestions).toEqual(['prd']);
  });

  it('returns nothing while the active workflow is unfinished', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [entry('prd'), entry('build', 'ship')],
        completedWorkflows: [],
        inProgressWorkflows: ['prd'],
      }),
      { bmadWorkflowId: 'prd' },
    );
    expect(suggestions).toEqual([]);
  });

  it('points at the implementation loop when backlog stories exist', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [entry('prd'), entry('bmad-build', 'ship')],
        completedWorkflows: ['prd'],
        sprintStatus: { storyStatuses: ['backlog'] as any },
      }),
    );
    expect(suggestions).toContain('bmad-build');
  });

  it('points at code review when stories are in review', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [entry('bmad-build', 'ship'), entry('bmad-code-review', 'ship')],
        completedWorkflows: ['bmad-build'],
        sprintStatus: { storyStatuses: ['review'] as any },
      }),
    );
    expect(suggestions).toContain('bmad-code-review');
  });

  it('follows the method chain (followed-by) of completed entries', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('brief', 'plan', { followedBy: ['prd'] }),
          entry('prd', '2-planning'),
        ],
        completedWorkflows: ['brief'],
      }),
    );
    expect(suggestions).toEqual(['prd']);
  });

  it('skips completed and in-progress entries in chain hints', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('brief', 'plan', { followedBy: ['prd', 'arch'] }),
          entry('prd'),
          entry('arch'),
        ],
        completedWorkflows: ['brief'],
        inProgressWorkflows: ['arch'],
      }),
    );
    expect(suggestions).toEqual(['prd']);
  });

  it('returns [] without a catalog', () => {
    expect(generateSuggestions(status({}))).toEqual([]);
  });

  it('unlocks entries with satisfied prerequisites even without followed-by (reverse chain)', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('arch', 'plan', { required: true }),
          entry('epics', 'plan', { required: true, precededBy: ['arch'] }),
          entry('sprint-planning', 'plan', { required: true }),
        ],
        completedWorkflows: ['arch'],
      }),
    );
    // 6.11 module-help.csv leaves followed-by empty; the reverse chain still
    // points at what may start next, in method order. sprint-planning has no
    // declared prerequisites and counts as schedulable alongside epics.
    expect(suggestions).toEqual(['epics', 'sprint-planning']);
  });

  it('recommends sprint planning as the next unlocked step on an agent-x-like state', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('brief', 'plan'),
          entry('prd', '2-planning', { required: true }),
          entry('ux', '2-planning', { precededBy: ['prd'] }),
          entry('arch', 'plan', { required: true }),
          entry('epics', 'plan', { required: true, precededBy: ['arch'] }),
          entry('sprint-planning', 'plan', { required: true }),
          entry('bmad-build', 'ship', { required: true, precededBy: ['sprint-planning'] }),
        ],
        completedWorkflows: ['brief', 'prd', 'ux', 'arch', 'epics'],
        inProgressWorkflows: [],
      }),
    );
    expect(suggestions).toEqual(['sprint-planning']);
  });

  it('does not unlock entries whose prerequisites are unmet', () => {
    const suggestions = generateSuggestions(
      status({
        catalog: [
          entry('helper', 'anytime'),
          entry('locked', 'ship', { precededBy: ['never-done'] }),
        ],
        completedWorkflows: [],
      }),
    );
    expect(suggestions).toEqual([]);
  });
});
