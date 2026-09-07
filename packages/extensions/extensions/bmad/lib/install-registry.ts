import * as fs from 'fs';
import * as path from 'path';

import { parse as parseYaml } from 'yaml';

import { parseCsvObjects } from './csv';
import { parseSkillManifest, resolveSkillsDir } from './skills';

import type { SkillManifestRow } from './skills';

/**
 * Discovery core for the BMAD extension (v2).
 *
 * Everything the UI offers is derived from the standard `npx bmad-method
 * install` output in the project root — the extension keeps no workflow
 * registry of its own. Sources (bmad-method 6.10+):
 *
 *   _bmad/_config/manifest.yaml        installation manifest: version,
 *                                      installed modules, configured tools
 *   _bmad/_config/skill-manifest.csv   every installed skill with module
 *                                      and canonical id
 *   _bmad/<module>/module-help.csv     the method's own menu: display name,
 *                                      menu code, phase, ordering
 *                                      (preceded-by/followed-by), artifact
 *                                      locations
 *
 * The catalog lists exactly the entries of module-help.csv whose skill is
 * installed on disk. Skills without a help row are internal (agent personas,
 * review facets, v6 shims) and stay out of the menu; they remain reachable
 * through AiderDesk's native project-skill invocation.
 */

export const MANIFEST_PATH = path.join('_bmad', '_config', 'manifest.yaml');
export const SKILL_MANIFEST_PATH = path.join('_bmad', '_config', 'skill-manifest.csv');

export interface InstalledModuleInfo {
  /** Module code as recorded by the installer, e.g. 'core', 'bmm', 'gds' */
  code: string;
  version?: string;
}

/** Result of reading _bmad/_config/manifest.yaml */
export interface BmadInstallation {
  installed: boolean;
  version?: string;
  modules: InstalledModuleInfo[];
  ides: string[];
}

/**
 * One user-facing entry of the method's own menu (module-help.csv row)
 * joined with its installed skill.
 */
export interface CatalogEntry {
  /**
   * Stable identifier for task metadata + continuation. Equals the skill id
   * unless a skill owns several menu rows (e.g. sprint-planning SP + SS);
   * duplicates get '#<menu-code>' appended (see resolveCatalogId).
   */
  id: string;
  /** Canonical skill id from skill-manifest.csv, e.g. 'bmad-prd' */
  skillId: string;
  /** Display name from module-help.csv, falling back to the skill id */
  name: string;
  /** The method's own short code, e.g. 'PRD', 'BP' */
  menuCode?: string;
  /** Owning module code, e.g. 'core', 'bmm', 'gds' */
  module: string;
  description: string;
  /** Original phase label, e.g. 'plan', 'ship', 'anytime' */
  phase: string;
  /** Method marks this entry as required in its own chain */
  required: boolean;
  /** Menu action variant, e.g. 'status' for the Sprint Status entry */
  action?: string;
  /** Argument hint from the menu, e.g. '[path]', '-A' */
  argsHint?: string;
  precededBy: string[];
  followedBy: string[];
  /** Raw output-location column (may reference config keys like planning_artifacts) */
  outputLocation?: string;
  outputs?: string[];
  /** Verified path to the backing SKILL.md, relative to projectDir (POSIX) */
  skillPath: string;
}

/**
 * Read _bmad/_config/skill-manifest.csv into a map keyed by canonical id
 * (later duplicate rows win). Parsing lives in skills.parseSkillManifest.
 */
const readManifestSkills = (projectDir: string): Map<string, SkillManifestRow> =>
  new Map(parseSkillManifest(projectDir).map((row) => [row.id, row]));

/**
 * Identifier for a catalog entry: unique skills keep their plain id;
 * duplicated menu rows are disambiguated deterministically.
 * Pure and exported for testing.
 */
export const resolveCatalogId = (skillId: string, menuCode: string | undefined): string => {
  if (!menuCode) {
    return skillId;
  }
  return `${skillId}#${menuCode.toLowerCase().replace(/\s+/g, '-')}`;
};

/** First occurrence of a skill keeps the plain id; later rows get a suffix. */
const buildCatalogIds = (): ((skillId: string, menuCode: string | undefined) => string) => {
  const used = new Set<string>();
  return (skillId, menuCode) => {
    let id = skillId;
    if (used.has(id)) {
      id = resolveCatalogId(skillId, menuCode);
      let counter = 2;
      while (used.has(id)) {
        id = `${resolveCatalogId(skillId, menuCode)}-${counter}`;
        counter++;
      }
    }
    used.add(id);
    return id;
  };
};

