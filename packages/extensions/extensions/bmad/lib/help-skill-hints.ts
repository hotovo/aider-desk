import * as fs from 'fs';
import * as path from 'path';

import {
  deriveArtifactTracker,
  listCatalog,
  readModuleConfigs,
} from './install-registry';
import { resolveSkillsDir } from './skills';

import type { CatalogEntry } from './install-registry';

// ---------------------------------------------------------------------------
// bmad-help state hints
//
// The installed bmad-help skill detects completed workflows by scanning the
// resolved output locations and fuzzy-matching the free-text words of the
// catalog's `outputs` column against file names at runtime. That heuristic
// breaks on installations whose artifact names do not repeat the wording
// (the extreme case: outputs "epics and stories" vs. a plain epics.md).
//
// After every install/update (and once per session for pre-existing
// installations) this module appends a deterministic rules block to the
// installed bmad-help/SKILL.md: per-catalog-row scan roots plus the exact
// token semantics used by the extension's own progress tracking, and
// sprint-status.yaml as the authority for implementation progress.
// ---------------------------------------------------------------------------

/** HTML comment markers enclosing the injected block; enable idempotent replacement. */
export const STATE_HINTS_START = '<!-- aiderdesk-bmad-state-hints:start -->';
export const STATE_HINTS_END = '<!-- aiderdesk-bmad-state-hints:end -->';

const HELP_SKILL_DIR_NAME = 'bmad-help';

/** Outcome of an injection attempt into the installed bmad-help skill. */
export type HelpHintsInjectionResult = 'updated' | 'unchanged' | 'skipped';

const escapeRegExp = (value: string): string =>
  value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

const stateHintsBlockRegex = (): RegExp =>
  new RegExp(`${escapeRegExp(STATE_HINTS_START)}[\\s\\S]*?${escapeRegExp(STATE_HINTS_END)}\\n?`, 'g');

/** Whether the given SKILL.md content already carries the hints block. */
export const hasStateHints = (skillContent: string): boolean => {
  stateHintsBlockRegex().lastIndex = 0;
  return stateHintsBlockRegex().test(skillContent);
};

/**
 * Strip any previously injected hints block from SKILL.md content.
 */
export const stripStateHints = (skillContent: string): string =>
  skillContent.replace(stateHintsBlockRegex(), '');

interface HintRow {
  menuCode?: string;
  skillId: string;
  baseDir: string;
  /** Raw words of the outputs column, stopword-cleaned and deterministic. */
  words: string[];
}

/** Display form of an entry's outputs column: raw but noise-free. */
const displayWords = (outputs: string[]): string[] => {
  const words: string[] = [];
  for (const output of outputs ?? []) {
    for (const word of output.split(/[^A-Za-z0-9]+/)) {
      const clean = word.toLowerCase();
      if (clean.length >= 3 && !['and', 'or', 'the', 'optional'].includes(clean)) {
        words.push(clean);
      }
    }
  }
  return [...new Set(words)];
};

/**
 * One compact line per tracked catalog row: where to scan and which outputs
 * words identify artifacts. Deduplicated across modules sharing identical
 * tracking (same skillId + baseDir + words). Untracked rows are omitted;
 * they have no scannable artifacts by definition.
 */
export const collectHintRows = (
  entries: CatalogEntry[],
  configs: Record<string, string>,
): HintRow[] => {
  const rows: HintRow[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const tracker = deriveArtifactTracker(entry, configs);
    if (!tracker.ok || tracker.tokens.length === 0) {
      continue;
    }

    const words = [...displayWords(entry.outputs ?? [])].sort();
    const signature = `${entry.skillId}|${tracker.baseDir}|${words.join(',')}`;
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);

    rows.push({
      menuCode: entry.menuCode,
      skillId: entry.skillId,
      baseDir: tracker.baseDir,
      words,
    });
  }

  return rows;
};

/** Relative path of the implementation sprint board for this installation,
 * derived from the catalog row carrying the "sprint" word; undefined when
 * no such row exists (installation without implementation lifecycle). */
const resolveSprintStatusPath = (rows: HintRow[]): string | undefined => {
  const sprintRow = rows.find((row) => row.words.includes('sprint'));
  return sprintRow ? `${sprintRow.baseDir}/sprint-status.yaml` : undefined;
};

/**
 * Build the state-detection markdown block (markers included). Empty when
 * the installation has no trackable catalog rows - nothing worth injecting.
 *
 * Reads the same metadata as the UI progress engine (module-help.csv plus
 * module configs), so both surfaces agree on what counts as done.
 */
