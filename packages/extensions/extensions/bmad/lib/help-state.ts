import { v4 as uuidv4 } from 'uuid';

import { StoryStatus } from './types';

import type { BmadStatus, SprintStatusData } from './types';
import type { ContextMessage } from '@aiderdesk/extensions';

/**
 * Deterministic project-state snapshot for bmad-help (v2).
 *
 * The installed bmad-help skill detects completed workflows by scanning
 * artifacts at runtime and fuzzy-matching free-text outputs words against
 * file names. That heuristic is unreliable: the wording often does not
 * repeat in file names, untracked rows cannot be scanned at all, and the
 * model may skip the scan entirely. When bmad-help is started through the
 * extension UI, the extension prepends this snapshot, computed from its own
 * artifact scan, so the skill orients from ground truth instead of guessing.
 *
 * Pure and exported for testing.
 */

/** Prompt-context id of the injected snapshot (distinct from workflow-start). */
export const HELP_STATE_CONTEXT_ID = 'bmad-help-state';

const UNTRACK_REASON_TEXT: Record<string, string> = {
  'no-output-location': 'no output location defined',
  'no-outputs': 'no artifact type defined',
  'unresolvable-location': 'output location uses unresolvable placeholders',
};

/** Story counts in a stable display order. */
const countStories = (sprintStatus?: SprintStatusData): Record<StoryStatus, number> => {
  const counts: Record<StoryStatus, number> = {
    [StoryStatus.Backlog]: 0,
    [StoryStatus.ReadyForDev]: 0,
    [StoryStatus.InProgress]: 0,
    [StoryStatus.Review]: 0,
    [StoryStatus.Done]: 0,
  };
  for (const storyStatus of sprintStatus?.storyStatuses ?? []) {
    counts[storyStatus] = (counts[storyStatus] ?? 0) + 1;
  }
  return counts;
};

const formatStamp = (date: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

/** Project-relative display path (POSIX separators). */
const displayPath = (projectDir: string, absolutePath: string): string => {
  const normalized = absolutePath.replace(/\\/g, '/');
  const root = projectDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized;
};

/**
 * Build the state-snapshot context message for a bmad-help invocation.
 *
 * @param status - Current BMAD status (artifact scan result)
 * @param suggestedIds - Workflow ids suggested as next steps (generateSuggestions)
 * @param now - Timestamp for the snapshot line (injected for deterministic tests)
 */
export const buildHelpStateMessage = (
  status: BmadStatus,
  suggestedIds: string[],
  now: Date = new Date(),
): ContextMessage => {
  const catalog = status.catalog || [];
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const trackedIds = new Set(Object.keys(status.trackedEntries || {}));

  const lines: string[] = [];
  lines.push(
    `[Project state snapshot - AiderDesk BMAD extension scan, ${formatStamp(now)}]`,
  );
  lines.push(
    'This is the extension\'s own artifact scan result. Use it as ground truth: verify the listed paths quickly, but do not re-derive completion from fuzzy filename matching. Explicit user statements always override this snapshot.',
  );
  lines.push('');

  // Catalog order (the method's own menu sequence) reads better than the
  // scan's insertion order; unknown ids sort last.
  const catalogIndex = (id: string): number =>
    catalog.findIndex((entry) => entry.id === id);
  const orderByCatalog = (ids: string[]): string[] =>
    [...ids].sort((a, b) => catalogIndex(a) - catalogIndex(b));

  const completed = orderByCatalog(status.completedWorkflows || []);
  const inProgress = orderByCatalog(status.inProgressWorkflows || []);
  const untracked = status.untrackedWorkflows || [];

  if (completed.length === 0 && inProgress.length === 0 && untracked.length === 0) {
    lines.push('No artifacts detected yet - the project has not started a tracked workflow.');
  } else {
    lines.push('Completed (artifact found):');
    if (completed.length === 0) {
      lines.push('- (none)');
    } else {
      for (const id of completed) {
        const entry = byId.get(id);
        const artifact = status.detectedArtifacts?.[id];
        const label = entry?.menuCode ? `[${entry.menuCode}] ` : '';
        const name = entry?.name ?? id;
        const path = artifact ? ` -> ${displayPath(status.projectDir, artifact.path)}` : '';
        lines.push(`- ${label}${name} (\`${id}\`)${path}`);
      }
    }

    lines.push('');
    lines.push('In progress (frontmatter status below):');
    if (inProgress.length === 0) {
      lines.push('- (none)');
    } else {
      for (const id of inProgress) {
        const entry = byId.get(id);
        const artifact = status.detectedArtifacts?.[id];
        const label = entry?.menuCode ? `[${entry.menuCode}] ` : '';
        const name = entry?.name ?? id;
        const statusNote = artifact?.status ? `, frontmatter status '${artifact.status}'` : '';
        const path = artifact ? ` -> ${displayPath(status.projectDir, artifact.path)}` : '';
        lines.push(`- ${label}${name} (\`${id}\`)${path}${statusNote}`);
      }
    }

    lines.push('');
    lines.push('Not scannable from artifacts (ask the user or infer from the conversation):');
    if (untracked.length === 0) {
      lines.push('- (none)');
    } else {
      for (const item of untracked) {
        const entry = byId.get(item.id);
        const label = entry?.menuCode ? `[${entry.menuCode}] ` : '';
        const reason = UNTRACK_REASON_TEXT[item.reason] ?? item.reason;
        // Rows that share their skill with a tracked row inherit that row's
        // artifact: e.g. Sprint Status [SS] and Sprint Planning [SP] both
        // resolve through sprint-status.yaml.
        const sharedWith = (status.catalog || [])
          .filter((other) => trackedIds.has(other.id) && other.skillId === entry?.skillId)
          .map((other) => `${other.menuCode ? `[${other.menuCode}] ` : ''}${other.name}`)
          .join(', ');
        const shareNote = sharedWith
          ? `; shares skill \`${entry?.skillId}\` with ${sharedWith} - treat as done when that artifact exists`
          : '';
        lines.push(`- ${label}${item.name} (\`${item.id}\`): ${reason}${shareNote}`);
      }
    }

    const stories = countStories(status.sprintStatus);
    const storyTotal = stories[StoryStatus.Backlog] + stories[StoryStatus.ReadyForDev]
      + stories[StoryStatus.InProgress] + stories[StoryStatus.Review] + stories[StoryStatus.Done];
    if (storyTotal > 0) {
      lines.push('');
      lines.push(
        `Sprint board: ${stories[StoryStatus.Done]} done, ${stories[StoryStatus.Review]} in review, ` +
        `${stories[StoryStatus.InProgress]} in progress, ${stories[StoryStatus.ReadyForDev]} ready for dev, ` +
        `${stories[StoryStatus.Backlog]} in backlog.`,
      );
    }

    if (suggestedIds.length > 0) {
      lines.push('');
      lines.push('Recommended next steps (extension suggestions - verify and recommend among these first):');
      for (const id of suggestedIds) {
        const entry = byId.get(id);
        if (!entry) {
          continue;
        }
        const label = entry.menuCode ? `[${entry.menuCode}] ` : '';
        const required = entry.required ? ' - required' : '';
        lines.push(`- ${label}${entry.name} (\`${id}\`)${required}`);
      }
    }
  }

  return {
    id: uuidv4(),
    role: 'user',
    content: lines.join('\n'),
    promptContext: {
      id: HELP_STATE_CONTEXT_ID,
      group: {
        id: HELP_STATE_CONTEXT_ID,
      },
    },
  };
};