/**
 * Read _bmad/_config/manifest.yaml. Returns null when no standard
 * installation exists (the file is created by bmad-method 6.x installers).
 */
export const readInstallation = (projectDir: string): BmadInstallation | null => {
  try {
    const manifestPath = path.join(projectDir, '_bmad', '_config', 'manifest.yaml');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    const parsed = parseYaml(fs.readFileSync(manifestPath, 'utf-8')) as {
      installation?: { version?: string };
      modules?: Array<{ name?: string; version?: string }>;
      ides?: string[];
    };

    return {
      installed: true,
      version: parsed?.installation?.version,
      modules: (parsed?.modules ?? [])
        .filter((m): m is { name: string; version?: string } => typeof m?.name === 'string')
        .map((m) => ({ code: m.name, version: m.version })),
      ides: (parsed?.ides ?? []).filter((i): i is string => typeof i === 'string'),
    };
  } catch {
    return null;
  }
};

/**
 * Merge all installed modules' config.yaml values into one map.
 * Merge order follows manifest.modules order; later modules win on key
 * conflicts. Values keep their raw scalar form (strings incl. quoted ones).
 */
export const readModuleConfigs = (projectDir: string): Record<string, string> => {
  const installation = readInstallation(projectDir);
  const merged: Record<string, string> = {};

  for (const mod of installation?.modules ?? []) {
    try {
      const configPath = path.join(projectDir, '_bmad', mod.code, 'config.yaml');
      if (!fs.existsSync(configPath)) {
        continue;
      }
      const parsed = parseYaml(fs.readFileSync(configPath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string') {
            merged[key] = value;
          }
        }
      }
    } catch {
      // A broken single-module config must not break discovery.
    }
  }

  return merged;
};

const splitIdList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

/**
 * Build the catalog from the method's own menu. Only entries whose backing
 * SKILL.md exists on disk are returned; broken rows are skipped silently
 * (discovery must never block the UI).
 */
export const listCatalog = (projectDir: string): CatalogEntry[] => {
  const installation = readInstallation(projectDir);
  if (!installation) {
    return [];
  }

  const skillsDir = resolveSkillsDir(projectDir);
  if (!skillsDir) {
    return [];
  }

  const manifestSkills = readManifestSkills(projectDir);
  const entries: CatalogEntry[] = [];
  const nextId = buildCatalogIds();

  for (const mod of installation.modules) {
    const helpPath = path.join(projectDir, '_bmad', mod.code, 'module-help.csv');
    if (!fs.existsSync(helpPath)) {
      continue;
    }

    let rows: Array<Record<string, string>>;
    try {
      rows = parseCsvObjects(fs.readFileSync(helpPath, 'utf-8'));
    } catch {
      continue;
    }

    for (const row of rows) {
      const skillId = row.skill?.trim();
      // '_meta' rows describe the module itself, not an invocable entry.
      if (!skillId || skillId === '_meta') {
        continue;
      }

      const skill = manifestSkills.get(skillId);
      if (!skill) {
        continue;
      }

      const skillPath = `${skillsDir}/${skill.leafName}/SKILL.md`;
      if (!fs.existsSync(path.join(projectDir, skillPath))) {
        continue;
      }

      const menuCode = row['menu-code']?.trim() || undefined;

      entries.push({
        id: nextId(skillId, menuCode),
        skillId,
        name: row['display-name']?.trim() || skill.name,
        menuCode,
        module: mod.code,
        description: row.description?.trim() || skill.description,
        phase: row.phase?.trim() || 'anytime',
        required: (row.required ?? '').toLowerCase() === 'true',
        action: row.action?.trim() || undefined,
        argsHint: row.args?.trim() || undefined,
        precededBy: splitIdList(row['preceded-by']),
        followedBy: splitIdList(row['followed-by']),
        outputLocation: row['output-location']?.trim() || undefined,
        outputs: splitIdList(row.outputs),
        skillPath,
      });
    }
  }

  return entries;
};

/**
 * Deterministic phase grouping order. The base order reflects the method's
 * lifecycle; labels unknown to the extension (future modules may introduce
 * new phases) append in first-appearance order.
 */
