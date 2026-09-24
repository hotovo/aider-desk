/**
 * Tests for skills tool, particularly filtering of skills with
 * disable-model-invocation from the agent-facing skill list
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SKILLS_TOOL_ACTIVATE_SKILL, SKILLS_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { SkillDefinition } from '@common/types';

const createSkill = (overrides: Partial<SkillDefinition>): SkillDefinition => ({
  name: 'test-skill',
  description: 'A test skill',
  location: 'global',
  dirPath: '/skills/test-skill',
  ...overrides,
});

describe('Skills Tools - activate_skill', () => {
  let createSkillsToolset: any;
  let mockTask: any;
  let mockProfile: any;
  let mockSkillManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSkillManager = {
      loadAllSkills: vi.fn(async () => [] as SkillDefinition[]),
      getSkillContent: vi.fn(async () => 'Skill content'),
    };

    mockTask = {
      getSkillManager: vi.fn(() => mockSkillManager),
      addToolMessage: vi.fn(),
    };

    mockProfile = {
      toolApprovals: {},
      toolSettings: {},
    };

    const { ApprovalManager } = await import('../approval-manager');
    vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

    const skillsModule = await import('../skills');
    createSkillsToolset = skillsModule.createSkillsToolset;
  });

  const getActivateSkillTool = async () => {
    const tools = await createSkillsToolset(mockTask, mockProfile, { id: 'test-prompt-context' });
    return tools[`${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`];
  };

  it('excludes skills with disable-model-invocation from the agent-facing skill list', async () => {
    mockSkillManager.loadAllSkills.mockResolvedValue([
      createSkill({ name: 'normal', description: 'Normal skill' }),
      createSkill({ name: 'manual-only', description: 'Manual only skill', disableModelInvocation: true }),
    ]);

    const tool = await getActivateSkillTool();

    expect(tool.description).toContain('<name>\nnormal\n</name>');
    expect(tool.description).not.toContain('manual-only');
  });

  it('still lists skills with user-invocable false for the agent', async () => {
    mockSkillManager.loadAllSkills.mockResolvedValue([createSkill({ name: 'agent-only', description: 'Agent only skill', userInvocable: false })]);

    const tool = await getActivateSkillTool();

    expect(tool.description).toContain('<name>\nagent-only\n</name>');
  });

  it('allows the agent to activate a skill with user-invocable false', async () => {
    mockSkillManager.loadAllSkills.mockResolvedValue([createSkill({ name: 'agent-only', description: 'Agent only skill', userInvocable: false })]);
    mockSkillManager.getSkillContent.mockResolvedValue('Agent only skill content');

    const tool = await getActivateSkillTool();
    const result = await tool.execute({ skill: 'agent-only' }, { toolCallId: 'call-1' });

    expect(result).toContain("Skill 'agent-only' activated.");
    expect(mockTask.addToolMessage).toHaveBeenCalled();
  });
});
