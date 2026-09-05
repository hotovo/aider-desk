import { describe, expect, it } from 'vitest';

import { buildProjectOverview, computePhaseStepper } from './ui-overview';
import type { BmadStatus, CatalogEntry, ProgressSummary } from './types';

/** Minimal tracker value standing in for a derived artifact tracker. */
const TRACKED = { baseDir: 'x', tokens: ['x'] };

const entry = (id: string, phase: string, overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id,
  skillId: id,
  name: id,
  module: 'bmm',
  description: `desc-${id}`,
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

const emptySummary: ProgressSummary = {
  overall: { completed: 0, inProgress: 0, total: 0, percentage: 0 },
  phases: [],
};

describe('computePhaseStepper', () => {
  it('marks the first unfinished tracked phase as current', () => {
    const steps = computePhaseStepper(
      status({
        catalog: [entry('a', 'plan'), entry('b', 'ship')],
        trackedEntries: { a: TRACKED, b: TRACKED },
      }),
      emptySummary,
    );
    expect(steps.map((s) => s.phase)).toEqual(['planning', 'ship']);
    expect(steps[0]).toMatchObject({ status: 'current', completed: 0, total: 1 });
    expect(steps[1].status).toBe('upcoming');
  });

  it('marks a fully completed phase as done and the next as current', () => {
    const steps = computePhaseStepper(
      status({
        catalog: [entry('a', 'plan'), entry('b', 'ship')],
        trackedEntries: { a: TRACKED, b: TRACKED },
        completedWorkflows: ['a'],
      }),
      emptySummary,
    );
    expect(steps[0].status).toBe('done');
    expect(steps[1].status).toBe('current');
  });

  it('ignores untracked entries', () => {
    const steps = computePhaseStepper(
      status({
        catalog: [entry('a', 'plan'), entry('chat', 'anytime')],
        trackedEntries: { a: TRACKED },
      }),
      emptySummary,
    );
    expect(steps).toHaveLength(1);
    expect(steps[0].phase).toBe('planning');
  });

  it('returns [] without tracked entries', () => {
    expect(computePhaseStepper(status({}), emptySummary)).toEqual([]);
  });

  it('merges planning phases and counts a duplicated skill once', () => {
    const steps = computePhaseStepper(
      status({
        catalog: [
          entry('bmad-brainstorming#bp', 'plan', { skillId: 'bmad-brainstorming' }),
          entry('bmad-brainstorming#bsp', 'anytime', { skillId: 'bmad-brainstorming' }),
          entry('prd', '2-planning'),
        ],
        trackedEntries: {
          'bmad-brainstorming#bp': TRACKED,
          'bmad-brainstorming#bsp': TRACKED,
          prd: TRACKED,
        },
        completedWorkflows: ['bmad-brainstorming#bsp'],
      }),
      emptySummary,
    );
    // One unit per skill, not per menu row; plan + 2-planning roll up into a
    // single Planning step ("you are here" after the done brainstorming).
    expect(steps.map((s) => s.phase)).toEqual(['planning']);
    expect(steps[0]).toMatchObject({ status: 'current', completed: 1, total: 2 });
  });
});

describe('buildProjectOverview', () => {
  it('builds next steps from suggestions with prereq state', () => {
    const overview = buildProjectOverview(
      status({
        catalog: [
          entry('arch', 'ship', { precededBy: ['prd'] }),
          entry('ux', 'plan'),
        ],
      }),
      ['arch', 'ux'],
      emptySummary,
    );
    expect(overview.nextSteps).toHaveLength(2);
    expect(overview.nextSteps[0]).toMatchObject({
      workflowId: 'arch',
      reason: 'recommended',
      prereqMet: false,
    });
    expect(overview.nextSteps[1].prereqMet).toBe(true);
  });

  it('fills remaining slots with the active workflow follow-ups', () => {
    const overview = buildProjectOverview(
      status({
        catalog: [entry('brief', 'plan'), entry('prd', '2-planning', { followedBy: [] })],
      }),
      [],
      emptySummary,
      'brief',
    );
    // brief has no followedBy; nothing to add — hasActiveWorkflow still true
    expect(overview.hasActiveWorkflow).toBe(true);
    expect(overview.activeWorkflowName).toBe('brief');
    expect(overview.nextSteps).toEqual([]);
  });

  it('collects optional follow-ups of completed workflows', () => {
    const overview = buildProjectOverview(
      status({
        catalog: [entry('brief', 'plan', { followedBy: ['prd'] }), entry('prd', '2-planning')],
        completedWorkflows: ['brief'],
      }),
      [],
      emptySummary,
    );
    expect(overview.optionalFollowUps).toHaveLength(1);
    expect(overview.optionalFollowUps[0]).toMatchObject({ workflowId: 'prd', reason: 'optional' });
  });
});