const BASE_PHASE_ORDER = ['plan', '2-planning', 'ship', 'anytime'];
export const orderedPhases = (entries: CatalogEntry[]): string[] => {
  const seen: string[] = [];
  for (const entry of entries) {
    if (!seen.includes(entry.phase)) {
      seen.push(entry.phase);
    }
  }

  const base = BASE_PHASE_ORDER.filter((phase) => seen.includes(phase));
  const extra = seen.filter((phase) => !BASE_PHASE_ORDER.includes(phase));
  return [...base, ...extra];
};

const MISSING_TOKEN = '\u0000';

/**
 * Resolve an output-location template from module-help.csv against the
 * merged module configs. `{key}` tokens are substituted with config values;
 * `{project-root}` resolves to '' (paths are kept project-relative).
 *
 * Resolution is iterative: config values may themselves contain templates
 * (bmad-method 6.11 writes `planning_artifacts: "{project-root}/_bmad-output/
 * planning-artifacts"`), so substitution repeats until the value is stable.
 * Returns undefined when a token has no config value — the location is then
 * not safely resolvable.
 * Pure and exported for testing.
 */
export const resolveOutputLocation = (
  template: string,
  configs: Record<string, string>,
): string | undefined => {
  // Bare key form: the method often writes just the config key name
  // ('planning_artifacts') instead of a '{key}' template.
  let source = template;
  const bareKey = template.trim();
  if (/^[A-Za-z0-9_-]+$/.test(bareKey)) {
    const direct = configs[bareKey];
    if (direct === undefined) {
      return undefined;
    }
    source = direct;
  }

  let resolved = source;
  for (let pass = 0; pass < 5; pass++) {
    const next = resolved.replace(/\{([^}]+)\}/g, (_, key: string) => {
      const trimmed = key.trim();
      if (trimmed === 'project-root') {
        return '';
      }
      const value = configs[trimmed];
      return value !== undefined ? value : MISSING_TOKEN;
    });
    if (next === resolved) {
      break;
    }
    resolved = next;
  }

  if (resolved.includes(MISSING_TOKEN) || resolved.includes('{')) {
    return undefined;
  }

  return resolved
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
};

/** Words that describe artifact types generically and never identify one. */
const TOKEN_STOPWORDS = new Set(['and', 'or', 'the', 'a', 'an', 'optional', 'md', 'yaml', 'json', 'html']);

/**
 * Normalize a word for artifact matching: lowercase, alphanumeric only,
 * English plural/gerund stems folded ('brainstorming' -> 'brainstorm',
 * 'stories' -> 'story', 'briefs' -> 'brief'). The method's outputs column
 * uses grammatical variants of what it writes into file names.
 * Pure and exported for testing.
 */
export const normalizeWord = (word: string): string => {
  let w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.length >= 7 && w.endsWith('ing')) {
    w = w.slice(0, -3);
  } else if (w.length >= 5 && w.endsWith('ies')) {
    w = `${w.slice(0, -3)}y`;
  } else if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss')) {
    w = w.slice(0, -1);
  }
  return w;
};

/**
 * Match tokens for an entry: every normalized word of its outputs column,
 * minus generic stopwords. Pure and exported for testing.
 */
export const outputTokens = (outputs: string[]): string[] => {
  const tokens = new Set<string>();
  for (const output of outputs ?? []) {
    for (const word of output.split(/[^A-Za-z0-9]+/)) {
      const normalized = normalizeWord(word);
      if (normalized.length >= 3 && !TOKEN_STOPWORDS.has(normalized)) {
        tokens.add(normalized);
      }
    }
  }
  return [...tokens];
};

/** Where and how to recognize a catalog entry's artifacts on disk. */
export interface ArtifactTracker {
  /** Project-relative POSIX directory under which artifacts live. */
  baseDir: string;
  /** Normalized words expected in artifact path segments. */
  tokens: string[];
}

/** Why an entry cannot be tracked in progress statistics. */
export type UntrackReason =
  | 'no-output-location'
  | 'no-outputs'
  | 'unresolvable-location';

export type ArtifactTrackerResult =
  | ({ ok: true } & ArtifactTracker)
  | { ok: false; reason: UntrackReason };

/**
 * Derive where to look for a catalog entry's artifacts and how to recognize
 * them. Replaces the v2 glob heuristic: instead of one strict filename glob,
 * tracking resolves the output location's KNOWN prefix as baseDir (unknown
 * template segments like {slug} end the base and contribute their literal
 * stem as an extra token) and matches any outputs word — case-insensitively
 * and plural/gerund-tolerant — against path segment words downstream.
 *
 * Pure and exported for testing.
 */
