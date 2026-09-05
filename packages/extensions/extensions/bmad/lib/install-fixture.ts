import * as fs from 'fs';
import * as path from 'path';

/**
 * Test-only fixture builder: creates a bmad-method 6.10+ standard
 * installation layout in a directory, mirroring what `npx bmad-method
 * install` produces (verified against a real 6.11.0 install):
 *
 *   _bmad/_config/manifest.yaml
 *   _bmad/_config/skill-manifest.csv
 *   _bmad/<module>/config.yaml          (optional)
 *   _bmad/<module>/module-help.csv      (optional)
 *   <skillsDir>/<skill>/SKILL.md
 *
 * Used by the vitest suites only — never imported by extension runtime code.
 */

export interface FixtureSkill {
  /** canonicalId in skill-manifest.csv AND directory name under skillsDir */
  id: string;
  name?: string;
  description?: string;
  module: string;
  content?: string;
}

export interface FixtureHelpRow {
  skill: string;
  module?: string;
  'display-name'?: string;
  'menu-code'?: string;
  description?: string;
  action?: string;
  args?: string;
  phase?: string;
  'preceded-by'?: string;
  'followed-by'?: string;
  required?: string;
  'output-location'?: string;
  outputs?: string;
}

export interface FixtureModule {
  code: string;
  version?: string;
  configYaml?: string;
  helpRows?: FixtureHelpRow[];
}

export interface FixtureInstallSpec {
  version?: string;
  ides?: string[];
  /** Project-relative skills dir; defaults to '.agents/skills' */
  skillsDir?: string;
  modules: FixtureModule[];
  skills: FixtureSkill[];
}

const csvEscape = (value: string): string => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const HELP_COLUMNS = [
  'module',
  'skill',
  'display-name',
  'menu-code',
  'description',
  'action',
  'args',
  'phase',
  'preceded-by',
  'followed-by',
  'required',
  'output-location',
  'outputs',
] as const;

export const createBmadInstallFixture = (
  projectDir: string,
  spec: FixtureInstallSpec,
): string => {
  const skillsDir = spec.skillsDir ?? '.agents/skills';
  const version = spec.version ?? '6.11.0';
  const ides = spec.ides ?? ['amp'];

  // manifest.yaml
  const manifestLines = [
    'installation:',
    `  version: ${version}`,
    '  installDate: 2026-08-24T00:00:00.000Z',
    'modules:',
  ];
  for (const mod of spec.modules) {
    manifestLines.push(`  - name: ${mod.code}`);
    manifestLines.push(`    version: ${mod.version ?? version}`);
  }
  manifestLines.push('ides:');
  for (const ide of ides) {
    manifestLines.push(`  - ${ide}`);
  }

  fs.mkdirSync(path.join(projectDir, '_bmad', '_config'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, '_bmad', '_config', 'manifest.yaml'), manifestLines.join('\n') + '\n');

  // skill-manifest.csv
  const manifestRows = [
    'canonicalId,name,description,module,path',
    ...spec.skills.map(
      (skill) =>
        [
          csvEscape(skill.id),
          csvEscape(skill.name ?? skill.id),
          csvEscape(skill.description ?? ''),
          csvEscape(skill.module),
          csvEscape(`_bmad/${skill.module}/${skill.id}/SKILL.md`),
        ].join(','),
    ),
  ];
  fs.writeFileSync(path.join(projectDir, '_bmad', '_config', 'skill-manifest.csv'), manifestRows.join('\n') + '\n');

  // Skills on disk (marker skill included implicitly by the caller's list)
  for (const skill of spec.skills) {
    const skillDir = path.join(projectDir, skillsDir, skill.id);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content ?? `# ${skill.id}\n`);
  }

  // Per-module config + menu
  for (const mod of spec.modules) {
    const moduleDir = path.join(projectDir, '_bmad', mod.code);
    fs.mkdirSync(moduleDir, { recursive: true });

    if (mod.configYaml !== undefined) {
      fs.writeFileSync(path.join(moduleDir, 'config.yaml'), mod.configYaml);
    }

    if (mod.helpRows !== undefined) {
      const lines = [
        HELP_COLUMNS.join(','),
        ...mod.helpRows.map((row) =>
          [
            row.module ?? mod.code,
            row.skill,
            row['display-name'] ?? '',
            row['menu-code'] ?? '',
            row.description ?? '',
            row.action ?? '',
            row.args ?? '',
            row.phase ?? '',
            row['preceded-by'] ?? '',
            row['followed-by'] ?? '',
            row.required ?? '',
            row['output-location'] ?? '',
            row.outputs ?? '',
          ]
            .map((cell) => csvEscape(String(cell)))
            .join(','),
        ),
      ];
      fs.writeFileSync(path.join(moduleDir, 'module-help.csv'), lines.join('\n') + '\n');
    }
  }

  return projectDir;
};
