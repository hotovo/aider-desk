/**
 * Project-overview helpers for the BMAD UI (v2).
 *
 * Pure functions that derive guidance from BmadStatus: a phase stepper over
 * the method's own phases, next recommended steps, and optional follow-ups.
 * No side effects — fully testable.
 *
 * @module lib/ui-overview
 */

import { groupCatalogBySkill, orderedPhases } from './install-registry';
import { canonicalPhase, phaseDisplayName } from './progress';

import type { BmadStatus, ProgressSummary } from './types';

/** Status of a phase in the visual stepper. */
export type PhaseStepStatus = 'done' | 'current' | 'upcoming';

/** One step of the visual phase stepper. */
export interface PhaseStep {
  phase: string;
  phaseName: string;
  status: PhaseStepStatus;
  completed: number;
  inProgress: number;
  total: number;
}

/** Why a workflow is offered as a next step. */
export type NextStepReason = 'recommended' | 'follow-up' | 'optional';

/** A workflow offered as next step / follow-up in the UI. */
export interface NextStep {
  workflowId: string;
  name: string;
  description: string;
  reason: NextStepReason;
  /** Whether all preceded-by entries of the method's chain are completed. */
  prereqMet: boolean;
  inProgress: boolean;
  completed: boolean;
}

/** Derived guidance for the welcome page / task actions. */
export interface ProjectOverview {
  /** Up to 3 recommended next steps (suggested first, then current-workflow follow-ups). */
  nextSteps: NextStep[];
  /** Follow-ups of completed workflows that are not in nextSteps (optional work). */
  optionalFollowUps: NextStep[];
  /** Whether the active task carries a BMAD workflow (task metadata). */
  hasActiveWorkflow: boolean;
  /** Name of the active workflow, when one is set. */
  activeWorkflowName?: string;
}

/**
 * Visual phase stepper over the method's original phases (tracked entries
 * only): the first unfinished phase is marked 'current' ("you are here").
 *
 * @param status - Current BMAD status
 * @param progressSummary - Precomputed progress (kept for API symmetry)
 * @returns Phase steps in lifecycle order (never throws, empty when untracked)
 */
export function computePhaseStepper(
  status: BmadStatus,
  progressSummary: ProgressSummary,
): PhaseStep[] {
  void progressSummary;

  const trackedIds = new Set(Object.keys(status.trackedEntries || {}));
  const trackedCatalog = (status.catalog || []).filter((entry) => trackedIds.has(entry.id));
  if (trackedCatalog.length === 0) {
    return [];
  }

  const completedSet = new Set(status.completedWorkflows || []);
  const inProgressSet = new Set(status.inProgressWorkflows || []);

  // One skill = one step unit; duplicate rows of a skill across modules
  // count once and are done when ANY row's artifact completed.
  const groups = groupCatalogBySkill(trackedCatalog);
  const isDone = (group: { entries: Array<{ id: string }> }): boolean =>
    group.entries.some((entry) => completedSet.has(entry.id));
  const isActive = (group: { entries: Array<{ id: string }> }): boolean =>
    group.entries.some((entry) => inProgressSet.has(entry.id));

  const steps: PhaseStep[] = [];
  let currentFound = false;

  // Same canonical rollup as the dashboard bars: 'plan'+'2-planning' merge
  // into one 'Planning' step, other labels pass through.
  for (const key of [
    ...new Set(orderedPhases(groups.map((group) => group.representative)).map(canonicalPhase)),
  ]) {
    const workflows = groups.filter((group) => canonicalPhase(group.representative.phase) === key);
    if (workflows.length === 0) {
      continue;
    }

    const total = workflows.length;
    const completed = workflows.filter(isDone).length;
    const inProgress = workflows.filter((group) => !isDone(group) && isActive(group)).length;

    let stepStatus: PhaseStepStatus;
    if (completed === total) {
      stepStatus = 'done';
    } else if (!currentFound) {
      stepStatus = 'current';
      currentFound = true;
    } else {
      stepStatus = 'upcoming';
    }

    steps.push({
      phase: key,
      phaseName: phaseDisplayName(key),
      status: stepStatus,
      completed,
      inProgress,
      total,
    });
  }

  return steps;
}

