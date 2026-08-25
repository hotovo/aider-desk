import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';
import { loadFront } from 'yaml-front-matter';

import type { ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';

const AIDER_DESK_DIR_NAME = process.env.AIDER_DESK_DIR || '.aider-desk';
const SKILLS_DIR_NAME = 'skills';
const SKILL_MARKDOWN_FILE = 'SKILL.md';
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_CONTENT_CHARS = 100_000;
const MAX_FILE_BYTES = 1_048_576;
const VALID_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

const ALLOWED_SUBDIRS = new Set(['references', 'templates', 'scripts', 'assets']);

export const getHomeDir = (): string => process.env.AIDER_DESK_HOME_DIR || join(homedir(), AIDER_DESK_DIR_NAME);

const inputSchema = z.object({
  action: z
    .enum(['create', 'edit', 'write_file', 'refresh'])
    .describe('Action to perform: create a new skill, edit SKILL.md of an existing skill, write a supporting file, or refresh the skill index'),
  name: z.string().optional().describe("Skill name (lowercase-hyphenated). Required for all actions except 'refresh'"),
  content: z.string().optional().describe("SKILL.md content for 'create' or 'edit' actions. Must include YAML frontmatter with name and description"),
  file_path: z.string().optional().describe("Supporting file path within the skill (e.g. 'references/api.md', 'scripts/deploy.sh'). For 'write_file' action"),
  file_content: z.string().optional().describe('Content for the supporting file. For write_file action'),
  location: z
    .enum(['global', 'project'])
    .optional()
    .default('global')
    .describe('Where to save the skill: global (~/.aider-desk/skills/) or project (.aider-desk/skills/). Defaults to global'),
});

type SaveSkillInput = z.infer<typeof inputSchema>;

interface SkillResult {
  success: boolean;
  message: string;
  path?: string;
  skill_md?: string;
  hint?: string;
}

export const validateName = (name: string): string | null => {
  if (!name) {
    return 'Skill name is required.';
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Skill name exceeds ${MAX_NAME_LENGTH} characters.`;
  }
  if (!VALID_NAME_RE.test(name)) {
    return `Invalid skill name '${name}'. Use lowercase letters, numbers, hyphens, dots, and underscores. Must start with a letter or digit.`;
  }
  return null;
};

export const validateFrontmatter = (content: string): string | null => {
  if (!content.trim()) {
    return 'Content cannot be empty.';
  }

  const cleaned = content.replace(/^\uFEFF/, '');

  if (!cleaned.startsWith('---')) {
    return 'SKILL.md must start with YAML frontmatter (---).';
  }

  const endMatch = cleaned.slice(3).match(/\n---\s*\n/);
  if (!endMatch || endMatch.index === undefined) {
    return "SKILL.md frontmatter is not closed. Ensure you have a closing '---' line.";
  }

  const frontmatterEnd = endMatch.index + 3 + endMatch[0].length;
  const frontmatterBlock = cleaned.slice(0, frontmatterEnd);

  let parsed: Record<string, unknown>;
  try {
    parsed = loadFront(frontmatterBlock) as Record<string, unknown>;
  } catch {
    return 'YAML frontmatter parse error.';
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return 'Frontmatter must be a YAML mapping (key: value pairs).';
  }

  if (!('name' in parsed)) {
    return "Frontmatter must include 'name' field.";
  }
  if (!('description' in parsed)) {
    return "Frontmatter must include 'description' field.";
  }

  const desc = String(parsed.description);
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    return `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  if (desc.trim().length > 60) {
    return (
      `Description is ${desc.trim().length} chars — skills must keep the ` +
      'description <=60 chars (the skill index truncates it, destroying ' +
      'the routing signal). Move detail into the skill body.'
    );
  }

  const body = cleaned.slice(frontmatterEnd).trim();
  if (!body) {
    return 'SKILL.md must have content after the frontmatter.';
  }

  return null;
};

const validateContentSize = (content: string, label = 'SKILL.md'): string | null => {
  if (content.length > MAX_CONTENT_CHARS) {
    return (
      `${label} content is ${content.length.toLocaleString()} characters ` +
      `(limit: ${MAX_CONTENT_CHARS.toLocaleString()}). Consider splitting ` +
      'into a smaller SKILL.md with supporting files in references/ or templates/.'
    );
  }
  return null;
};

export const validateFilePath = (filePath: string): string | null => {
  if (!filePath) {
    return 'file_path is required.';
  }

  if (filePath.includes('..')) {
    return "Path traversal ('..') is not allowed.";
  }

  const normalized = filePath.replace(/\\/g, '/');

  if (normalized === 'SKILL.md' || normalized.endsWith('/SKILL.md')) {
    return null;
  }

  const parts = normalized.split('/');
  if (parts.length === 0 || !ALLOWED_SUBDIRS.has(parts[0]!)) {
    const allowed = Array.from(ALLOWED_SUBDIRS).sort().join(', ');
    return `File must be under one of: ${allowed}. Got: '${filePath}'`;
  }

  if (parts.length < 2) {
    return `Provide a file path, not just a directory. Example: '${parts[0]}/myfile.md'`;
  }

  return null;
};

const resolveSkillDir = (name: string, location: 'global' | 'project', context: ExtensionContext): string => {
  if (location === 'project') {
    const projectDir = context.getProjectDir();
    if (!projectDir) {
      throw new Error('No project directory available for project-scoped skill');
    }
    return join(projectDir, AIDER_DESK_DIR_NAME, SKILLS_DIR_NAME, name);
  }
  return join(getHomeDir(), SKILLS_DIR_NAME, name);
};

const findSkill = async (name: string, context: ExtensionContext): Promise<string | null> => {
  const globalDir = join(getHomeDir(), SKILLS_DIR_NAME, name);
  if (existsSync(join(globalDir, SKILL_MARKDOWN_FILE))) {
    return globalDir;
  }

  const projectDir = context.getProjectDir();
  if (projectDir) {
    const projectSkillDir = join(projectDir, AIDER_DESK_DIR_NAME, SKILLS_DIR_NAME, name);
    if (existsSync(join(projectSkillDir, SKILL_MARKDOWN_FILE))) {
      return projectSkillDir;
    }
  }

  return null;
};

const listSkills = async (context: ExtensionContext): Promise<unknown[]> => {
  const skills: { name: string; description: string; location: string }[] = [];

  const scanDir = async (dir: string, location: string) => {
    if (!existsSync(dir)) {
      return;
    }
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = join(dir, entry);
      let entryStat;
      try {
        entryStat = await stat(entryPath);
      } catch {
        continue;
      }
      if (!entryStat.isDirectory()) {
        continue;
      }
      const skillMdPath = join(entryPath, SKILL_MARKDOWN_FILE);
      if (!existsSync(skillMdPath)) {
        continue;
      }
      try {
        const content = await readFile(skillMdPath, 'utf8');
        const parsed = loadFront(content) as Record<string, unknown>;
        const name = typeof parsed.name === 'string' ? parsed.name : entry;
        const description = typeof parsed.description === 'string' ? parsed.description : '';
        skills.push({ name, description, location });
      } catch {
        continue;
      }
    }
  };

  await scanDir(join(getHomeDir(), SKILLS_DIR_NAME), 'global');

  const projectDir = context.getProjectDir();
  if (projectDir) {
    await scanDir(join(projectDir, AIDER_DESK_DIR_NAME, SKILLS_DIR_NAME), 'project');
  }

  return skills;
};

const handleCreate = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  const { name, content, location = 'global' } = input;

  if (!name) {
    return { success: false, message: 'Skill name is required for create action.' };
  }
  if (!content) {
    return { success: false, message: 'Content is required for create action.' };
  }

  const nameErr = validateName(name);
  if (nameErr) {
    return { success: false, message: nameErr };
  }

  const fmErr = validateFrontmatter(content);
  if (fmErr) {
    return { success: false, message: fmErr };
  }

  const sizeErr = validateContentSize(content);
  if (sizeErr) {
    return { success: false, message: sizeErr };
  }

  const existing = await findSkill(name, context);
  if (existing) {
    return {
      success: false,
      message: `A skill named '${name}' already exists at ${existing}. Use action='edit' to modify it.`,
    };
  }

  const skillDir = resolveSkillDir(name, location, context);
  await mkdir(skillDir, { recursive: true });

  const skillMdPath = join(skillDir, SKILL_MARKDOWN_FILE);
  await writeFile(skillMdPath, content, 'utf8');

  return {
    success: true,
    message: `Skill '${name}' created at ${location} location.`,
    path: skillDir,
    skill_md: skillMdPath,
    hint: "To add reference files, templates, or scripts, use action='write_file' with file_path like 'references/example.md'",
  };
};

