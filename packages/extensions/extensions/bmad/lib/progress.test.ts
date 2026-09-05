import { describe, expect, it } from 'vitest';

import { canonicalPhase, computeProgressSummary, phaseDisplayName } from './progress';
import type { BmadStatus, CatalogEntry } from './types';

/** Minimal tracker values standing in for derived artifact trackers. */
const TRACKED = { baseDir: 'x', tokens: ['x'] };
const TRACKED_Y = { baseDir: 'y', tokens: ['y'] };

const entry = (id: string, phase: string): CatalogEntry => ({
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

describe('phaseDisplayName', () => {
  it('maps known original phases and capitalizes unknown ones', () => {
    expect(phaseDisplayName('plan')).toBe('Plan');
    expect(phaseDisplayName('2-planning')).toBe('Planning');
    expect(phaseDisplayName('ship')).toBe('Ship');
    expect(phaseDisplayName('design')).toBe('Design');
  });
});

describe('canonicalPhase', () => {
  it('merges the two planning labels and passes everything else through', () => {
    expect(canonicalPhase('plan')).toBe('planning');
    expect(canonicalPhase('2-planning')).toBe('planning');
    expect(canonicalPhase('ship')).toBe('ship');
    expect(canonicalPhase('anytime')).toBe('anytime');
    expect(canonicalPhase('design')).toBe('design');
  });
});

describe('computeProgressSummary', () => {
  it('counts only tracked entries', () => {
    const summary = computeProgressSummary(
      status({
        catalog: [entry('e1', 'plan'), entry('e2', 'plan'), entry('chat-only', 'anytime')],
        trackedEntries: { e1: TRACKED, e2: TRACKED_Y },
        completedWorkflows: ['e1'],
      }),
    );
    expect(summary.overall).toEqual({ completed: 1, inProgress: 0, total: 2, percentage: 50 });
  });

  it('merges plan and 2-planning into one canonical Planning phase', () => {
    const summary = computeProgressSummary(
      status({
        catalog: [entry('a', 'anytime'), entry('b', 'ship'), entry('c', 'plan'), entry('d', '2-planning')],
        trackedEntries: { a: TRACKED, b: TRACKED, c: TRACKED, d: TRACKED },
      }),
    );
    expect(summary.phases.map((p) => p.phase)).toEqual(['planning', 'ship', 'anytime']);
    expect(summary.phases.map((p) => p.phaseName)).toEqual(['Planning', 'Ship', 'Anytime']);
    const planning = summary.phases.find((p) => p.phase === 'planning');
    expect(planning).toMatchObject({ completed: 0, inProgress: 0, total: 2, percentage: 0 });
  });

  it('excludes anytime groups from the overall percentage but keeps their bar', () => {
    const summary = computeProgressSummary(
      status({
        catalog: [entry('real', 'ship'), entry('helper1', 'anytime'), entry('helper2', 'anytime')],
        trackedEntries: { real: TRACKED, helper1: TRACKED, helper2: TRACKED },
        completedWorkflows: ['real', 'helper1'],
      }),
    );
    expect(summary.overall).toEqual({ completed: 1, inProgress: 0, total: 1, percentage: 100 });
    const anytime = summary.phases.find((p) => p.phase === 'anytime');
    expect(anytime).toMatchObject({ completed: 1, total: 2, percentage: 50 });
  });

  it('derives epic progress from sprint statuses', () => {
    const summary = computeProgressSummary(
      status({
        sprintStatus: {
          storyStatuses: ['done', 'done', 'backlog', 'review'] as any,
        },
      }),
    );
    expect(summary.epicProgress).toMatchObject({
      backlog: 1,
      readyForDev: 0,
      inProgress: 0,
      review: 1,
      done: 2,
      total: 4,
      percentage: 50,
    });
  });

  it('returns a safe zero state without tracked entries', () => {
    const summary = computeProgressSummary(status({}));
    expect(summary.overall.percentage).toBe(0);
    expect(summary.phases).toEqual([]);
    expect(summary.epicProgress).toBeUndefined();
  });

  it('counts in-progress work separately', () => {
    const summary = computeProgressSummary(
      status({
        catalog: [entry('e1', 'plan')],
        trackedEntries: { e1: TRACKED },
        inProgressWorkflows: ['e1'],
      }),
    );
    expect(summary.overall.inProgress).toBe(1);
    expect(summary.phases[0].inProgress).toBe(1);
  });

  it('counts a skill duplicated across modules once (no double progress)', () => {
    const dup = { ...entry('bmad-brainstorming#bsp', 'plan'), skillId: 'bmad-brainstorming' };
    const primary = { ...entry('bmad-brainstorming#bp', 'plan'), skillId: 'bmad-brainstorming' };
    const summary = computeProgressSummary(
      status({
        catalog: [primary, dup],
        trackedEntries: {
          'bmad-brainstorming#bp': TRACKED,
          'bmad-brainstorming#bsp': TRACKED,
        },
        completedWorkflows: ['bmad-brainstorming#bsp'],
      }),
    );
    expect(summary.overall).toEqual({ completed: 1, inProgress: 0, total: 1, percentage: 100 });
  });

  it('attributes a skill duplicated across phases to its lifecycle phase', () => {
    const anytimeRow = { ...entry('bmad-brainstorming#bsp', 'anytime'), skillId: 'bmad-brainstorming' };
    const planRow = { ...entry('bmad-brainstorming#bp', 'plan'), skillId: 'bmad-brainstorming' };
    const summary = computeProgressSummary(
      status({
        catalog: [anytimeRow, planRow],
        trackedEntries: {
          'bmad-brainstorming#bp': TRACKED,
          'bmad-brainstorming#bsp': TRACKED,
        },
        completedWorkflows: ['bmad-brainstorming#bp'],
      }),
    );
    // The lifecycle row (plan) is the representative: the finished skill
    // counts toward Planning, not toward the anytime helpers bucket.
    expect(summary.overall).toEqual({ completed: 1, inProgress: 0, total: 1, percentage: 100 });
    expect(summary.phases.map((p) => p.phase)).toEqual(['planning']);
    expect(summary.phases[0]).toMatchObject({ completed: 1, total: 1, percentage: 100 });
  });
});
