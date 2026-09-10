import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The global test setup mocks fs/path; these tests exercise real file I/O
vi.unmock('fs');
vi.unmock('path');
vi.unmock('winston');

import type { SkillDefinition } from '@common/types';

const temporaryDirectories: string[] = [];

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
};

const makeValidSkill = (name: string, description = 'Does something useful.'): string => `---
name: ${name}
description: ${description}
---

# ${name}

## When to Use

- When you need to do X
`;

describe('SkillManager', () => {
  let globalDir: string;
  let projectDir: string;
  let SkillManager: (typeof import('../skill-manager'))['SkillManager'];
  let skillValidation: typeof import('../skill-validation');
  let skillsUpdated: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    globalDir = await createTempDir('aiderdesk-skills-global-');
    projectDir = await createTempDir('aiderdesk-skills-project-');
    vi.stubEnv('AIDER_DESK_HOME_DIR', globalDir);

    skillValidation = await import('../skill-validation');
    ({ SkillManager } = await import('../skill-manager'));
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  const createManager = (onSkillsUpdated?: () => void) => new SkillManager(projectDir, undefined, onSkillsUpdated);

  beforeEach(() => {
    skillsUpdated = vi.fn();
  });

  describe('validateSkillName', () => {
    it('accepts valid kebab-case names', () => {
      expect(skillValidation.validateSkillName('my-skill')).toBeNull();
      expect(skillValidation.validateSkillName('deploy-helper')).toBeNull();
      expect(skillValidation.validateSkillName('a.b.c')).toBeNull();
      expect(skillValidation.validateSkillName('skill_123')).toBeNull();
    });

    it('rejects empty name', () => {
      expect(skillValidation.validateSkillName('')).toContain('required');
    });

    it('rejects uppercase names', () => {
      expect(skillValidation.validateSkillName('MySkill')).toContain('Invalid');
    });

    it('rejects names starting with hyphen', () => {
      expect(skillValidation.validateSkillName('-skill')).toContain('Invalid');
    });

    it('rejects names with spaces', () => {
      expect(skillValidation.validateSkillName('my skill')).toContain('Invalid');
    });

    it('rejects names exceeding 64 characters', () => {
      expect(skillValidation.validateSkillName('a'.repeat(65))).toContain('exceeds');
    });
  });

  describe('validateSkillFrontmatter', () => {
    it('accepts valid frontmatter with name and description', () => {
      expect(skillValidation.validateSkillFrontmatter(makeValidSkill('my-skill'))).toBeNull();
    });

    it('rejects empty content', () => {
      expect(skillValidation.validateSkillFrontmatter('')).toContain('empty');
    });

    it('rejects content without frontmatter delimiters', () => {
      expect(skillValidation.validateSkillFrontmatter('Just some text')).toContain('frontmatter');
    });

    it('rejects unclosed frontmatter', () => {
      expect(skillValidation.validateSkillFrontmatter('---\nname: test\nNo closing delimiter')).toContain('not closed');
    });

    it('rejects frontmatter without name field', () => {
      const content = `---
description: A skill without a name.
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toContain('name');
    });

    it('rejects frontmatter without description field', () => {
      const content = `---
name: test
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toContain('description');
    });

    it('rejects empty body after frontmatter', () => {
      const content = `---
name: test
description: Does things.
---
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toContain('content');
    });

    it('rejects non-string description values', () => {
      const content = `---
name: test
description: 12345
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toContain('must be a string');
    });

    it('rejects description longer than 60 chars', () => {
      const longDesc = 'A comprehensive skill that does many complex things for users.';
      const content = `---
name: test
description: ${longDesc}
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toContain('60 chars');
    });

    it('trims whitespace when checking description length', () => {
      const content = `---
name: test
description:    ${'x'.repeat(60)}   
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toBeNull();
    });

    it('accepts description exactly 60 chars', () => {
      const content = `---
name: test
description: ${'x'.repeat(60)}
---

# Body
`;
      expect(skillValidation.validateSkillFrontmatter(content)).toBeNull();
    });
  });

  describe('validateSkillFilePath', () => {
    it('accepts files under references/', () => {
      expect(skillValidation.validateSkillFilePath('references/api.md')).toBeNull();
    });

    it('accepts files under templates/', () => {
      expect(skillValidation.validateSkillFilePath('templates/deploy.sh')).toBeNull();
    });

    it('accepts files under scripts/', () => {
      expect(skillValidation.validateSkillFilePath('scripts/build.sh')).toBeNull();
    });

    it('accepts files under assets/', () => {
      expect(skillValidation.validateSkillFilePath('assets/logo.png')).toBeNull();
    });

    it('rejects path traversal', () => {
      expect(skillValidation.validateSkillFilePath('../../etc/passwd')).toContain('traversal');
    });

    it('rejects files outside allowed directories', () => {
      expect(skillValidation.validateSkillFilePath('random/file.md')).toContain('must be under');
    });

    it('rejects empty path', () => {
      expect(skillValidation.validateSkillFilePath('')).toContain('required');
    });

    it('accepts SKILL.md', () => {
      expect(skillValidation.validateSkillFilePath('SKILL.md')).toBeNull();
    });

    it('rejects bare directory name', () => {
      expect(skillValidation.validateSkillFilePath('references')).toContain('file path');
    });
  });

  describe('resolveSkillDir', () => {
    it('resolves global skills under the home directory', () => {
      const manager = createManager();
      expect(manager.resolveSkillDir('my-skill', 'global')).toBe(join(globalDir, 'skills', 'my-skill'));
    });

    it('resolves project skills under .aider-desk/skills in the project dir', () => {
      const manager = createManager();
      expect(manager.resolveSkillDir('my-skill', 'project')).toBe(join(projectDir, '.aider-desk', 'skills', 'my-skill'));
    });
  });

  describe('createSkill', () => {
    it('creates a global skill by default and writes SKILL.md', async () => {
      const manager = createManager(skillsUpdated as unknown as () => void);
      const result = await manager.createSkill('create-global', makeValidSkill('create-global'));

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(globalDir, 'skills', 'create-global'));
      const written = await readFile(join(result.path!, 'SKILL.md'), 'utf8');
      expect(written).toBe(makeValidSkill('create-global'));
      expect(skillsUpdated).toHaveBeenCalledTimes(1);
    });

    it('creates a project skill under .aider-desk/skills when location is project', async () => {
      const manager = createManager();
      const result = await manager.createSkill('create-project', makeValidSkill('create-project'), 'project');

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(projectDir, '.aider-desk', 'skills', 'create-project'));
      expect(existsSync(join(result.path!, 'SKILL.md'))).toBe(true);
    });

    it('creates missing parent directories for the skill', async () => {
      const manager = createManager();
      const result = await manager.createSkill('nested-dirs-skill', makeValidSkill('nested-dirs-skill'), 'project');
      expect(result.success).toBe(true);
      expect(existsSync(join(projectDir, '.aider-desk', 'skills', 'nested-dirs-skill', 'SKILL.md'))).toBe(true);
    });

    it('rejects duplicate skills in the same location', async () => {
      const manager = createManager();
      await manager.createSkill('duplicate-global', makeValidSkill('duplicate-global'), 'global');

      const result = await manager.createSkill('duplicate-global', makeValidSkill('duplicate-global'), 'global');
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.message).toContain('updateSkill');
    });

    it('allows a project skill to shadow a global skill with the same name', async () => {
      const manager = createManager();
      await manager.createSkill('project-shadows-global', makeValidSkill('project-shadows-global'), 'global');

      const result = await manager.createSkill('project-shadows-global', makeValidSkill('project-shadows-global'), 'project');
      expect(result.success).toBe(true);
      expect(result.path).toBe(join(projectDir, '.aider-desk', 'skills', 'project-shadows-global'));
    });

    it('rejects invalid names', async () => {
      const manager = createManager();
      const result = await manager.createSkill('Invalid Name', makeValidSkill('invalid-name'));
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid skill name');
    });

    it('rejects content without valid frontmatter', async () => {
      const manager = createManager();
      const result = await manager.createSkill('no-frontmatter', 'just text, no frontmatter');
      expect(result.success).toBe(false);
      expect(result.message).toContain('frontmatter');
      expect(existsSync(join(globalDir, 'skills', 'no-frontmatter'))).toBe(false);
    });

    it('rejects empty content', async () => {
      const manager = createManager();
      const result = await manager.createSkill('empty-content', '');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Content is required');
    });

    it('rejects content whose frontmatter name differs from the skill name', async () => {
      const manager = createManager();
      const result = await manager.createSkill('foo', makeValidSkill('bar'));

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not match skill name 'foo'");
      expect(existsSync(join(globalDir, 'skills', 'foo'))).toBe(false);
    });

    it('accepts content whose frontmatter name matches', async () => {
      const manager = createManager();
      const result = await manager.createSkill('matching-name', makeValidSkill('matching-name'));
      expect(result.success).toBe(true);
    });

    it('rejects oversized SKILL.md content', async () => {
      const manager = createManager();
      const oversizedBody = 'x'.repeat(100_001);
      const content = `---
name: oversized
description: A very big skill.
---

${oversizedBody}
`;
      const result = await manager.createSkill('oversized', content);
      expect(result.success).toBe(false);
      expect(result.message).toContain('characters');
      expect(result.message).toContain('references/');
    });
  });

  describe('updateSkill', () => {
    it('rewrites the SKILL.md of an existing global skill', async () => {
      const manager = createManager(skillsUpdated as unknown as () => void);
      await manager.createSkill('update-me', makeValidSkill('update-me'));

      const updated = makeValidSkill('update-me', 'Updated description.');
      const result = await manager.updateSkill('update-me', updated);

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(globalDir, 'skills', 'update-me'));
      expect(await readFile(join(result.path!, 'SKILL.md'), 'utf8')).toBe(updated);
      expect(skillsUpdated).toHaveBeenCalledTimes(2);
    });

    it('updates the project skill when it shadows a global skill of the same name', async () => {
      const manager = createManager();
      await manager.createSkill('shadowed-update', makeValidSkill('shadowed-update'), 'global');
      await manager.createSkill('shadowed-update', makeValidSkill('shadowed-update'), 'project');

      const updated = makeValidSkill('shadowed-update', 'Project wins.');
      const result = await manager.updateSkill('shadowed-update', updated);

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(projectDir, '.aider-desk', 'skills', 'shadowed-update'));
      expect(await readFile(join(projectDir, '.aider-desk', 'skills', 'shadowed-update', 'SKILL.md'), 'utf8')).toBe(updated);
    });

    it('rejects updates to skills that do not exist', async () => {
      const manager = createManager();
      const result = await manager.updateSkill('does-not-exist', makeValidSkill('does-not-exist'));
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it.each(['../../outside/SKILL.md', 'sub/dir/escape', 'back\\slash', '..', '.'])(
      'rejects skill names that escape the skills directories: %s',
      async (badName) => {
        const manager = createManager();
        await manager.createSkill('innocent', makeValidSkill('innocent'));

        const result = await manager.updateSkill(badName, makeValidSkill(badName));
        expect(result.success).toBe(false);
        expect(result.message).toContain('not found');
        expect(existsSync(join(globalDir, 'skills', 'innocent', 'SKILL.md'))).toBe(true);
      },
    );

    it('validates content before updating', async () => {
      const manager = createManager();
      await manager.createSkill('update-validate', makeValidSkill('update-validate'));

      const result = await manager.updateSkill('update-validate', 'invalid');
      expect(result.success).toBe(false);
      expect(result.message).toContain('frontmatter');
      expect(await readFile(join(globalDir, 'skills', 'update-validate', 'SKILL.md'), 'utf8')).toBe(makeValidSkill('update-validate'));
    });

    it('rejects updates whose frontmatter name does not match the skill name', async () => {
      const manager = createManager();
      await manager.createSkill('update-name-match', makeValidSkill('update-name-match'));

      const result = await manager.updateSkill('update-name-match', makeValidSkill('something-else'));

      expect(result.success).toBe(false);
      expect(result.message).toContain("does not match skill name 'update-name-match'");
      expect(await readFile(join(globalDir, 'skills', 'update-name-match', 'SKILL.md'), 'utf8')).toBe(makeValidSkill('update-name-match'));
    });
  });

  describe('writeSkillFile', () => {
    it('writes a supporting file and creates intermediate directories', async () => {
      const manager = createManager();
      await manager.createSkill('with-support', makeValidSkill('with-support'), 'project');

      const result = await manager.writeSkillFile('with-support', 'references/api.md', '# API');
      expect(result.success).toBe(true);
      const target = join(projectDir, '.aider-desk', 'skills', 'with-support', 'references', 'api.md');
      expect(result.path).toBe(target);
      expect(await readFile(target, 'utf8')).toBe('# API');
    });

    it('allows overwriting SKILL.md via writeSkillFile', async () => {
      const manager = createManager();
      await manager.createSkill('overwrite-smd', makeValidSkill('overwrite-smd'));

      const result = await manager.writeSkillFile('overwrite-smd', 'SKILL.md', makeValidSkill('overwrite-smd', 'Rewritten.'));
      expect(result.success).toBe(true);
      expect(await readFile(join(globalDir, 'skills', 'overwrite-smd', 'SKILL.md'), 'utf8')).toContain('Rewritten.');
    });

    it('rejects path traversal', async () => {
      const manager = createManager();
      await manager.createSkill('traversal-target', makeValidSkill('traversal-target'));

      const result = await manager.writeSkillFile('traversal-target', '../../etc/passwd', 'nsa');
      expect(result.success).toBe(false);
      expect(result.message).toContain('traversal');
    });

    it('rejects files outside allowed directories', async () => {
      const manager = createManager();
      await manager.createSkill('disallowed-dir', makeValidSkill('disallowed-dir'));

      const result = await manager.writeSkillFile('disallowed-dir', 'random/file.md', 'content');
      expect(result.success).toBe(false);
      expect(result.message).toContain('must be under');
    });

    it('rejects writing when the skill does not exist', async () => {
      const manager = createManager();
      const result = await manager.writeSkillFile('missing-skill', 'references/api.md', 'content');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('rejects writing when the skill name escapes the skills directories', async () => {
      const manager = createManager();
      await manager.createSkill('still-innocent', makeValidSkill('still-innocent'));

      const result = await manager.writeSkillFile('../../other-suite', 'SKILL.md', makeValidSkill('other'));
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(existsSync(join(globalDir, 'other-suite'))).toBe(false);
      expect(existsSync(join(globalDir, 'skills', 'other-suite'))).toBe(false);
    });

    it('rejects oversized file content', async () => {
      const manager = createManager();
      await manager.createSkill('too-big-file', makeValidSkill('too-big-file'));

      const result = await manager.writeSkillFile('too-big-file', 'references/big.md', 'x'.repeat(1_048_577));
      expect(result.success).toBe(false);
      expect(result.message).toContain('bytes');
      expect(existsSync(join(globalDir, 'skills', 'too-big-file', 'references', 'big.md'))).toBe(false);
    });
  });

  describe('createSkill atomicity', () => {
    it('lets only one of two concurrent same-name creates succeed', async () => {
      const manager = createManager();

      const results = await Promise.all([
        manager.createSkill('raced-create', makeValidSkill('raced-create'), 'global'),
        manager.createSkill('raced-create', makeValidSkill('raced-create'), 'global'),
      ]);

      expect(results.filter((r) => r.success)).toHaveLength(1);
      const failure = results.find((r) => !r.success)!;
      expect(failure.message).toContain('already exists');
      expect(failure.path).toBeUndefined();
    });
  });

  describe('findSkill', () => {
    it('prefers project skills over global skills with the same name', async () => {
      const manager = createManager();
      await manager.createSkill('precedence', makeValidSkill('precedence'), 'global');
      await manager.createSkill('precedence', makeValidSkill('precedence'), 'project');

      const found = await manager.findSkill('precedence');
      expect(found?.location).toBe('project');
      expect(found?.dirPath).toBe(join(projectDir, '.aider-desk', 'skills', 'precedence'));
    });

    it('falls back to global skills', async () => {
      const manager = createManager();
      await manager.createSkill('only-global', makeValidSkill('only-global'), 'global');

      const found = await manager.findSkill('only-global');
      expect(found?.location).toBe('global');
    });

    it('returns null for missing skills', async () => {
      const found = await createManager().findSkill('nope-not-here');
      expect(found).toBeNull();
    });
  });

  describe('loadAllSkills extension wiring', () => {
    it('exposes this manager to extensions via the task stub', async () => {
      let exposedContext: unknown;
      const extensionManagerStub = {
        getSkills: (_project: unknown, task: { getSkillManager?: () => unknown; getTaskDir?: () => string }) => {
          expect(task.getSkillManager?.()).toBe(manager);
          expect(task.getTaskDir?.()).toBe(projectDir);
          exposedContext = task;
          return [];
        },
      };

      const manager = new SkillManager(projectDir, extensionManagerStub as never);

      // The stub must collapse the promise-chain call order: getSkills is sync inside loadAllSkills
      await manager.loadAllSkills();
      expect(exposedContext).toBeDefined();
    });
  });

  describe('loadAllSkills re-entrancy guard', () => {
    it('does not recurse when an extension hook lists skills back on this manager', async () => {
      const extensionManagerStub = {
        getSkills: (_project: unknown, task: { getSkillManager?: () => { listSkills: () => Promise<unknown> } }) => {
          // Synchronously list skills from within extension discovery, as an extension hook could
          void task.getSkillManager?.().listSkills();
          return [];
        },
      };

      const manager = new SkillManager(projectDir, extensionManagerStub as never);
      await expect(manager.listSkills()).resolves.toBeInstanceOf(Array);
    });

    it('does not re-run extension discovery for an async re-entrant call during the load await gap', async () => {
      let outerCompleted = false;

      const extensionManagerStub = {
        getSkills: (_project: unknown, task: { getSkillManager?: () => { listSkills: () => Promise<unknown> } }) => {
          // Schedule the re-entrant call with an async gap so it lands inside the outer await,
          // after a sync-only guard would already have been reset
          void (async () => {
            await Promise.resolve();
            await task.getSkillManager?.().listSkills();
            outerCompleted = true;
          })();
          return [];
        },
      };

      const manager = new SkillManager(projectDir, extensionManagerStub as never);
      await expect(manager.listSkills()).resolves.toBeInstanceOf(Array);
      // If the guard failed, the detached re-entrant load would recurse forever and never set the flag
      await vi.waitFor(() => expect(outerCompleted).toBe(true));
    });
  });

  describe('listSkills', () => {
    it('includes project and global skills and dedupes by name with project precedence', async () => {
      const manager = createManager();
      await manager.createSkill('list-shared', makeValidSkill('list-shared'), 'global');
      await manager.createSkill('list-project-only', makeValidSkill('list-project-only'), 'project');
      await manager.createSkill('list-shared', makeValidSkill('list-shared'), 'project');

      const skills = await manager.listSkills();
      const names = skills.map((s) => s.name);
      const shared = skills.find((s) => s.name === 'list-shared');

      expect(names).toContain('list-project-only');
      expect(shared?.location).toBe('project');
      expect(names.filter((n) => n === 'list-shared')).toHaveLength(1);
    });

    it('returns the same skills as loadAllSkills', async () => {
      const manager = createManager();
      const list = await manager.listSkills();
      const all = await manager.loadAllSkills();
      expect(list).toEqual(all);
    });
  });

  describe('skill written through SkillManager is visible to getSkills', () => {
    it('shows up via getSkills without additional events', async () => {
      const manager = createManager();
      await manager.createSkill('visible-after-write', makeValidSkill('visible-after-write'), 'project');

      const skills = await manager.getSkills();
      expect(skills.some((s: SkillDefinition) => s.name === 'visible-after-write')).toBe(true);
    });
  });
});
