import fs from 'fs';
import path from 'path';

import Handlebars from 'handlebars';
import type { BmadConfig } from './types.js';
import { preprocessSkillContent, loadBmadConfig } from './skill-preprocessor.js';

// ---------------------------------------------------------------------------
// Internal – single source of truth for reading + preprocessing a skill file
// ---------------------------------------------------------------------------

function renderSkillContent(
  projectDir: string,
  skillsDir: string,
  skillName: string,
  fileName: string,
  options: Handlebars.HelperOptions,
): string {
  const absolutePath = path.resolve(projectDir, skillsDir, skillName, fileName);
  try {
    const rawContent = fs.readFileSync(absolutePath, 'utf8');

    // Only SKILL.md should be preprocessed (placeholder resolution + python3→uv run).
    // Supplementary files like checklist.md, template.md, sprint-status-template.yaml
    // are injected raw.
    if (fileName !== 'SKILL.md') {
      return JSON.stringify(rawContent);
    }

    // Prefer config from the Handlebars render context (already loaded once).
    // Fall back to a fresh loadBmadConfig call (cache hit, essentially free).
    const config: BmadConfig =
      (options.data?.root?.bmadConfig as BmadConfig | undefined) ??
      loadBmadConfig(projectDir);

    const processed = preprocessSkillContent(rawContent, {
      projectDir,
      skillsDir,
      skillName,
      config,
    });
    return JSON.stringify(processed);
  } catch (error) {
    throw new Error(
      `Failed to read skill file ${absolutePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public Handlebars helpers
// ---------------------------------------------------------------------------

export const registerFileHelpers = (): void => {
  Handlebars.registerHelper(
    'fileContent',
    (filePath: string, options: Handlebars.HelperOptions) => {
      const projectDir = options.data?.root?.projectDir;
      if (!projectDir) {
        throw new Error('fileContent helper requires projectDir in context');
      }

      const absolutePath = path.resolve(projectDir, filePath);
      try {
        return JSON.stringify(fs.readFileSync(absolutePath, 'utf8'));
      } catch (error) {
        throw new Error(
          `Failed to read file ${absolutePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );

  // Joins string fragments into a path, for use in subexpressions:
  // {{fileContent (concatPath "_bmad/" skillModule "/config.yaml")}}
  Handlebars.registerHelper('concatPath', (...args: unknown[]) => {
    args.pop(); // options
    return args.map((a) => String(a)).join('');
  });

  // -----------------------------------------------------------------------
  // Thin wrapper: skillName → resolves to <skillsDir>/<skillName>/<fileName>
  // Usage: {{skillFileContent "bmad-prd"}}
  //        {{skillFileContent "bmad-sprint-planning" "checklist.md"}}
  // -----------------------------------------------------------------------
  Handlebars.registerHelper('skillFileContent', (...args: unknown[]) => {
    const options = args.pop() as Handlebars.HelperOptions;
    const skillName = args[0] as string;
    const fileName =
      typeof args[1] === 'string' ? (args[1] as string) : 'SKILL.md';

    const projectDir = options.data?.root?.projectDir;
    const skillsDir = options.data?.root?.skillsDir;
    if (!projectDir || !skillsDir) {
      throw new Error(
        'skillFileContent helper requires projectDir and skillsDir in context',
      );
    }

    return renderSkillContent(
      projectDir as string,
      skillsDir,
      skillName,
      fileName,
      options,
    );
  });

  // -----------------------------------------------------------------------
  // Thin wrapper: full skillPath → extracts skillName → delegates
  // Usage: {{skillFileContentByPath skillPath}}
  //
  // Needed by generic-skill.json.hbs which operates on a raw skillPath
  // (e.g. ".agents/skills/bmad-domain-research/SKILL.md") instead of a
  // skillName.  Always reads SKILL.md regardless of what the path points
  // to (today all skillPaths end in SKILL.md, so this is always correct).
  // -----------------------------------------------------------------------
  Handlebars.registerHelper('skillFileContentByPath', (...args: unknown[]) => {
    const options = args.pop() as Handlebars.HelperOptions;
    const skillPath = args[0] as string;

    const projectDir = options.data?.root?.projectDir;
    const skillsDir = options.data?.root?.skillsDir;
    if (!projectDir) {
      throw new Error(
        'skillFileContentByPath helper requires projectDir in context',
      );
    }

    // Extract skillName from the path.
    //    ".agents/skills/bmad-prd/SKILL.md"  →  "bmad-prd"
    //    ".claude/skills/cis/SKILL.md"       →  "cis"
    const normalizedPath = skillPath.replace(/\\/g, '/');
    const normalizedSkillsDir = (
      skillsDir ?? '.agents/skills'
    ).replace(/\\/g, '/');

    let skillName: string;
    if (normalizedPath.startsWith(normalizedSkillsDir + '/')) {
      const relative = normalizedPath.slice(normalizedSkillsDir.length + 1);
      skillName = relative.split('/')[0];
    } else {
      // Fallback: second-to-last path segment
      const parts = normalizedPath.split('/');
      skillName = parts[parts.length - 2] || 'unknown';
    }

    // Note: we always read SKILL.md here, not whatever the path points to.
    // This is correct for the only consumer (generic-skill.json.hbs) which
    // uses skillPath from skill-manifest.csv (always ends in SKILL.md).
    return renderSkillContent(
      projectDir,
      skillsDir ?? '.agents/skills',
      skillName,
      'SKILL.md',
      options,
    );
  });
};
