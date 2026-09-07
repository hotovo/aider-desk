/**
 * Update checker for bmad-method.
 *
 * Queries the npm registry to find the latest patch version within the same
 * minor version line as the currently installed version. Results are cached
 * in memory for a configurable interval (default 24h) to avoid spamming npm.
 *
 * @module lib/update-checker
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import type { UpdateInfo } from './types';

const execAsync = promisify(exec);

/** Default minimum interval between npm registry checks (24 hours in ms) */
export const DEFAULT_UPDATE_CHECK_INTERVAL_MS = 86_400_000;

/**
 * Environment variable to override the check interval (value in ms as a string).
 * Set to `"0"` to check on every status request (dev/debug only).
 */
export const ENV_INTERVAL_KEY = 'AIDERDESK_BMAD_UPDATE_CHECK_INTERVAL';

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: UpdateInfo | null;
  timestamp: number;
}

let cache: CacheEntry | undefined;

/** Reset the in-memory cache (used by tests). */
export function _resetCache(): void {
  cache = undefined;
}

/** Read the effective check interval from the environment or the default. */
export function getCheckInterval(): number {
  const fromEnv = process.env[ENV_INTERVAL_KEY];
  if (fromEnv !== undefined) {
    const parsed = parseInt(fromEnv, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_UPDATE_CHECK_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// Version helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Parse a semver string into { major, minor, patch }.
 * Returns `null` for invalid or pre-release versions.
 */
export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two parsed semver objects.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
export function compareSemver(
  a: { major: number; minor: number; patch: number },
  b: { major: number; minor: number; patch: number },
): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Find the latest non-pre-release version in a list of version strings that
 * belongs to the same minor line as `currentParsed`.
 *
 * Returns the version string, or `undefined` if no qualifying version is found.
 */
export function findLatestPatch(
  versions: string[],
  currentParsed: { major: number; minor: number; patch: number },
): string | undefined {
  let latest: string | undefined;
  let latestParsed: { major: number; minor: number; patch: number } | undefined;

  for (const v of versions) {
    const parsed = parseSemver(v);
    if (!parsed) {
      continue; // skip pre-release or invalid
    }
    if (parsed.major !== currentParsed.major || parsed.minor !== currentParsed.minor) {
      continue; // different minor line
    }
    if (!latestParsed || compareSemver(parsed, latestParsed) > 0) {
      latest = v;
      latestParsed = parsed;
    }
  }

  return latest;
}

// ---------------------------------------------------------------------------
// Known breaking-change notes (migration hints per version range)
// ---------------------------------------------------------------------------

interface VersionRange {
  /** Inclusive lower bound (semver string), or undefined for "any earlier" */
  from?: string;
  /** Exclusive upper bound (semver string) */
  to?: string;
  notes: string[];
}

/**
 * Migration hints for known breaking changes between bmad-method versions.
 * Ranges are [from, to) — `from` inclusive, `to` exclusive.
 */
export const KNOWN_BREAKING_NOTES: VersionRange[] = [
  {
    from: '6.10.1',
    to: '6.11.0',
    notes: [
      'Quick Dev wurde zu Build umbenannt — die Extension nutzt automatisch bmad-build (Fallback auf den alten Skill bei 6.10.0).',
      'bmad-build / bmad-build-auto schreiben nach _bmad/render/ und benötigen uv (Python 3.11+).',
      'Neue Workflows: PRFAQ, Forge Idea, Deep Recon, Build Auto. Entfernt: Index Docs, Shard Doc.',
      'Check Implementation Readiness wurde entfernt - das Readiness-Gate ist in Sprint Planning integriert (Extension ab 1.6.0 zeigt den Workflow nicht mehr).',
      'Neue Skills: QA Generate E2E Tests und Checkpoint Preview - ab Extension 1.6.0 als versionierte Workflows verfuegbar (benoetigen BMAD 6.10.1+).',
    ],
  },
  {
    from: '6.11.0',
    to: '6.12.0',
    notes: [
      'BMAD 6.11: Skills werden beim Start gerendert - bmad-build ist ein Bootstrap, der render_skill.py ausfuehrt und die gerenderte workflow.md aus _bmad/render/ liest (uv mit Python 3.11+ erforderlich; die Extension auto-approved diese Pfade).',
      'Konsolidierung: market/domain/technical-research forwarden zu bmad-deep-recon, document-project/generate-project-context zu bmad-project-context (AGENTS.md-Block), sprint-status zu bmad-sprint-planning (Status-View), edit-prd/validate-prd zu bmad-prd, create-architecture zu bmad-architecture. Die Extension ruft fuer Sprint Status direkt bmad-sprint-planning auf (Fallback auf den Shim bei aelteren Versionen).',
      'Neue Workflows ab Extension 1.7.0: Review (bmad-review), Project Context, Advanced Elicitation, Party Mode, Customize und die Agenten-Personas (Business Analyst, Product Manager, UX Designer, System Architect, Senior Developer).',
      'Neue Konfigurationsebene: _bmad/config.toml + _bmad/custom/config.toml (Agenten-Personas, Overrides) - bestehende config.yaml bleibt erhalten.',
    ],
  },
  {
    from: '6.12.0',
    to: '7.0.0',
    notes: [
      'BMAD 6.12: Deprecated Shims werden bei Neuinstallation nicht mehr mitgeliefert (opt-in via --shims); bestaehende Installationen behalten sie beim Update. Die Extension-Menues zeigen ohnehin nur kanonische Workflows.',
      'Checkpoint Preview heisst jetzt Walkthrough (bmad-checkpoint-preview -> bmad-walkthrough, Menue-Code CK -> WT); die Extension uebernimmt den neuen Katalogeintrag automatisch.',
      'persistent_facts startet leer und project-context.md wird nicht mehr automatisch geladen (ggf. Override ergaenzen); bmad-project-context pflegt stattdessen einen verwalteten Block in AGENTS.md.',
      'llms.txt / llms-full.txt werden nicht mehr veroeffentlicht.',
    ],
  },
];

/**
 * Migration notes for a target version, or `undefined` when no known
 * breaking changes apply to that version.
 */
export function getUpdateNotes(targetVersion: string): string[] | undefined {
  const target = parseSemver(targetVersion);
  if (!target) {
    return undefined;
  }
  const matched = KNOWN_BREAKING_NOTES.filter((range) => {
    if (range.from) {
      const from = parseSemver(range.from);
      if (!from || compareSemver(target, from) < 0) {
        return false;
      }
    }
    if (range.to) {
      const to = parseSemver(range.to);
      if (!to || compareSemver(target, to) >= 0) {
        return false;
      }
    }
    return true;
  });
  return matched.length ? matched.flatMap((r) => r.notes) : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query the npm registry for available versions of bmad-method and determine
 * whether a newer patch exists for the currently installed version line.
 *
 * Results are cached in memory for the configured interval to avoid repeatedly
 * hitting the npm registry.
 *
 * @param currentVersion - The installed version string (e.g. "6.10.0").
 * @returns An `UpdateInfo` describing the update status, or `null` when the
 *   current version cannot be parsed or the package name is unknown.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  // --- Cache hit? ---
  const now = Date.now();
  const interval = getCheckInterval();

  if (cache && now - cache.timestamp < interval) {
    return cache.result;
  }

  // --- Parse current version ---
  const currentParsed = parseSemver(currentVersion);
  if (!currentParsed) {
    const result: UpdateInfo = {
      currentVersion,
      latestPatchVersion: '',
      updateAvailable: false,
      lastChecked: now,
      error: `Cannot parse installed version: "${currentVersion}"`,
    };
    cache = { result, timestamp: now };
    return result;
  }

  // --- Query npm registry ---
  try {
    const { stdout } = await execAsync('npm view bmad-method versions --json', {
      timeout: 15_000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const versions: string[] = JSON.parse(stdout);
    if (!Array.isArray(versions)) {
      throw new Error('npm returned non-array versions');
    }

    const latestPatch = findLatestPatch(versions, currentParsed);
    if (!latestPatch) {
      // No same-minor versions found — unexpected but not an error
      const result: UpdateInfo = {
        currentVersion,
        latestPatchVersion: '',
        updateAvailable: false,
        lastChecked: now,
      };
      cache = { result, timestamp: now };
      return result;
    }

    const latestParsed = parseSemver(latestPatch)!;
    const updateAvailable = compareSemver(latestParsed, currentParsed) > 0;

    const result: UpdateInfo = {
      currentVersion,
      latestPatchVersion: latestPatch,
      updateAvailable,
      lastChecked: now,
      notes: updateAvailable ? getUpdateNotes(latestPatch) : undefined,
    };

    cache = { result, timestamp: now };
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // On network / npm errors, return a non-blocking result with the error
    const result: UpdateInfo = {
      currentVersion,
      latestPatchVersion: '',
      updateAvailable: false,
      lastChecked: now,
      error: `Update check failed: ${message}`,
    };

    cache = { result, timestamp: now };
    return result;
  }
}
