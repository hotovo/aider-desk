import { loadFront } from 'yaml-front-matter';

export const SKILLS_DIR_NAME = 'skills';
export const SKILL_MARKDOWN_FILE = 'SKILL.md';

export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_CONTENT_CHARS = 100_000;
export const MAX_FILE_BYTES = 1_048_576;

const VALID_NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
const ALLOWED_SUBDIRS = new Set(['references', 'templates', 'scripts', 'assets']);

// The skill index renders only the first ~60 characters of the description in every
// session's system prompt, so anything longer is silently truncated and breaks routing.
export const MAX_ROUTABLE_DESCRIPTION_CHARS = 60;

const validateSkillName = (name: string): string | null => {
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

const parseFrontMatterBlock = (content: string): { front: Record<string, unknown>; body: string } | string => {
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
  const body = cleaned.slice(frontmatterEnd).trim();

  let parsed: unknown;
  try {
    parsed = loadFront(frontmatterBlock) as Record<string, unknown>;
  } catch {
    return 'YAML frontmatter parse error.';
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return 'Frontmatter must be a YAML mapping (key: value pairs).';
  }

  return { front: parsed as Record<string, unknown>, body };
};

const validateSkillFrontmatter = (content: string): string | null => {
  if (!content.trim()) {
    return 'Content cannot be empty.';
  }

  const parsedBlock = parseFrontMatterBlock(content);
  if (typeof parsedBlock === 'string') {
    return parsedBlock;
  }
  const { front, body } = parsedBlock;

  if (!('name' in front)) {
    return "Frontmatter must include 'name' field.";
  }
  if (!('description' in front)) {
    return "Frontmatter must include 'description' field.";
  }

  if (typeof front.description !== 'string') {
    return "Frontmatter 'description' must be a string.";
  }
  const desc = front.description;
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    return `Description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  if (desc.trim().length > MAX_ROUTABLE_DESCRIPTION_CHARS) {
    return (
      `Description is ${desc.trim().length} chars — skills must keep the ` +
      `description <=${MAX_ROUTABLE_DESCRIPTION_CHARS} chars (the skill index truncates it, destroying ` +
      'the routing signal). Move detail into the skill body.'
    );
  }

  if (!body) {
    return 'SKILL.md must have content after the frontmatter.';
  }

  return null;
};

const validateSkillNameMatch = (name: string, content: string): string | null => {
  const parsedBlock = parseFrontMatterBlock(content);
  if (typeof parsedBlock === 'string') {
    return parsedBlock;
  }

  const frontName = typeof parsedBlock.front.name === 'string' ? parsedBlock.front.name : undefined;
  if (frontName !== name) {
    return `Frontmatter name '${frontName}' does not match skill name '${name}'. The directory is keyed by the skill name, so they must be identical for the skill to be discoverable.`;
  }

  return null;
};

const validateSkillContentSize = (content: string, label = 'SKILL.md'): string | null => {
  if (content.length > MAX_CONTENT_CHARS) {
    return (
      `${label} content is ${content.length.toLocaleString()} characters ` +
      `(limit: ${MAX_CONTENT_CHARS.toLocaleString()}). Consider splitting ` +
      'into a smaller SKILL.md with supporting files in references/ or templates/.'
    );
  }
  return null;
};

const validateSkillFilePath = (filePath: string): string | null => {
  if (!filePath) {
    return 'file_path is required.';
  }

  if (filePath.includes('..')) {
    return "Path traversal ('..') is not allowed.";
  }

  const normalized = filePath.replace(/\\/g, '/');

  if (normalized === SKILL_MARKDOWN_FILE || normalized.endsWith(`/${SKILL_MARKDOWN_FILE}`)) {
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

export { validateSkillName, validateSkillFrontmatter, validateSkillNameMatch, validateSkillContentSize, validateSkillFilePath };
