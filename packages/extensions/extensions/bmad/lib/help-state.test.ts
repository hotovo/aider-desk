import { describe, expect, it } from 'vitest';

import { buildHelpStateMessage, HELP_STATE_CONTEXT_ID } from './help-state';

import { StoryStatus } from './types';

import type { BmadStatus } from './types';

const status = (overrides: Partial<BmadStatus> = {}): BmadStatus => ({
  projectDir: 'C:/project',
  installed: true,
  version: '6.11.0',
  modules: [],
  skillsDir: '.agents/skills',
  catalog: [
    {
      id: 'bmad-create-epics-and-stories',
      skillId: 'bmad-create-epics-and-stories',
      name: 'Create Epics and Stories',
      menuCode: 'CE',
      module: 'bmm',
      description: '',
      phase: 'plan',
      precededBy: [],
      followedBy: [],
      required: true,
      outputLocation: 'planning_artifacts',
      outputs: ['epics and stories'],
      skillPath: '.agents/skills/bmad-create-epics-and-stories/SKILL.md',
    },
    {
      id: 'bmad-sprint-planning',
      skillId: 'bmad-sprint-planning',
      name: 'Sprint Planning',
      menuCode: 'SP',
      module: 'bmm',
      description: '',
      phase: 'plan',
      precededBy: [],
      followedBy: [],
      required: true,
      outputLocation: 'implementation_artifacts',
      outputs: ['sprint status'],
      skillPath: '.agents/skills/bmad-sprint-planning/SKILL.md',
    },
    {
      id: 'bmad-sprint-planning#ss',
      skillId: 'bmad-sprint-planning',
      name: 'Sprint Status',
      menuCode: 'SS',
      module: 'bmm',
      description: '',
      phase: 'anytime',
      precededBy: [],
      followedBy: [],
      required: false,
      outputLocation: undefined,
      outputs: ['status summary'],
      skillPath: '.agents/skills/bmad-sprint-planning/SKILL.md',
    },
    {
      id: 'bmad-build',
      skillId: 'bmad-build',
      name: 'Build',
      menuCode: 'BD',
      module: 'bmm',
      description: '',
      phase: 'ship',
      precededBy: ['bmad-sprint-planning'],
      followedBy: [],
      required: true,
      outputLocation: 'implementation_artifacts',
      outputs: ['spec and project implementation'],
      skillPath: '.agents/skills/bmad-build/SKILL.md',
    },
  ],
  trackedEntries: {
    'bmad-create-epics-and-stories': { baseDir: '_bmad-output/planning-artifacts', tokens: ['epic', 'stori'] },
    'bmad-sprint-planning': { baseDir: '_bmad-output/implementation-artifacts', tokens: ['sprint', 'status'] },
    'bmad-build': { baseDir: '_bmad-output/implementation-artifacts', tokens: ['spec', 'project', 'implementation'] },
  },
  completedWorkflows: ['bmad-create-epics-and-stories', 'bmad-sprint-planning'],
  inProgressWorkflows: [],
  incompleteWorkflows: [],
  detectedArtifacts: {
    'bmad-create-epics-and-stories': {
      path: 'C:/project/_bmad-output/planning-artifacts/epics.md',
      stepsCompleted: ['step-01', 'step-02'],
    },
    'bmad-sprint-planning': {
      path: 'C:/project/_bmad-output/implementation-artifacts/sprint-status.yaml',
    },
  },
  sprintStatus: {
    storyStatuses: [
      StoryStatus.Backlog,
      StoryStatus.Backlog,
      StoryStatus.Backlog,
      StoryStatus.Review,
      StoryStatus.Done,
    ],
  },
  untrackedWorkflows: [
    { id: 'bmad-sprint-planning#ss', name: 'Sprint Status', reason: 'no-output-location' },
  ],
  ...overrides,
});

describe('buildHelpStateMessage', () => {
  const NOW = new Date(2026, 7, 27, 10, 30);

  it('lists completed rows with menu code and project-relative artifact path', () => {
    const message = buildHelpStateMessage(status(), ['bmad-build'], NOW);

    expect(message.role).toBe('user');
    expect(message.promptContext?.id).toBe(HELP_STATE_CONTEXT_ID);
    const content = String(message.content);

    expect(content).toContain('[Project state snapshot - AiderDesk BMAD extension scan, 2026-08-27 10:30]');
    expect(content).toContain('- [CE] Create Epics and Stories (`bmad-create-epics-and-stories`) -> _bmad-output/planning-artifacts/epics.md');
    expect(content).toContain('- [SP] Sprint Planning (`bmad-sprint-planning`) -> _bmad-output/implementation-artifacts/sprint-status.yaml');
    expect(content).toContain('In progress (frontmatter status below):');
    expect(content).toContain('- (none)');
  });

  it('explains in-progress entries with their frontmatter status', () => {
    const message = buildHelpStateMessage(
      status({
        catalog: [
          ...status().catalog,
          {
            id: 'bmad-product-brief',
            skillId: 'bmad-product-brief',
            name: 'Create Brief',
            menuCode: 'CB',
            module: 'bmm',
            description: '',
            phase: 'plan',
            precededBy: [],
            followedBy: [],
            required: false,
            outputLocation: 'planning_artifacts',
            outputs: ['product brief'],
            skillPath: '.agents/skills/bmad-product-brief/SKILL.md',
          },
        ],
        completedWorkflows: [],
        inProgressWorkflows: ['bmad-product-brief'],
        detectedArtifacts: {
          'bmad-product-brief': {
            path: 'C:/project/_bmad-output/planning-artifacts/briefs/run-1/brief.md',
            status: 'draft',
          },
        },
      }),
      [],
      NOW,
    );

    expect(String(message.content)).toContain(
      '- [CB] Create Brief (`bmad-product-brief`) -> _bmad-output/planning-artifacts/briefs/run-1/brief.md, frontmatter status \'draft\'',
    );
  });

  it('explains untracked rows and inherits the tracked row of the same skill', () => {
    const message = buildHelpStateMessage(status(), [], NOW);
    const content = String(message.content);

    expect(content).toContain('- [SS] Sprint Status (`bmad-sprint-planning#ss`): no output location defined');
    expect(content).toContain('shares skill `bmad-sprint-planning` with [SP] Sprint Planning - treat as done when that artifact exists');
  });

  it('summarizes the sprint board and the recommended next steps', () => {
    const message = buildHelpStateMessage(status(), ['bmad-build'], NOW);
    const content = String(message.content);

    expect(content).toContain('Sprint board: 1 done, 1 in review, 0 in progress, 0 ready for dev, 3 in backlog.');
    expect(content).toContain('Recommended next steps (extension suggestions - verify and recommend among these first):');
    expect(content).toContain('- [BD] Build (`bmad-build`) - required');
  });

  it('states when nothing is detected yet', () => {
    const message = buildHelpStateMessage(
      status({
        completedWorkflows: [],
        inProgressWorkflows: [],
        untrackedWorkflows: [],
        sprintStatus: undefined,
      }),
      [],
      NOW,
    );

    expect(String(message.content)).toContain('No artifacts detected yet');
  });
});