const handleEdit = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  const { name, content } = input;

  if (!name) {
    return { success: false, message: 'Skill name is required for edit action.' };
  }
  if (!content) {
    return { success: false, message: 'Content is required for edit action.' };
  }

  const fmErr = validateFrontmatter(content);
  if (fmErr) {
    return { success: false, message: fmErr };
  }

  const sizeErr = validateContentSize(content);
  if (sizeErr) {
    return { success: false, message: sizeErr };
  }

  const existing = await findSkill(name, context);
  if (!existing) {
    return {
      success: false,
      message: `Skill '${name}' not found. Use action='create' to create a new skill.`,
    };
  }

  const skillMdPath = join(existing, SKILL_MARKDOWN_FILE);
  await writeFile(skillMdPath, content, 'utf8');

  return {
    success: true,
    message: `Skill '${name}' updated (full rewrite).`,
    path: existing,
    skill_md: skillMdPath,
  };
};

const handleWriteFile = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  const { name, file_path, file_content } = input;

  if (!name) {
    return { success: false, message: 'Skill name is required for write_file action.' };
  }
  if (!file_path) {
    return { success: false, message: 'file_path is required for write_file action.' };
  }
  if (file_content === undefined || file_content === null) {
    return { success: false, message: 'file_content is required for write_file action.' };
  }

  const pathErr = validateFilePath(file_path);
  if (pathErr) {
    return { success: false, message: pathErr };
  }

  const contentBytes = Buffer.byteLength(file_content, 'utf8');
  if (contentBytes > MAX_FILE_BYTES) {
    return {
      success: false,
      message: `File content is ${contentBytes.toLocaleString()} bytes (limit: ${MAX_FILE_BYTES.toLocaleString()} bytes). Consider splitting into smaller files.`,
    };
  }

  const sizeErr = validateContentSize(file_content, file_path);
  if (sizeErr) {
    return { success: false, message: sizeErr };
  }

  const existing = await findSkill(name, context);
  if (!existing) {
    return {
      success: false,
      message: `Skill '${name}' not found. Create it first with action='create'.`,
    };
  }

  const targetPath = join(existing, file_path.replace(/\\/g, '/'));
  const targetDir = targetPath.slice(0, targetPath.lastIndexOf('/'));
  if (targetDir && !existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  await writeFile(targetPath, file_content, 'utf8');

  return {
    success: true,
    message: `File '${file_path}' written to skill '${name}'.`,
    path: targetPath,
  };
};

