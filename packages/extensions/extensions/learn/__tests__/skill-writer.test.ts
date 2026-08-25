import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSaveSkillTool, validateName, validateFrontmatter, validateFilePath } from '../skill-writer';

const makeValidFrontmatter = (name: string, description = 'Does something useful.'): string => `---
name: ${name}
description: ${description}
---

# ${name}

## When to Use

- When you need to do X
`;

const temporaryDirectories: string[] = [];

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'aiderdesk-learn-'));
  temporaryDirectories.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const createMockContext = (projectDir: string) => ({
  getProjectDir: vi.fn(() => projectDir),
  triggerUIDataRefresh: vi.fn(),
  log: vi.fn(),
});

describe('validateName', () => {
  it('accepts valid kebab-case names', () => {
    expect(validateName('my-skill')).toBeNull();
    expect(validateName('deploy-helper')).toBeNull();
    expect(validateName('a.b.c')).toBeNull();
    expect(validateName('skill_123')).toBeNull();
  });

  it('rejects empty name', () => {
    expect(validateName('')).toContain('required');
  });

  it('rejects uppercase names', () => {
    expect(validateName('MySkill')).toContain('Invalid');
  });

  it('rejects names starting with hyphen', () => {
    expect(validateName('-skill')).toContain('Invalid');
  });

  it('rejects names with spaces', () => {
    expect(validateName('my skill')).toContain('Invalid');
  });

  it('rejects names exceeding 64 characters', () => {
    expect(validateName('a'.repeat(65))).toContain('exceeds');
  });
});

describe('validateFrontmatter', () => {
  it('accepts valid frontmatter with name and description', () => {
    expect(validateFrontmatter(makeValidFrontmatter('my-skill'))).toBeNull();
  });

  it('rejects empty content', () => {
    expect(validateFrontmatter('')).toContain('empty');
  });

  it('rejects content without frontmatter delimiters', () => {
    expect(validateFrontmatter('Just some text')).toContain('frontmatter');
  });

  it('rejects unclosed frontmatter', () => {
    expect(validateFrontmatter('---\nname: test\nNo closing delimiter')).toContain('not closed');
  });

  it('rejects frontmatter without name field', () => {
    const content = `---
description: A skill without a name.
---

# Body
`;
    expect(validateFrontmatter(content)).toContain('name');
  });

  it('rejects frontmatter without description field', () => {
    const content = `---
name: test
---

# Body
`;
    expect(validateFrontmatter(content)).toContain('description');
  });

  it('rejects empty body after frontmatter', () => {
    const content = `---
name: test
description: Does things.
---
`;
    expect(validateFrontmatter(content)).toContain('content');
  });

  it('rejects description longer than 60 chars', () => {
    const longDesc = 'A comprehensive skill that does many complex things for users.';
    const content = `---
name: test
description: ${longDesc}
---

# Body
`;
    const result = validateFrontmatter(content);
    expect(result).toContain('60 chars');
  });

  it('trims whitespace when checking description length', () => {
    const content = `---
name: test
description:    ${'x'.repeat(60)}   
---

# Body
`;
    const result = validateFrontmatter(content);
    expect(result).toBeNull();
  });

  it('accepts description exactly 60 chars', () => {
    const exactDesc = 'x'.repeat(60);
    const content = `---
name: test
description: ${exactDesc}
---

# Body
`;
    expect(validateFrontmatter(content)).toBeNull();
  });
});

describe('validateFilePath', () => {
  it('accepts files under references/', () => {
    expect(validateFilePath('references/api.md')).toBeNull();
  });

  it('accepts files under templates/', () => {
    expect(validateFilePath('templates/deploy.sh')).toBeNull();
  });

  it('accepts files under scripts/', () => {
    expect(validateFilePath('scripts/build.sh')).toBeNull();
  });

  it('accepts files under assets/', () => {
    expect(validateFilePath('assets/logo.png')).toBeNull();
  });

  it('rejects path traversal', () => {
    expect(validateFilePath('../../etc/passwd')).toContain('traversal');
  });

  it('rejects files outside allowed directories', () => {
    expect(validateFilePath('random/file.md')).toContain('must be under');
  });

  it('rejects empty path', () => {
    expect(validateFilePath('')).toContain('required');
  });

  it('accepts SKILL.md', () => {
    expect(validateFilePath('SKILL.md')).toBeNull();
  });

  it('rejects bare directory name', () => {
    expect(validateFilePath('references')).toContain('file path');
  });
});