export const buildStateHints = (projectDir: string): string => {
  const entries = listCatalog(projectDir);
  if (entries.length === 0) {
    return '';
  }

  const configs = readModuleConfigs(projectDir);
  const rows = collectHintRows(entries, configs);
  if (rows.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push(STATE_HINTS_START);
  lines.push('');
  lines.push('## State detection hints');
  lines.push('');
  lines.push(
    'Completion detection guidance added by the AiderDesk BMAD extension. It mirrors the extension\'s own progress tracking; apply these rules when scanning artifacts:',
  );
  lines.push('');
  lines.push(
    '1. Filenames AND folder names count, case-insensitively; plural and gerund stems fold ("stories" matches "story", "brainstorming" matches "brainstorm"). A single word match marks the row\'s artifacts as present.',
  );
  lines.push('2. Per-row scan roots and expected artifact words (from the outputs column):');
  for (const row of rows) {
    const label = row.menuCode ? `[${row.menuCode}] ` : '';
    lines.push(
      `   - ${label}\`${row.skillId}\`: scan \`${row.baseDir}\` recursively; expected words: ${row.words.join(', ')}`,
    );
  }
  lines.push('');
  const sprintPath = resolveSprintStatusPath(rows);
  if (sprintPath) {
    lines.push(
      `3. Implementation progress authority: \`${sprintPath}\` (key \`development_status\`; statuses backlog, ready-for-dev, in-progress, review, done). When present it outranks file presence: an epic marked in-progress with backlog stories means the user is mid-build. Never recommend a required planning row again merely because its artifact wording differs from the outputs column (for example, outputs "epics and stories" also matches a plain \`epics.md\`).`,
    );
  } else {
    lines.push(
      '3. Never recommend a required row again merely because its artifact wording differs from the outputs column.',
    );
  }
  // Untracked rows that share their skill with a tracked row inherit that
  // row's artifact: e.g. Sprint Status [SS] and Sprint Planning [SP] both
  // resolve through sprint-status.yaml.
  const trackedSkillIds = new Set(rows.map((row) => row.skillId));
  const sharedRows = entries.filter((entry) => {
    const tracker = deriveArtifactTracker(entry, configs);
    if (tracker.ok && tracker.tokens.length > 0) {
      return false;
    }
    return trackedSkillIds.has(entry.skillId);
  });

  lines.push(
    '4. Rows without a scan root produce no files; determine their state from user statements or the conversation instead.',
  );
  if (sharedRows.length > 0) {
    const sharedText = sharedRows
      .map((row) => `[${row.menuCode}] \`${row.skillId}\``)
      .join(', ');
    lines.push(
      `   Exception: ${sharedText} share their skill with a tracked row - treat them as done whenever that tracked row's artifact exists.`,
    );
  }
  lines.push(
    '5. This block was generated at install time; if the user states they moved or renamed output folders, trust them over this list.',
  );
  lines.push(STATE_HINTS_END);

  return lines.join('\n');
};

/**
 * Compose final SKILL.md content: remove any previous block, append fresh
 * one at the end. Pure - exported for testing.
 */
export const applyStateHintsToSkill = (skillContent: string, hintsBlock: string): string => {
  if (!hintsBlock) {
    return skillContent;
  }
  const base = stripStateHints(skillContent).replace(/\s+$/, '');
  return `${base}\n\n${hintsBlock}\n`;
};

/**
 * Locate the installed bmad-help skill and make sure its SKILL.md carries
 * the current state-detection block. Idempotent: identical content results
 * in 'unchanged' (and no disk write). Best-effort - callers must tolerate
 * failures.
 */
export const injectHelpSkillStateHints = (projectDir: string): HelpHintsInjectionResult => {
  const skillsDir = resolveSkillsDir(projectDir);
  if (!skillsDir) {
    return 'skipped';
  }

  const skillPath = path.join(projectDir, skillsDir, HELP_SKILL_DIR_NAME, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return 'skipped';
  }

  const hintsBlock = buildStateHints(projectDir);
  if (!hintsBlock) {
    return 'unchanged';
  }

  const original = fs.readFileSync(skillPath, 'utf-8');
  const updated = applyStateHintsToSkill(original, hintsBlock);

  if (updated === original) {
    return 'unchanged';
  }

  fs.writeFileSync(skillPath, updated, 'utf-8');
  return 'updated';
};
