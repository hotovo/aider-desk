import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSaveSkillTool } from '../skill-writer';

import type { SkillsContext } from '@aiderdesk/extensions';

const makeValidSkill = (name: string): string => `---
name: ${name}
description: Does something useful.
---

# ${name}
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

describe('save-skill tool', () => {
  let mockSkillsContext: SkillsContext;
  let projectDir: string;

  const createContext = () => {
    return {
      getProjectDir: vi.fn(() => projectDir),
      getSkillContext: vi.fn(() => mockSkillsContext),
      log: vi.fn(),
    };
  };

  type ToolContext = ReturnType<typeof createContext>;

  const callTool = async (context: ToolContext, input: { action: string } & Record<string, unknown>) => {
    const tool = createSaveSkillTool();
    return JSON.parse(((await tool.execute(input as never, undefined, context as never, {})) ?? '') as string) as {
      success: boolean;
      message: string;
      path?: string;
    };
  };

  beforeEach(async () => {
    projectDir = await createTempDir();
    mockSkillsContext = {
      listSkills: vi.fn(async () => []),
      findSkill: vi.fn(async () => null),
      resolveSkillDir: vi.fn(() => join(projectDir, '.aider-desk', 'skills', 'test-skill')),
      createSkill: vi.fn(async () => ({ success: true, message: 'Skill created.' })),
      updateSkill: vi.fn(async () => ({ success: true, message: 'Skill updated.' })),
      writeSkillFile: vi.fn(async () => ({ success: true, message: 'File written.' })),
    } as unknown as SkillsContext;
  });

  it('creates the tool with correct name and description', () => {
    const tool = createSaveSkillTool();
    expect(tool.name).toBe('save-skill');
    expect(tool.description).toContain('skills');
  });

  it('delegates create action to the skills context with default global location', async () => {
    const context = createContext();
    await callTool(context, { action: 'create', name: 'create-global', content: makeValidSkill('create-global') });

    expect(mockSkillsContext.createSkill).toHaveBeenCalledWith('create-global', makeValidSkill('create-global'), 'global');
  });

  it('delegates create action with explicit project location', async () => {
    const context = createContext();
    await callTool(context, { action: 'create', name: 'create-project', content: makeValidSkill('create-project'), location: 'project' });

    expect(mockSkillsContext.createSkill).toHaveBeenCalledWith('create-project', makeValidSkill('create-project'), 'project');
  });

  it('rejects create without content', async () => {
    const context = createContext();
    const result = await callTool(context, { action: 'create', name: 'no-content' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Content is required');
    expect(mockSkillsContext.createSkill).not.toHaveBeenCalled();
  });

  it('delegates edit action to updateSkill', async () => {
    const context = createContext();
    await callTool(context, { action: 'edit', name: 'edit-me', content: makeValidSkill('edit-me') });

    expect(mockSkillsContext.updateSkill).toHaveBeenCalledWith('edit-me', makeValidSkill('edit-me'));
  });

  it('rejects edit without name', async () => {
    const context = createContext();
    const result = await callTool(context, { action: 'edit', content: 'x' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Skill name is required');
    expect(mockSkillsContext.updateSkill).not.toHaveBeenCalled();
  });

  it('delegates write_file action to writeSkillFile', async () => {
    const context = createContext();
    await callTool(context, { action: 'write_file', name: 'file-me', file_path: 'references/api.md', file_content: '# API' });

    expect(mockSkillsContext.writeSkillFile).toHaveBeenCalledWith('file-me', 'references/api.md', '# API');
  });

  it('rejects write_file without file_content', async () => {
    const context = createContext();
    const result = await callTool(context, { action: 'write_file', name: 'file-me', file_path: 'references/api.md' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('file_content is required');
  });

  it('adds a write_file hint to successful create results', async () => {
    const result = await callTool(createContext(), { action: 'create', name: 'hinted', content: makeValidSkill('hinted') });

    expect(result.success).toBe(true);
    expect((result as { hint?: string }).hint).toContain("action='write_file'");
  });

  it('lists skills for refresh action without mutating anything', async () => {
    vi.mocked(mockSkillsContext.listSkills).mockResolvedValue([
      { name: 'one', description: '', location: 'global' },
      { name: 'two', description: '', location: 'project' },
    ]);
    const context = createContext();

    const result = await callTool(context, { action: 'refresh' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('2 skill(s)');
    expect(mockSkillsContext.createSkill).not.toHaveBeenCalled();
    expect(mockSkillsContext.updateSkill).not.toHaveBeenCalled();
    expect(mockSkillsContext.writeSkillFile).not.toHaveBeenCalled();
  });

  it('returns a failure result when the skills context is unavailable', async () => {
    const context = createContext();
    vi.mocked(context.getSkillContext).mockImplementation(() => {
      throw new Error('SkillManager not available');
    });

    const result = await callTool(context, { action: 'refresh' });

    expect(result.success).toBe(false);
    expect(result.message).toBe('Error: SkillManager not available');
  });

  it('propagates core validation failures as success:false results', async () => {
    vi.mocked(mockSkillsContext.createSkill).mockResolvedValue({ success: false, message: 'A skill named seriously already exists.' });
    const context = createContext();

    const result = await callTool(context, { action: 'create', name: 'seriously', content: makeValidSkill('seriously') });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('returns an error result for unknown actions', async () => {
    const context = createContext();
    const result = await callTool(context, { action: 'teleport' as string, name: 'whatever' } as never);

    expect(result.success).toBe(false);
    expect(result.message).toContain('teleport');
  });
});
