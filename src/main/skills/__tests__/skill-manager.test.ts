/**
 * Tests for SkillManager, particularly SKILL.md frontmatter parsing of
 * disable-model-invocation and user-invocable fields
 */

import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

vi.mock('@/constants', () => ({
  AIDER_DESK_HOME_DIR: '/home/.aider-desk',
  AIDER_DESK_DIR: '.aider-desk',
  AIDER_DESK_BUILTIN_SKILLS_DIR: '/builtin-skills',
}));

vi.mock('@/extensions/extension-manager', () => ({
  ExtensionManager: class {
    getSkills() {
      return [];
    }
  },
}));

type MockEntry = { type: 'dir' } | { type: 'file'; content: string };

const files = new Map<string, MockEntry>();

const addSkill = (dirPath: string, frontmatter: string) => {
  files.set(dirPath, { type: 'dir' });
  files.set(path.join(dirPath, 'SKILL.md'), {
    type: 'file',
    content: `---\n${frontmatter}\n---\n\nSkill instructions\n`,
  });
};

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(async (dirPath: string) => {
      const names = new Set<string>();
      for (const filePath of files.keys()) {
        if (path.dirname(filePath) === dirPath) {
          names.add(path.basename(filePath));
        }
      }
      if (names.size === 0 && !files.has(dirPath)) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return [...names];
    }),
    stat: vi.fn(async (filePath: string) => {
      const entry = files.get(filePath);
      if (!entry) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return {
        isDirectory: () => entry.type === 'dir',
        isFile: () => entry.type === 'file',
      };
    }),
    readFile: vi.fn(async (filePath: string) => {
      const entry = files.get(filePath);
      if (!entry || entry.type !== 'file') {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return entry.content;
    }),
  },
}));

import { SkillManager } from '../skill-manager';

describe('SkillManager', () => {
  let skillManager: SkillManager;

  beforeEach(() => {
    vi.clearAllMocks();
    files.clear();
    skillManager = new SkillManager('/project/dir');
  });

  const loadGlobalSkills = async () => {
    const skills = await skillManager.loadAllSkills();
    return skills.filter((skill) => skill.location === 'global');
  };

  describe('frontmatter parsing', () => {
    it('defaults disableModelInvocation to false and userInvocable to true', async () => {
      addSkill('/home/.aider-desk/skills/basic', 'name: basic\ndescription: A basic skill');

      const skills = await loadGlobalSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].disableModelInvocation).toBe(false);
      expect(skills[0].userInvocable).toBe(true);
    });

    it('parses boolean frontmatter values', async () => {
      addSkill('/home/.aider-desk/skills/manual', 'name: manual\ndescription: Manual only skill\ndisable-model-invocation: true');
      addSkill('/home/.aider-desk/skills/agent-only', 'name: agent-only\ndescription: Agent only skill\nuser-invocable: false');

      const skills = await loadGlobalSkills();
      const byName = new Map(skills.map((skill) => [skill.name, skill]));

      expect(byName.get('manual')?.disableModelInvocation).toBe(true);
      expect(byName.get('agent-only')?.userInvocable).toBe(false);
    });

    it.each([
      ['true', true],
      ['True', true],
      ['yes', true],
      ['on', true],
      ['1', true],
      ['false', false],
      ['FALSE', false],
      ['no', false],
      ['off', false],
      ['0', false],
    ])('coerces disable-model-invocation: %s to %s', async (value, expected) => {
      addSkill('/home/.aider-desk/skills/coerced', `name: coerced\ndescription: Coercion skill\ndisable-model-invocation: ${value}`);

      const skills = await loadGlobalSkills();

      expect(skills[0].disableModelInvocation).toBe(expected);
    });

    it.each([['invalid'], [''], ['2']])('falls back to default for invalid user-invocable: "%s"', async (value) => {
      addSkill('/home/.aider-desk/skills/invalid', `name: invalid\ndescription: Invalid value skill\nuser-invocable: ${value}`);

      const skills = await loadGlobalSkills();

      expect(skills[0].userInvocable).toBe(true);
    });

    it('skips skills without name or description', async () => {
      addSkill('/home/.aider-desk/skills/no-name', 'description: Missing name');
      addSkill('/home/.aider-desk/skills/no-description', 'name: no-description');
      addSkill('/home/.aider-desk/skills/valid', 'name: valid\ndescription: Valid skill');

      const skills = await loadGlobalSkills();

      expect(skills.map((skill) => skill.name)).toEqual(['valid']);
    });
  });
});