const handleRefresh = async (_input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  const skills = await listSkills(context);

  return {
    success: true,
    message: `Skill index refreshed. ${skills.length} skill(s) found.`,
  };
};

export const createSaveSkillTool = (): ToolDefinition<typeof inputSchema> => ({
  name: 'save-skill',
  description:
    'Create, edit, or write files to AiderDesk skills. Skills are reusable procedural knowledge stored as SKILL.md files with optional supporting files (references/, templates/, scripts/, assets/). Use action="create" to create a new skill, action="edit" to rewrite SKILL.md, action="write_file" to add supporting files, or action="refresh" to list all skills and refresh the index.',
  inputSchema,
  execute: async (input, _signal, context) => {
    const typedInput = input as SaveSkillInput;
    try {
      let result: SkillResult;

      switch (typedInput.action) {
        case 'create':
          result = await handleCreate(typedInput, context);
          break;
        case 'edit':
          result = await handleEdit(typedInput, context);
          break;
        case 'write_file':
          result = await handleWriteFile(typedInput, context);
          break;
        case 'refresh':
          result = await handleRefresh(typedInput, context);
          break;
        default:
          result = { success: false as const, message: `Unknown action: ${typedInput.action}` };
      }

      if (typedInput.action !== 'refresh') {
        context.triggerUIDataRefresh();
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, message: `Error: ${errorMsg}` }, null, 2);
    }
  },
});