export const deriveArtifactTracker = (
  entry: Pick<CatalogEntry, 'outputLocation' | 'outputs' | 'skillId'>,
  configs: Record<string, string>,
): ArtifactTrackerResult => {
  if (!entry.outputLocation) {
    return { ok: false, reason: 'no-output-location' };
  }
  const tokens = outputTokens(entry.outputs ?? []);
  if (tokens.length === 0) {
    return { ok: false, reason: 'no-outputs' };
  }

  const segments = entry.outputLocation.trim().split(/[\\/]+/).filter((s) => s.length > 0);

  // Bare key form: the whole location is one config key whose value may be a template.
  let sourceSegments = segments;
  if (segments.length === 1 && /^[A-Za-z0-9_-]+$/.test(segments[0])) {
    const direct = configs[segments[0]];
    if (direct === undefined) {
      return { ok: false, reason: 'unresolvable-location' };
    }
    sourceSegments = direct.split(/[\\/]+/).filter((s) => s.length > 0);
  }

  const resolvedSegments: string[] = [];
  const extraTokens = new Set<string>();

  outer: for (let i = 0; i < sourceSegments.length; i++) {
    let segment = sourceSegments[i];
    // Iteratively substitute within this segment; values may nest templates.
    for (let pass = 0; pass < 5; pass++) {
      const next = segment.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const trimmed = key.trim();
        if (trimmed === 'project-root') {
          return '';
        }
        return configs[trimmed] ?? MISSING_TOKEN;
      });
      if (next === segment) {
        break;
      }
      segment = next;
    }

    if (!segment.includes('{') && !segment.includes(MISSING_TOKEN)) {
      for (const part of segment.split(/[\\/]+/)) {
        if (part.length > 0) {
          resolvedSegments.push(part);
        }
      }
      continue;
    }

    // Unresolvable segment: keep everything before it as the base and use
    // its literal leading stem as a recognition hint (specs/spec-{slug} ->
    // base _bmad-output/specs, hint token 'spec').
    const stem = segment.split('{')[0].replace(/[^A-Za-z0-9-_ ]/g, ' ');
    for (const word of stem.split(/[\s_-]+/)) {
      const normalized = normalizeWord(word);
      if (normalized.length >= 3) {
        extraTokens.add(normalized);
      }
    }
    break outer;
  }

  const baseDir = resolvedSegments.join('/').replace(/^\.\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const finalBase = baseDir.replace(/\\/g, '/').split('/').filter((s) => s.length > 0);
  if (finalBase.length === 0) {
    // Location collapsed entirely (e.g. only '{project-root}') — the base
    // would be the project root itself; matching there is too broad.
    return { ok: false, reason: 'unresolvable-location' };
  }

  // The base directory's own last segment often names the artifact kind
  // (brainstorming/, research/, specs/) and counts toward recognition.
  for (const word of finalBase[finalBase.length - 1].split(/[\s_-]+/)) {
    const normalized = normalizeWord(word);
    if (normalized.length >= 3) {
      tokens.push(normalized);
    }
  }

  return { ok: true, baseDir, tokens: [...new Set([...tokens, ...extraTokens])] };
};

/**
 * Group catalog entries by their canonical skill id. Duplicate menu rows
 * across modules (core BSP + bmm BP both point at bmad-brainstorming's one
 * SKILL.md) collapse into one group so progress counts each skill once;
 * the first occurrence is the representative (stable manifest order).
 * Pure and exported for testing.
 */
export interface SkillGroup {
  skillId: string;
  entries: CatalogEntry[];
  representative: CatalogEntry;
}

export const groupCatalogBySkill = (entries: CatalogEntry[]): SkillGroup[] => {
  const groups = new Map<string, SkillGroup>();
  for (const entry of entries) {
    const existing = groups.get(entry.skillId);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(entry.skillId, { skillId: entry.skillId, entries: [entry], representative: entry });
    }
  }

  // Duplicate rows of one skill across modules (core BSP 'anytime' + bmm BP
  // 'plan'): prefer a lifecycle-phase row as representative so progress,
  // stepper and suggestions attribute shared skills to their lifecycle phase
  // instead of hiding them under anytime helpers.
  for (const group of groups.values()) {
    const lifecycleRow = group.entries.find((entry) => entry.phase !== 'anytime');
    if (lifecycleRow) {
      group.representative = lifecycleRow;
    }
  }

  return [...groups.values()];
};


