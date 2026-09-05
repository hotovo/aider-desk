/**
 * Progress summary computation for the BMAD Extension (v2).
 *
 * Pure functions that derive project/phase/epic progress from BmadStatus.
 * Phases are the ORIGINAL labels from the method's module-help.csv; only
 * entries with a derived artifact tracker are counted (trackedEntries).
 *
 * @module lib/progress
 */

import { groupCatalogBySkill, orderedPhases } from './install-registry';

import { StoryStatus } from './types';

import type { BmadStatus, ProgressSummary, PhaseProgress, EpicProgress } from './types';

/** Pretty labels for known original phases; unknown labels pass through capitalized. */
export const PHASE_NAMES: Record<string, string> = {
  plan: 'Plan',
  '2-planning': 'Planning',
  ship: 'Ship',
};

export const phaseDisplayName = (phase: string): string =>
  PHASE_NAMES[phase] ?? phase.charAt(0).toUpperCase() + phase.slice(1);

/**
 * Canonical display phases for progress surfaces. BMAD 6.11 splits the
 * planning work across two raw labels ('plan' holds brief/architecture/
 * epics/sprint-planning while '2-planning' holds PRD/UX), which read as a
 * confusing double bar in the dashboard. Both roll up into one 'Planning'
 * segment here; every other label passes through unchanged. The method MENU
 * keeps its original per-row phases — only progress steppers/bars merge.
 * Pure and exported for testing.
 */
export const canonicalPhase = (phase: string): string =>
  phase === 'plan' || phase === '2-planning' ? 'planning' : phase;

PHASE_NAMES.planning = 'Planning';

/**
 * Count story status occurrences from sprint data.
 */
function countStoryStatuses(
  storyStatuses: StoryStatus[],
): { backlog: number; readyForDev: number; inProgress: number; review: number; done: number } {
  const counts = { backlog: 0, readyForDev: 0, inProgress: 0, review: 0, done: 0 };
  for (const s of storyStatuses) {
    switch (s) {
      case StoryStatus.Backlog:
        counts.backlog++;
        break;
      case StoryStatus.ReadyForDev:
        counts.readyForDev++;
        break;
      case StoryStatus.InProgress:
        counts.inProgress++;
        break;
      case StoryStatus.Review:
        counts.review++;
        break;
      case StoryStatus.Done:
        counts.done++;
        break;
    }
  }
  return counts;
}

/**
 * Compute a full ProgressSummary from BMAD status data.
 *
 * Only tracked catalog entries (those with a derived artifact tracker) count
 * toward the bars; chat-only or unlocatable outputs stay neutral instead of
 * diluting percentages forever. Duplicate menu rows of one skill across
 * modules collapse into a single group — completion of any row completes
 * the skill, so shared workflows never count twice. Duplicate rows that also
 * exist as an 'anytime' helper count toward their lifecycle phase (the
 * representative prefers the non-anytime row, see groupCatalogBySkill).
 *
 * Overall percentage counts lifecycle groups only ('anytime' helpers such as
 * help/party mode are excluded — they are one-off utilities and would make
 * the number say less about real progress). They keep their own phase bar.
 */
export function computeProgressSummary(status: BmadStatus): ProgressSummary {
  // --- Epic / sprint progress (independent of catalog tracking) ---
  let epicProgress: EpicProgress | undefined;
  if (status.sprintStatus?.storyStatuses && status.sprintStatus.storyStatuses.length > 0) {
    const counts = countStoryStatuses(status.sprintStatus.storyStatuses);
    const epicTotal =
      counts.backlog + counts.readyForDev + counts.inProgress + counts.review + counts.done;
    epicProgress = {
      ...counts,
      total: epicTotal,
      percentage: epicTotal > 0 ? Math.round((counts.done / epicTotal) * 100) : 0,
    };
  }

  const trackedIds = new Set(Object.keys(status.trackedEntries || {}));
  const trackedCatalog = (status.catalog || []).filter((entry) => trackedIds.has(entry.id));

  if (trackedCatalog.length === 0) {
    return {
      overall: { completed: 0, inProgress: 0, total: 0, percentage: 0 },
      phases: [],
      epicProgress,
    };
  }

  // One skill = one progress unit, regardless of how many modules list it.
  const completedIds = new Set(status.completedWorkflows || []);
  const inProgressIds = new Set(status.inProgressWorkflows || []);
  const anyId = (group: { entries: Array<{ id: string }> }, ids: Set<string>): boolean =>
    group.entries.some((entry) => ids.has(entry.id));

  const groups = groupCatalogBySkill(trackedCatalog);
  const isAnytimeGroup = (group: { representative: { phase: string } }): boolean =>
    canonicalPhase(group.representative.phase) === 'anytime';
  const lifecycleGroups = groups.filter((group) => !isAnytimeGroup(group));
  const overallCompleted = lifecycleGroups.filter((group) => anyId(group, completedIds)).length;
  const overallInProgress = lifecycleGroups.filter((group) => anyId(group, inProgressIds)).length;
  const total = lifecycleGroups.length;

  // Raw labels roll up into canonical display phases while preserving the
  // method's order ('plan'+'2-planning' -> 'planning' before 'ship').
  const rawOrder = orderedPhases(groups.map((group) => group.representative));
  const phases: PhaseProgress[] = [];
  for (const key of [...new Set(rawOrder.map(canonicalPhase))]) {
    const inPhase = groups.filter((group) => canonicalPhase(group.representative.phase) === key);
    if (inPhase.length === 0) {
      continue;
    }
    const completed = inPhase.filter((group) => anyId(group, completedIds)).length;
    const inProgress = inPhase.filter((group) => anyId(group, inProgressIds)).length;

    phases.push({
      phase: key,
      phaseName: phaseDisplayName(key),
      completed,
      inProgress,
      total: inPhase.length,
      percentage: Math.round((completed / inPhase.length) * 100),
    });
  }

  return {
    overall: {
      completed: overallCompleted,
      inProgress: overallInProgress,
      total,
      percentage: Math.round((overallCompleted / total) * 100),
    },
    phases,
    epicProgress,
  };
}
