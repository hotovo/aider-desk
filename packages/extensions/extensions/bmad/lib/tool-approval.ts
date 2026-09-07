/**
 * Auto-approval policy for BMAD workflow runs (pure, fully tested).
 *
 * While a BMAD workflow drives the conversation the extension auto-approves
 * a narrow, side-effect-free slice of tool activity:
 *
 * - READS of the method's own content: the _bmad tree, generated outputs
 *   (_bmad-output) and the installed skills directories.
 * - WRITES restricted to generated output areas: _bmad-output and _bmad/render
 *   (build skills write rendered workflow files there).
 * - SINGLE, anchored shell commands that are provably read-only (git diff,
 *   reads under _bmad/ or _bmad-output/) or the sanctioned uv-render
 *   entrypoint used by build skills.
 *
 * Matching rules (hardened):
 * - Paths match by SEGMENT, never by substring: 'not_bmad/', any random
 *   '*\/skills/*' folder on disk and '_bmad-output-backup/' do not match.
 * - Paths containing '..' segments are never auto-approved (traversal).
 * - Shell approvals require exactly ONE plain command: no chaining
 *   (';', '&', '|'), no redirection ('<', '>'), no newlines, no backticks,
 *   no '$(...)' or '${...}' substitution.
 */

/** Split a path into normalized posix segments (accepts \\ and /). */
export const toPathSegments = (filePath: string): string[] =>
  filePath.replace(/\\/g, '/').split('/').filter((segment) => segment.length > 0);

const matchesAt = (segments: string[], needle: string[], start: number): boolean =>
  needle.every((segment, j) => segments[start + j] === segment);

/** True when `needle` appears in `segments` as a consecutive run. */
export const containsSegmentRun = (segments: string[], needle: string[]): boolean => {
  if (needle.length === 0 || needle.length > segments.length) {
    return false;
  }
  for (let i = 0; i + needle.length <= segments.length; i++) {
    if (matchesAt(segments, needle, i)) {
      return true;
    }
  }
  return false;
};

/** Skill directories probed when the installation manifest reveals none. */
export const FALLBACK_SKILL_READ_DIRS = ['.agents/skills', '.claude/skills'];

/**
 * Skill directories eligible for read auto-approval: the resolved project
 * skills directory plus the standard fallbacks.
 */
export const skillReadDirs = (resolvedSkillsDir?: string): string[] => {
  const dirs = resolvedSkillsDir ? [resolvedSkillsDir, ...FALLBACK_SKILL_READ_DIRS] : [...FALLBACK_SKILL_READ_DIRS];
  return [...new Set(dirs)];
};

/** Traversal via '..' segments opts a path out of every auto-approval. */
const hasTraversal = (segments: string[]): boolean => segments.includes('..');

/**
 * READ approval: BMAD trees (_bmad, _bmad-output) or paths inside one of the
 * configured skills directories.
 */
export const isAutoApprovedReadPath = (filePath: string, skillDirs: string[]): boolean => {
  const segments = toPathSegments(filePath);
  if (hasTraversal(segments)) {
    return false;
  }
  if (segments.includes('_bmad') || segments.includes('_bmad-output')) {
    return true;
  }
  return skillDirs.some((dir) => containsSegmentRun(segments, toPathSegments(dir)));
};

/**
 * WRITE approval: only generated output areas (_bmad-output, _bmad/render).
 * The rest of the _bmad tree stays manually approved.
 */
export const isAutoApprovedWritePath = (filePath: string): boolean => {
  const segments = toPathSegments(filePath);
  if (hasTraversal(segments)) {
    return false;
  }
  return segments.includes('_bmad-output') || containsSegmentRun(segments, ['_bmad', 'render']);
};

/**
 * Characters and constructs that turn a shell line into more than one plain
 * command or redirect its input/output: chaining, pipes, redirection,
 * newlines, command substitution, backticks.
 */
const SHELL_META = /[;&|<>`\r\n]|\$\(|\$\{/;

/** True when the command is exactly one plain shell command (no meta chars). */
export const isSinglePlainCommand = (command: string): boolean =>
  !SHELL_META.test(command.trim());

/** Read-only git diff (no chained anything — already excluded by the gate). */
const isReadOnlyGitDiff = (trimmed: string): boolean => /^git\s+diff\b/i.test(trimmed);

/** Reads that mention the BMAD content trees. */
const isBmadContentRead = (trimmed: string): boolean =>
  /^(cat|type|get-content|gc|select-string|sls|ls|dir|get-childitem|gci|test-path)\b/i.test(trimmed) &&
  /_bmad(-output)?[/\\]/i.test(trimmed);

/** BMAD 6.11+: build skills render via render.py / render_skill.py under uv. */
const isUvRenderScript = (trimmed: string): boolean =>
  /^uv\s+run\b/i.test(trimmed) && /\brender(?:_skill)?\.py\b/i.test(trimmed);

/**
 * BASH auto-approval: an allowlisted read-only command shape that survives
 * the single-plain-command gate.
 */
export const isAutoApprovedBashCommand = (command: string): boolean => {
  const trimmed = command.trim();
  if (!isSinglePlainCommand(trimmed)) {
    return false;
  }
  return isReadOnlyGitDiff(trimmed) || isBmadContentRead(trimmed) || isUvRenderScript(trimmed);
};

/**
 * True when the command invokes python WITHOUT the required `uv run` prefix.
 * Used to hard-block bare python invocations regardless of the allowlist.
 */
export const containsBarePythonInvocation = (command: string): boolean =>
  /(?<!uv\s+run\s+)\bpython(?:3)?(?:\.exe)?(?:\s|$)/i.test(command);
