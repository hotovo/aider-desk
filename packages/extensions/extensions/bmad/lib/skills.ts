import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'yaml';

import { parseCsvObjects } from './csv';

import type { InstalledSkill } from './types';

/**
 * Maps BMAD installer tool/IDE IDs to their project-level skills directory.
 * Derived from tools/installer/ide/platform-codes.yaml of bmad-method 6.10.0.
 */
const TOOL_SKILLS_DIRS: Record<string, string> = {
  adal: '.adal/skills',
  amp: '.agents/skills',
  antigravity: '.agent/skills',
  auggie: '.agents/skills',
  bob: '.bob/skills',
  'claude-code': '.claude/skills',
  cline: '.cline/skills',
  codex: '.agents/skills',
  codewhale: '.codewhale/skills',
  codebuddy: '.codebuddy/skills',
  'command-code': '.agents/skills',
  cortex: '.cortex/skills',
  crush: '.agents/skills',
  cursor: '.agents/skills',
  droid: '.factory/skills',
  firebender: '.firebender/skills',
  gemini: '.agents/skills',
  'github-copilot': '.agents/skills',
  goose: '.agents/skills',
  hermes: '.agents/skills',
  iflow: '.iflow/skills',
  junie: '.junie/skills',
  kilo: '.agents/skills',
  'kimi-code': '.agents/skills',
  kiro: '.kiro/skills',
  kode: '.kode/skills',
  'mistral-vibe': '.agents/skills',
  mux: '.agents/skills',
  neovate: '.neovate/skills',
  ona: '.ona/skills',
  openclaw: '.agents/skills',
  opencode: '.agents/skills',
  openhands: '.agents/skills',
  pi: '.agents/skills',
  pochi: '.agents/skills',
  qoder: '.qoder/skills',
  qwen: '.qwen/skills',
  replit: '.agents/skills',
  roo: '.agents/skills',
  'rovo-dev': '.agents/skills',
  trae: '.trae/skills',
  warp: '.agents/skills',
  windsurf: '.agents/skills',
  zencoder: '.zencoder/skills',
};

/** Directories probed when the install manifest does not reveal a usable tool */
const FALLBACK_SKILLS_DIRS = ['.agents/skills', '.claude/skills'];

/** Marker skill that exists in every BMAD 6.10+ installation */
const MARKER_SKILL = 'bmad-help';

const hasMarkerSkill = (projectDir: string, skillsDir: string): boolean => {
  return fs.existsSync(path.join(projectDir, skillsDir, MARKER_SKILL, 'SKILL.md'));
};

/**
 * Resolve the project-relative directory holding the installed BMAD skills.
 *
 * BMAD 6.10+ no longer keeps skill content under _bmad/<module>/ — the installer
 * copies each skill into the configured tool's skills directory (e.g. .agents/skills).
 * The configured tools are recorded in _bmad/_config/manifest.yaml under `ides:`.
 *
 * Returns a path relative to projectDir (POSIX separators), or undefined when
 * no skills directory can be found.
 */
export const resolveSkillsDir = (projectDir: string): string | undefined => {
  try {
    const manifestPath = path.join(projectDir, '_bmad', '_config', 'manifest.yaml');
    if (fs.existsSync(manifestPath)) {
      const manifest = yaml.parse(fs.readFileSync(manifestPath, 'utf-8')) as { ides?: string[] };
      for (const ide of manifest?.ides ?? []) {
        const dir = TOOL_SKILLS_DIRS[ide];
        if (dir && hasMarkerSkill(projectDir, dir)) {
          return dir;
        }
      }
    }
  } catch {
    // Fall through to probing
  }

  for (const dir of FALLBACK_SKILLS_DIRS) {
    if (hasMarkerSkill(projectDir, dir)) {
      return dir;
    }
  }

  return undefined;
};

/**
 * List all skills installed by the BMAD 6.10+ installer.
 *
 * Reads _bmad/_config/skill-manifest.csv. The `path` column there points at the
 * module source layout (_bmad/<module>/...), which does not exist on disk — the
 * actual files live flattened by leaf name inside the tool skills directory, so
 * the returned skillPath is remapped to `<skillsDir>/<leafName>/SKILL.md` and
 * verified to exist.
 */
/**
 * One parsed row of _bmad/_config/skill-manifest.csv.
 */
export interface SkillManifestRow {
  /** Canonical skill id, e.g. 'bmad-prd' */
  id: string;
  name: string;
  description: string;
  module: string;
  /** Directory name the installer flattens this skill into on disk */
  leafName: string;
}

/**
 * Parse _bmad/_config/skill-manifest.csv (header-based columns). Broken rows
 * are skipped silently — discovery must never block the UI. Shared by
 * listInstalledSkills and the catalog builder in install-registry.
 */
export const parseSkillManifest = (projectDir: string): SkillManifestRow[] => {
  const manifestCsvPath = path.join(projectDir, '_bmad', '_config', 'skill-manifest.csv');
  if (!fs.existsSync(manifestCsvPath)) {
    return [];
  }

  const rows: SkillManifestRow[] = [];
  try {
    for (const row of parseCsvObjects(fs.readFileSync(manifestCsvPath, 'utf-8'))) {
      const id = row.canonicalId?.trim();
      const sourcePath = row.path?.trim();
      if (!id || !sourcePath) {
        continue;
      }

      // '_bmad/bmm/1-analysis/bmad-product-brief/SKILL.md' -> 'bmad-product-brief'
      const segments = sourcePath.replace(/\\/g, '/').split('/');
      const leafName = segments.length >= 2 ? segments[segments.length - 2] : id;

      rows.push({
        id,
        name: row.name?.trim() || id,
        description: row.description?.trim() ?? '',
        module: row.module?.trim() || 'unknown',
        leafName,
      });
    }
  } catch {
    // A broken CSV must not break discovery.
  }
  return rows;
};

/**
 * List all skills installed by the BMAD 6.10+ installer whose SKILL.md exists
 * on disk in the resolved tool skills directory.
 */
export const listInstalledSkills = (projectDir: string): InstalledSkill[] => {
  const skillsDir = resolveSkillsDir(projectDir);
  if (!skillsDir) {
    return [];
  }

  const skills: InstalledSkill[] = [];
  for (const row of parseSkillManifest(projectDir)) {
    const skillPath = `${skillsDir}/${row.leafName}/SKILL.md`;
    if (!fs.existsSync(path.join(projectDir, skillPath))) {
      continue;
    }

    skills.push({
      id: row.id,
      name: row.name,
      description: row.description,
      module: row.module,
      skillPath,
    });
  }

  return skills;
};