describe('save-skill tool', () => {
  it('creates the tool with correct name and description', () => {
    const tool = createSaveSkillTool();
    expect(tool.name).toBe('save-skill');
    expect(tool.description).toContain('skills');
  });

  it('returns error for unknown action', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    const tool = createSaveSkillTool();

    const result = await tool.execute({ action: 'unknown' as never, location: 'global' }, undefined, context as never, {});
    const parsed = JSON.parse(result as string);
    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('Unknown action');
  });

  it('creates a skill with valid frontmatter', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    const result = await tool.execute(
      { action: 'create', name: 'test-skill', content: makeValidFrontmatter('test-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain('created');

    const skillMd = await readFile(parsed.skill_md, 'utf8');
    expect(skillMd).toContain('name: test-skill');
    expect(skillMd).toContain('# test-skill');

    vi.unstubAllEnvs();
  });

  it('fails to create a skill that already exists', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    await tool.execute(
      { action: 'create', name: 'dup-skill', content: makeValidFrontmatter('dup-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const result = await tool.execute(
      { action: 'create', name: 'dup-skill', content: makeValidFrontmatter('dup-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('already exists');

    vi.unstubAllEnvs();
  });

  it('fails to create a skill with invalid frontmatter', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    const result = await tool.execute(
      { action: 'create', name: 'bad-skill', content: 'no frontmatter here', location: 'global' },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('frontmatter');

    vi.unstubAllEnvs();
  });

  it('writes a supporting file to an existing skill', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    await tool.execute(
      { action: 'create', name: 'file-skill', content: makeValidFrontmatter('file-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const result = await tool.execute(
      {
        action: 'write_file',
        name: 'file-skill',
        file_path: 'references/api.md',
        file_content: '# API Reference\n\n- endpoint: /api/v1',
        location: 'global',
      },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(true);
    expect(parsed.path).toContain('references/api.md');

    const content = await readFile(parsed.path, 'utf8');
    expect(content).toContain('API Reference');

    vi.unstubAllEnvs();
  });

  it('rejects write_file for non-existent skill', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    const result = await tool.execute(
      {
        action: 'write_file',
        name: 'no-exist',
        file_path: 'references/test.md',
        file_content: 'content',
        location: 'global',
      },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('not found');

    vi.unstubAllEnvs();
  });

  it('rejects write_file with path traversal', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    await tool.execute(
      { action: 'create', name: 'trav-skill', content: makeValidFrontmatter('trav-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const result = await tool.execute(
      {
        action: 'write_file',
        name: 'trav-skill',
        file_path: '../../../etc/passwd',
        file_content: 'malicious',
        location: 'global',
      },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(false);
    expect(parsed.message).toContain('traversal');

    vi.unstubAllEnvs();
  });

  it('edits an existing skill', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    await tool.execute(
      { action: 'create', name: 'edit-skill', content: makeValidFrontmatter('edit-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );

    const editedContent = `---
name: edit-skill
description: Updated description here.
---

# Updated Title

## When to Use

- When you need updated things
`;
    const result = await tool.execute({ action: 'edit', name: 'edit-skill', content: editedContent, location: 'global' }, undefined, context as never, {});
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain('updated');

    const skillMd = await readFile(parsed.skill_md, 'utf8');
    expect(skillMd).toContain('Updated description');
    expect(skillMd).toContain('Updated Title');

    vi.unstubAllEnvs();
  });

  it('lists skills on refresh', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);
    vi.stubEnv('AIDER_DESK_HOME_DIR', tempDir);

    const tool = createSaveSkillTool();
    await tool.execute(
      { action: 'create', name: 'list-skill', content: makeValidFrontmatter('list-skill'), location: 'global' },
      undefined,
      context as never,
      {},
    );
    const result = await tool.execute({ action: 'refresh', location: 'global' }, undefined, context as never, {});
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(true);
    expect(parsed.message).toContain('skill');
    expect(parsed.message).toContain('found');

    vi.unstubAllEnvs();
  });

  it('creates project-scoped skill', async () => {
    const tempDir = await createTempDir();
    const context = createMockContext(tempDir);

    const tool = createSaveSkillTool();
    const result = await tool.execute(
      { action: 'create', name: 'proj-skill', content: makeValidFrontmatter('proj-skill'), location: 'project' },
      undefined,
      context as never,
      {},
    );
    const parsed = JSON.parse(result as string);

    expect(parsed.success).toBe(true);
    expect(parsed.path).toContain(tempDir);
    expect(parsed.path).toContain('.aider-desk');
    expect(parsed.path).toContain('skills');

    const skillMd = await readFile(parsed.skill_md, 'utf8');
    expect(skillMd).toContain('name: proj-skill');
  });
});