/**
 * Prerequisite check against the method's own chain: an entry's prereqs are
 * met when every preceded-by id is completed (entries without precedents are
 * always free to start).
 */
const prereqMet = (entry: { precededBy: string[] }, completedSet: Set<string>): boolean =>
  entry.precededBy.every((id) => completedSet.has(id));

const toNextStep = (
  entry: BmadStatus['catalog'][number],
  reason: NextStepReason,
  status: BmadStatus,
): NextStep => ({
  workflowId: entry.id,
  name: entry.name,
  description: entry.description || '',
  reason,
  prereqMet: prereqMet(entry, new Set(status.completedWorkflows || [])),
  inProgress: (status.inProgressWorkflows || []).includes(entry.id),
  completed: (status.completedWorkflows || []).includes(entry.id),
});

/**
 * Derive the next recommended steps and optional follow-ups for the UI.
 *
 * Sources, in priority order:
 * 1. `suggestedWorkflows` (priority-sorted by generateSuggestions), filtered
 *    to entries neither completed nor in progress — up to 3.
 * 2. If fewer than 3, followed-by hints of the active workflow — 'follow-up'.
 *
 * `optionalFollowUps` collects followed-by hints of completed entries not
 * already offered as next steps.
 */
export function buildProjectOverview(
  status: BmadStatus,
  suggestedWorkflows: string[],
  progressSummary: ProgressSummary,
  currentWorkflowId?: string,
): ProjectOverview {
  void progressSummary;

  const byId = new Map((status.catalog || []).map((entry) => [entry.id, entry]));
  const completedSet = new Set(status.completedWorkflows || []);
  const inProgressSet = new Set(status.inProgressWorkflows || []);
  // A skill is done/active when ANY of its duplicate menu rows is — offering
  // the other row as a next step would suggest already-finished work.
  const skillDone = (skillId: string): boolean =>
    (status.catalog || []).some(
      (entry) => entry.skillId === skillId && (completedSet.has(entry.id) || inProgressSet.has(entry.id)),
    );

  const nextSteps: NextStep[] = [];
  const seen = new Set<string>();
  const seenSkills = new Set<string>();

  // 1. Suggested workflows (recommended), up to 3.
  for (const id of suggestedWorkflows || []) {
    const workflow = byId.get(id);
    if (!workflow || skillDone(workflow.skillId) || seen.has(id) || seenSkills.has(workflow.skillId)) {
      continue;
    }
    seen.add(id);
    seenSkills.add(workflow.skillId);
    nextSteps.push(toNextStep(workflow, 'recommended', status));
    if (nextSteps.length >= 3) {
      break;
    }
  }

  // 2. Follow-ups of the active workflow fill remaining slots.
  if (nextSteps.length < 3 && currentWorkflowId) {
    const current = byId.get(currentWorkflowId);
    for (const id of current?.followedBy ?? []) {
      const workflow = byId.get(id);
      if (!workflow || skillDone(workflow.skillId) || seen.has(id) || seenSkills.has(workflow.skillId)) {
        continue;
      }
      seen.add(id);
      seenSkills.add(workflow.skillId);
      nextSteps.push(toNextStep(workflow, 'follow-up', status));
      if (nextSteps.length >= 3) {
        break;
      }
    }
  }

  // 3. Optional follow-ups of completed workflows.
  const optionalFollowUps: NextStep[] = [];
  for (const completedId of status.completedWorkflows || []) {
    const completedWorkflow = byId.get(completedId);
    for (const id of completedWorkflow?.followedBy ?? []) {
      const workflow = byId.get(id);
      if (!workflow || skillDone(workflow.skillId) || seen.has(id) || seenSkills.has(workflow.skillId)) {
        continue;
      }
      seen.add(id);
      seenSkills.add(workflow.skillId);
      optionalFollowUps.push(toNextStep(workflow, 'optional', status));
    }
  }

  const activeWorkflow = currentWorkflowId ? byId.get(currentWorkflowId) : undefined;

  return {
    nextSteps,
    optionalFollowUps,
    hasActiveWorkflow: Boolean(activeWorkflow),
    activeWorkflowName: activeWorkflow?.name,
  };
}
