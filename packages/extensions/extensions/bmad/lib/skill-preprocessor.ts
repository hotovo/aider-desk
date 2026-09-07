import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

import type { BmadConfig } from './types.js';

// ---------------------------------------------------------------------------
// BMAD config cache
// ---------------------------------------------------------------------------

// Cache invalidates on extension reload (AiderDesk hot-reload re-instantiates the module).
// No manual invalidation — config.user.yaml changes require a reload to take effect.
const configCache = new Map<string, BmadConfig>();

/**
 * Drop all cached BMAD configs. Called after install/update so changed
 * config.yaml values take effect without an extension reload.
 */
export function clearBmadConfigCache(): void {
  configCache.clear();
}

/**
 * Load BMAD configuration from _bmad/core/config.yaml (fallback),
 * _bmad/bmm/config.yaml, and _bmad/bmm/config.user.yaml (override).
 * Results are cached per project directory.
 *
 * Priority: core < base < user – user.config.yaml wins.
 */
export function loadBmadConfig(projectDir: string): BmadConfig {
  const cached = configCache.get(projectDir);
  if (cached) {
    return cached;
  }

  const result: BmadConfig = {};

  const readYamlSafe = (relPath: string): Record<string, unknown> | null => {
    const fullPath = path.join(projectDir, relPath);
    try {
      const content = readFileSync(fullPath, 'utf8');
      const parsed = yaml.parse(content);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return null;
    }
  };

  const core = readYamlSafe('_bmad/core/config.yaml');
  const base = readYamlSafe('_bmad/bmm/config.yaml');
  const user = readYamlSafe('_bmad/bmm/config.user.yaml');

  // Highest priority first: user overrides win, then bmm base, then core.
  const sources = [user, base, core];

  for (const src of sources) {
    if (src) {
      for (const key of Object.keys(src)) {
        // Only set if still undefined -- first match wins (user > base > core)
        if (result[key as keyof BmadConfig] === undefined) {
          (result as Record<string, unknown>)[key] = src[key];
        }
      }
    }
  }

  configCache.set(projectDir, result);
  return result;
}

// ---------------------------------------------------------------------------
// python3 → uv run normalisation
// ---------------------------------------------------------------------------

/**
 * Replace any ``python3`` command with ``uv run``, unless it is already
 * preceded by ``uv run `` (with any amount of whitespace between uv and run).
 *
 * Uses a variable-length negative lookbehind, which requires ES2018+.
 * This is guaranteed on Node.js ≥18 (AiderDesk platform requirement).
 *
 * Also catches ``python3`` followed by a backtick (markdown code-fragment).
 *
 * NOTE: Only ``python3`` is targeted. BMAD skills use ``python3`` explicitly.
 * Plain ``python`` (without ``3``) is out of scope.
 *
 * The function is exported so it can be reused in continuation-messages
 * and independently unit-tested.
 */
export function normalizePythonCommands(content: string): string {
  return content.replace(/(?<!uv\s+run\s+)python3(?=\s|$|`)/gi, 'uv run');
}

/**
 * Ensure a markdown fragment does not end inside an unclosed fenced-code
 * block. Appends a closing ``` if the fence count is odd.
 *
 * Used before injecting sliced SKILL.md content into a code-fence in
 * continuation messages to prevent broken markdown.
 */
export function balanceFences(fragment: string): string {
  const fenceRe = /^[ \t]*```/gm;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(fragment)) !== null) {
    count++;
  }
  if (count % 2 === 1) {
    return fragment + '\n```\n';
  }
  return fragment;
}

/**
 * Convenience helper: load and preprocess a SKILL.md in one call.
 * Returns null if the file cannot be read.
 */
export function getPreprocessedSkillContent(
  projectDir: string,
  skillsDir: string,
  skillName: string,
): string | null {
  try {
    const skillPath = path.join(projectDir, skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillPath)) return null;
    const raw = readFileSync(skillPath, 'utf8');
    const config = loadBmadConfig(projectDir);
    return preprocessSkillContent(raw, { projectDir, skillsDir, skillName, config });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SKILL.md placeholder pre‑processor
// ---------------------------------------------------------------------------

/**
 * Replace known BMAD placeholders inside a raw SKILL.md string.
 *
 * Resolved placeholders:
 *  {project-root}
 *  {skill-root}
 *  {skill-name}
 *  {user_name}
 *  {communication_language}
 *  {document_output_language}
 *  {user_skill_level}
 *  {output_folder}
 *  {planning_artifacts}
 *  {implementation_artifacts}
 *  {project_name}
 *  {date}
 *  {project_context}
 *
 * Also normalises ``python3 `` commands to ``uv run `` (unless already present).
 *
 * Dynamic placeholders (e.g. {sprint_status}, {story_path}, …) are **not**
 * replaced – the AI agent is responsible for resolving them at runtime.
 */
export function preprocessSkillContent(
  rawContent: string,
  context: {
    projectDir: string;
    skillsDir: string;
    skillName: string;
    config?: Partial<BmadConfig>;
  },
): string {
  const config = context.config ?? {};

  const replacements: Record<string, string> = {
    '{project-root}': context.projectDir.replace(/\\/g, '/'),
    '{skill-root}': `${context.skillsDir}/${context.skillName}`,
    '{skill-name}': context.skillName,
    '{user_name}': config.user_name ?? 'User',
    '{communication_language}': config.communication_language ?? 'English',
    '{document_output_language}': config.document_output_language ?? 'English',
    '{user_skill_level}': config.user_skill_level ?? 'intermediate',
    '{output_folder}': '_bmad-output',
    '{planning_artifacts}': config.planning_artifacts ?? '_bmad-output/planning-artifacts',
    '{implementation_artifacts}': config.implementation_artifacts ?? '_bmad-output/implementation-artifacts',
    '{project_name}': config.project_name ?? 'MyProject',
    '{date}': new Date().toISOString().slice(0, 10),
    '{project_context}': '**/project-context.md',
  };

  let result = rawContent;

  for (const [placeholder, value] of Object.entries(replacements)) {
    // Escape the placeholder so it can be used as a literal regex pattern.
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use a function replacement to avoid interpreting `$` inside the value.
    result = result.replace(new RegExp(escaped, 'g'), () => value);
  }

  // Normalise `python3` → `uv run` via the hardened normaliser.
  result = normalizePythonCommands(result);

  return result;
}
