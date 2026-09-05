import { orderedPhases } from './install-registry';

import { StoryStatus } from './types';

import type { BmadStatus, CatalogEntry, SprintStatusData } from './types';

/**
 * Workflow suggestions for the BMAD UI (v2).
 *
 * Derived from the method's own metadata: the followed-by chain of
 * module-help.csv, the required flags, and the sprint board. No hardcoded
 * workflow registry — unknown installations degrade to the chain hints of
 * whatever entries exist.
 */

/**
 * Suggest catalog entry ids for "what to do next".
 *
 * Rules (in priority order):
 * 1. Nothing done yet → up to 2 required entries of the earliest phase.
 * 2. Active workflow not completed yet → stay focused (no suggestions).
 * 3. Sprint-driven: backlog stories → the method's implementation-loop entry
 *    ('bmad-build'); stories in review → its ad-hoc code review entry when
 *     installed.
 * 4. Followed-by hints of completed entries (the method's own ordering),
 *    current task's chain first.
 * 5. Reverse-chain fallback: BMAD 6.11's module-help.csv only fills
 *    preceded-by (followed-by is empty on real installations), so rule 4
 *    alone yields nothing there. Suggests entries whose prerequisites are
 *    all completed plus required entries without prerequisites, ordered by
 *    the method's phase order.
 */
export const generateSuggestions = (
  status: BmadStatus,
  taskMetadata?: Record<string, unknown>,
): string[] => {
  const catalog = status.catalog || [];
  if (catalog.length === 0) {
    return [];
  }

  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const completed = new Set(status.completedWorkflows || []);
  const inProgress = new Set(status.inProgressWorkflows || []);
  const isDone = (id: string): boolean => completed.has(id) || inProgress.has(id);

  // 2. An unfinished active workflow owns the conversation — no suggestions.
  const currentId = taskMetadata?.bmadWorkflowId as string | undefined;
  const currentEntry = currentId ? byId.get(currentId) : undefined;
  if (currentEntry && !completed.has(currentEntry.id)) {
    return [];
  }

  const hints: string[] = [];
  const addHint = (id: string | undefined): void => {
    if (!id) {
      return;
    }
    const entry = byId.get(id);
    if (!entry || isDone(id) || hints.includes(id)) {
      return;
    }
    hints.push(id);
  };

  if (completed.size === 0 && inProgress.size === 0) {
    // 1. Fresh project: required entries of the earliest lifecycle phase.
    for (const phase of orderedPhases(catalog).slice(0, 1)) {
      catalog
        .filter((entry) => entry.phase === phase && entry.required)
        .slice(0, 2)
        .forEach((entry) => addHint(entry.id));
    }
    if (hints.length === 0) {
      byId.get('bmad-help') && addHint('bmad-help');
    }
  } else {
    // 3. Sprint-driven hints.
    const storyStatuses = status.sprintStatus?.storyStatuses;
    if (storyStatuses?.length) {
      if (storyStatuses.includes(StoryStatus.Backlog)) {
        addHintBySkill(catalog, 'bmad-build', addHint);
      }
      if (storyStatuses.includes(StoryStatus.Review)) {
        addHintBySkill(catalog, 'bmad-code-review', addHint);
      }
    }

    // 4. The method's own chain: followed-by of completed entries.
    for (const id of status.completedWorkflows || []) {
      byId.get(id)?.followedBy.forEach(addHint);
    }
    currentEntry?.followedBy.forEach(addHint);

    // 5. Reverse-chain fallback (see header docs): prerequisites met or
    // required without prerequisites, in the method's phase order.
    const orderOf = new Map(orderedPhases(catalog).map((phase, index) => [phase, index]));
    catalog
      .filter((entry) => {
        if (isDone(entry.id)) {
          return false;
        }
        if (entry.precededBy.length > 0) {
          return entry.precededBy.every((id) => completed.has(id));
        }
        return entry.required;
      })
      .sort(
        (a, b) =>
          (orderOf.get(a.phase) ?? Number.MAX_SAFE_INTEGER) -
            (orderOf.get(b.phase) ?? Number.MAX_SAFE_INTEGER) ||
          catalog.indexOf(a) - catalog.indexOf(b),
      )
      .forEach((entry) => addHint(entry.id));
  }

  return hints;
};

const addHintBySkill = (
  catalog: CatalogEntry[],
  skillId: string,
  addHint: (id: string | undefined) => void,
): void => {
  addHint(catalog.find((entry) => entry.skillId === skillId)?.id);
};

/**
 * Sprint story counts helper kept exported for tests/UI badges.
 */
export const countSprintStories = (sprintStatus?: SprintStatusData): number =>
  sprintStatus?.storyStatuses.length ?? 0;
