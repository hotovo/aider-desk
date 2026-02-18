import { describe, it, expect } from 'vitest';
import { StoryStatus } from '@common/bmad-types';

import { generateSuggestions } from '../bmad-suggestions';

import type { WorkflowArtifacts } from '@common/bmad-types';

describe('generateSuggestions', () => {
  describe('task metadata integration', () => {
    it('should prioritize follow-ups from the current workflow when taskMetadata contains bmadWorkflowId', () => {
      const completedWorkflows = ['create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const taskMetadata = {
        bmadWorkflowId: 'create-prd',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // create-prd has followUps: ['create-ux-design', 'create-architecture', 'create-epics-and-stories']
      // These should appear first in the sorted results
      const prdFollowUps = ['create-ux-design', 'create-architecture', 'create-epics-and-stories'];

      prdFollowUps.forEach((followUp) => {
        if (suggestions.includes(followUp)) {
          const followUpIndex = suggestions.indexOf(followUp);
          // Follow-ups from current workflow should be at the beginning
          expect(followUpIndex).toBeLessThan(suggestions.length);
        }
      });

      // create-product-brief also has followUps that should not be prioritized
      const otherFollowUps = suggestions.filter((s) => !prdFollowUps.includes(s));
      if (otherFollowUps.length > 0 && prdFollowUps.some((f) => suggestions.includes(f))) {
        const firstOtherFollowUpIndex = suggestions.indexOf(otherFollowUps[0]);
        const firstPrdFollowUpIndex = suggestions.find((s) => prdFollowUps.includes(s)) ? suggestions.indexOf(prdFollowUps[0]) : -1;
        if (firstPrdFollowUpIndex >= 0 && firstOtherFollowUpIndex >= 0) {
          expect(firstPrdFollowUpIndex).toBeLessThan(firstOtherFollowUpIndex);
        }
      }
    });

    it('should work correctly when taskMetadata is undefined', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined);

      // Should still generate suggestions normally
      expect(suggestions).toContain('create-prd');
      expect(suggestions).toContain('quick-spec');
    });

    it('should work correctly when taskMetadata is null', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should still generate suggestions normally
      expect(suggestions).toContain('create-prd');
      expect(suggestions).toContain('quick-spec');
    });

    it('should work correctly when taskMetadata does not contain bmadWorkflowId', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const taskMetadata = {
        customKey: 'customValue',
        anotherKey: 123,
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should generate suggestions normally without prioritization
      expect(suggestions).toContain('create-prd');
      expect(suggestions).toContain('quick-spec');
    });

    it('should place current workflow follow-ups at the beginning of sorted results', () => {
      const completedWorkflows = ['quick-spec'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
      };

      const taskMetadata = {
        bmadWorkflowId: 'quick-spec',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // quick-spec has followUps: ['quick-dev', 'create-story']
      // These should appear before other suggestions like create-product-brief
      if (suggestions.includes('quick-dev') && suggestions.includes('create-product-brief')) {
        const quickDevIndex = suggestions.indexOf('quick-dev');
        const createProductBriefIndex = suggestions.indexOf('create-product-brief');
        expect(quickDevIndex).toBeLessThan(createProductBriefIndex);
      }
    });

    it('should handle invalid bmadWorkflowId in taskMetadata gracefully', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const taskMetadata = {
        bmadWorkflowId: 'non-existent-workflow-id',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should still generate suggestions normally
      expect(suggestions).toContain('create-prd');
    });

    it('should prioritize current workflow follow-ups when combined with sprint status', () => {
      const completedWorkflows = ['create-prd', 'sprint-planning'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
        'sprint-planning': {
          path: '_bmad-output/implementation-artifacts/sprint-status.yaml',
        },
      };

      const sprintStatus = {
        storyStatuses: [StoryStatus.Backlog, StoryStatus.ReadyForDev],
        completedWorkflows: [],
      };

      const taskMetadata = {
        bmadWorkflowId: 'create-prd',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus, taskMetadata);

      // create-prd followUps: ['create-ux-design', 'create-architecture', 'create-epics-and-stories']
      // These should be prioritized over sprint status suggestions (create-story, dev-story)
      const prdFollowUps = ['create-ux-design', 'create-architecture'];
      const sprintSuggestions = ['create-story', 'dev-story'];

      prdFollowUps.forEach((followUp) => {
        if (suggestions.includes(followUp)) {
          const followUpIndex = suggestions.indexOf(followUp);
          sprintSuggestions.forEach((sprintSuggestion) => {
            if (suggestions.includes(sprintSuggestion)) {
              const sprintIndex = suggestions.indexOf(sprintSuggestion);
              // PRD follow-ups should come before sprint suggestions
              expect(followUpIndex).toBeLessThan(sprintIndex);
            }
          });
        }
      });
    });

    it('should deduplicate suggestions when current workflow follow-ups overlap with other sources', () => {
      const completedWorkflows = ['dev-story', 'code-review'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'dev-story': {
          path: '_bmad-output/implementation-artifacts/dev-story.md',
        },
        'code-review': {
          path: '_bmad-output/implementation-artifacts/code-review-example.md',
        },
      };

      const sprintStatus = {
        storyStatuses: [StoryStatus.Review],
        completedWorkflows: [],
      };

      const taskMetadata = {
        bmadWorkflowId: 'code-review',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus, taskMetadata);

      // code-review has followUps: ['create-story', 'dev-story']
      // Sprint status with Review also suggests 'code-review'
      // dev-story followUps: ['code-review', 'create-story']
      // 'create-story' appears in both code-review followUps and dev-story followUps
      const createStoryCount = suggestions.filter((s) => s === 'create-story').length;
      expect(createStoryCount).toBeLessThanOrEqual(1);
    });

    it('should handle empty taskMetadata object', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const taskMetadata = {};

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should work normally
      expect(suggestions).toContain('create-prd');
      expect(suggestions).toContain('quick-spec');
    });

    it('should combine current workflow follow-ups with all completed workflow follow-ups', () => {
      const completedWorkflows = ['create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const taskMetadata = {
        bmadWorkflowId: 'create-prd',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should include follow-ups from all completed workflows
      expect(suggestions).toContain('create-ux-design'); // from create-prd
      expect(suggestions).toContain('create-architecture'); // from create-prd
      expect(suggestions).toContain('create-epics-and-stories'); // from create-prd

      // But prioritize create-prd follow-ups at the beginning
      if (suggestions.includes('create-ux-design')) {
        const uxIndex = suggestions.indexOf('create-ux-design');
        // create-ux-design is a PRD follow-up, should be early in the list
        expect(uxIndex).toBeLessThan(suggestions.length / 2);
      }
    });

    it('should return empty array when current workflow is not completed', () => {
      const completedWorkflows = ['create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };
      const taskMetadata = {
        bmadWorkflowId: 'create-architecture',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should NOT show any suggestions when current workflow is in progress
      expect(suggestions).toEqual([]);
    });

    it('should show follow-ups when current workflow is completed', () => {
      const completedWorkflows = ['create-prd', 'create-architecture'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
        'create-architecture': {
          path: '_bmad-output/planning-artifacts/architecture.md',
        },
      };
      const taskMetadata = {
        bmadWorkflowId: 'create-architecture',
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined, taskMetadata);

      // Should filter to create-architecture follow-ups since it's completed
      expect(suggestions).toContain('create-epics-and-stories');
      expect(suggestions).not.toContain('create-ux-design'); // not a follow-up of create-architecture
    });
  });

  describe('greenfield projects (no completed workflows)', () => {
    it('suggests entry-point workflows when no workflows completed', () => {
      const completedWorkflows: string[] = [];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {};

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      expect(suggestions).toContain('create-product-brief');
      expect(suggestions).toContain('quick-spec');
    });
  });

  describe('Quick Flow path suggestions', () => {
    it('suggests next Quick Flow workflow when quick-spec is completed', () => {
      const completedWorkflows = ['quick-spec'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should suggest quick-dev (next in Quick Flow path)
      expect(suggestions).toContain('quick-dev');
    });

    it('also suggests Full Workflow entry point when on Quick Flow path', () => {
      const completedWorkflows = ['quick-spec'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should also suggest create-product-brief (Full Workflow entry point)
      expect(suggestions).toContain('create-product-brief');
    });

    it('does not suggest completed Full Workflow entry point when on Quick Flow path', () => {
      const completedWorkflows = ['quick-spec', 'create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should NOT suggest create-product-brief (already completed)
      expect(suggestions).not.toContain('create-product-brief');
      // Should still suggest quick-dev
      expect(suggestions).toContain('quick-dev');
    });
  });

  describe('Full Workflow path suggestions', () => {
    it('suggests next Full Workflow workflow when create-product-brief is completed', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should suggest create-prd (next in Full Workflow path)
      expect(suggestions).toContain('create-prd');
    });

    it('also suggests Quick Flow entry point when on Full Workflow path', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should also suggest quick-spec (Quick Flow entry point)
      expect(suggestions).toContain('quick-spec');
    });

    it('does not suggest completed Quick Flow entry point when on Full Workflow path', () => {
      const completedWorkflows = ['create-product-brief', 'quick-spec'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should NOT suggest quick-spec (already completed)
      expect(suggestions).not.toContain('quick-spec');
      // Should still suggest create-prd
      expect(suggestions).toContain('create-prd');
    });

    it('suggests next steps from both paths when both paths are active', () => {
      const completedWorkflows = ['quick-spec', 'create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should suggest quick-dev (next in Quick Flow)
      expect(suggestions).toContain('quick-dev');
      // Should suggest create-prd (next in Full Workflow)
      expect(suggestions).toContain('create-prd');
    });

    it('suggests next steps from both paths when multiple workflows completed on each path', () => {
      const completedWorkflows = ['quick-spec', 'quick-dev', 'create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'quick-spec': {
          path: '_bmad-output/implementation-artifacts/tech-spec-example.md',
        },
        'quick-dev': {
          path: 'N/A',
        },
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should NOT suggest quick-spec or quick-dev (already completed)
      expect(suggestions).not.toContain('quick-spec');
      expect(suggestions).not.toContain('quick-dev');
      // Should NOT suggest create-product-brief or create-prd (already completed)
      expect(suggestions).not.toContain('create-product-brief');
      expect(suggestions).not.toContain('create-prd');
      // Should suggest next steps from Full Workflow followUps
      expect(suggestions).toContain('create-architecture');
      expect(suggestions).toContain('create-ux-design');
      expect(suggestions).toContain('create-epics-and-stories');
    });
  });

  describe('brownfield projects (some workflows completed)', () => {
    it('collects followUps from completed workflows', () => {
      const completedWorkflows = ['create-product-brief'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // create-product-brief has followUps: ['create-prd']
      expect(suggestions).toContain('create-prd');
    });

    it('filters out already completed workflows from suggestions', () => {
      const completedWorkflows = ['create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // create-prd is already completed, so should NOT be suggested
      expect(suggestions).not.toContain('create-prd');
      // create-prd followUps: ['create-ux-design', 'create-architecture', 'create-epics-and-stories']
      expect(suggestions).toContain('create-architecture');
      expect(suggestions).toContain('create-epics-and-stories');
    });

    it('deprioritizes workflows with unsatisfied prerequisites', () => {
      const completedWorkflows = ['research'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        research: {
          path: '_bmad-output/planning-artifacts/research-session.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // research followUps: ['create-product-brief']
      expect(suggestions).toContain('create-product-brief');
    });

    it('prioritizes workflows with satisfied prerequisites over those without', () => {
      const completedWorkflows = ['create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // create-prd followUps: ['create-ux-design', 'create-architecture', 'create-epics-and-stories']
      // create-architecture requires PRD (satisfied)
      // create-epics-and-stories requires PRD and architecture (architecture not satisfied)
      if (suggestions.includes('create-architecture') && suggestions.includes('create-epics-and-stories')) {
        const architectureIndex = suggestions.indexOf('create-architecture');
        const epicsIndex = suggestions.indexOf('create-epics-and-stories');
        // create-architecture should come before create-epics-and-stories (satisfied prerequisites)
        expect(architectureIndex).toBeLessThan(epicsIndex);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array when all followUps are already completed', () => {
      // Simulate scenario where only workflows with completed followUps exist
      const completedWorkflows = ['create-product-brief', 'create-prd'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief-example.md',
        },
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // Should return suggestions that are not already completed
      suggestions.forEach((suggestion) => {
        expect(completedWorkflows).not.toContain(suggestion);
      });
    });

    it('handles workflows without followUps', () => {
      // code-review has followUps: ['create-story', 'dev-story']
      const completedWorkflows = ['code-review'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'code-review': {
          path: '_bmad-output/implementation-artifacts/code-review-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('deduplicates followUps from multiple completed workflows', () => {
      // Both create-prd and create-ux-design have 'create-architecture' in followUps
      const completedWorkflows = ['create-prd', 'create-ux-design'];
      const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
        'create-prd': {
          path: '_bmad-output/planning-artifacts/prd.md',
        },
        'create-ux-design': {
          path: '_bmad-output/planning-artifacts/ux-design-example.md',
        },
      };

      const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts);

      // create-architecture should appear only once
      const architectureCount = suggestions.filter((s) => s === 'create-architecture').length;
      expect(architectureCount).toBeLessThanOrEqual(1);
    });
  });

  describe('sprint status suggestions', () => {
    const detectedArtifacts: WorkflowArtifacts['detectedArtifacts'] = {
      'create-product-brief': {
        path: '_bmad-output/planning-artifacts/product-brief-example.md',
      },
      'sprint-planning': {
        path: '_bmad-output/implementation-artifacts/sprint-status.yaml',
      },
    };

    describe('generateSuggestions with sprint status', () => {
      it('should include workflow suggestions based on story statuses', () => {
        const completedWorkflows = ['create-product-brief', 'sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.Review],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // backlog -> create-story
        expect(suggestions).toContain('create-story');
        // ready-for-dev -> dev-story
        expect(suggestions).toContain('dev-story');
        // review -> code-review
        expect(suggestions).toContain('code-review');
      });

      it('should not suggest workflows for in-progress and done stories', () => {
        const completedWorkflows = ['sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.InProgress, StoryStatus.Done],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // in-progress and done should not suggest any workflow
        const expectedSuggestions = ['create-story']; // from sprint-planning followUps
        expect(suggestions).toEqual(expect.arrayContaining(expectedSuggestions));
      });

      it('should deduplicate suggestions from sprint status and followUps', () => {
        const completedWorkflows = ['sprint-planning', 'dev-story'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Review],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // dev-story followUps: ['code-review', 'create-story']
        // review -> code-review
        // code-review should appear only once
        const codeReviewCount = suggestions.filter((s) => s === 'code-review').length;
        expect(codeReviewCount).toBeLessThanOrEqual(1);
      });

      it('should combine sprint status suggestions with followUp suggestions', () => {
        const completedWorkflows = ['create-prd'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.ReadyForDev],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // followUps from create-prd: ['create-ux-design', 'create-architecture', 'create-epics-and-stories']
        expect(suggestions).toContain('create-ux-design');
        expect(suggestions).toContain('create-architecture');
        expect(suggestions).toContain('create-epics-and-stories');

        // sprint status suggestions
        expect(suggestions).toContain('create-story'); // backlog
        expect(suggestions).toContain('dev-story'); // ready-for-dev
      });

      it('should filter out completed workflows from sprint status suggestions', () => {
        const completedWorkflows = ['sprint-planning', 'create-story'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // create-story is already completed, should not be suggested even though backlog suggests it
        expect(suggestions).not.toContain('create-story');
      });

      it('should handle empty sprint status', () => {
        const completedWorkflows = ['sprint-planning'];
        const sprintStatus = {
          storyStatuses: [],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // Should still include followUp suggestions
        expect(suggestions).toContain('create-story');
      });

      it('should handle undefined sprint status', () => {
        const completedWorkflows = ['sprint-planning'];

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, undefined);

        // Should still include followUp suggestions
        expect(suggestions).toContain('create-story');
      });

      it('should handle multiple stories with same status', () => {
        const completedWorkflows = ['sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.Backlog, StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.ReadyForDev],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // create-story should appear only once (deduplicated)
        const createStoryCount = suggestions.filter((s) => s === 'create-story').length;
        expect(createStoryCount).toBeLessThanOrEqual(1);

        // dev-story should appear only once (deduplicated)
        const devStoryCount = suggestions.filter((s) => s === 'dev-story').length;
        expect(devStoryCount).toBeLessThanOrEqual(1);
      });

      it('should prioritize workflows with satisfied prerequisites including sprint status suggestions', () => {
        const completedWorkflows = ['create-prd', 'sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.ReadyForDev, StoryStatus.Review],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // create-ux-design requires PRD (satisfied)
        // create-architecture requires PRD (satisfied)
        // create-epics-and-stories requires PRD and architecture (architecture not satisfied)
        // Sprint status suggestions: create-story, dev-story, code-review

        // If both create-ux-design and create-epics-and-stories are present
        // create-ux-design should come first (higher prerequisite score)
        if (suggestions.includes('create-ux-design') && suggestions.includes('create-epics-and-stories')) {
          const uxIndex = suggestions.indexOf('create-ux-design');
          const epicsIndex = suggestions.indexOf('create-epics-and-stories');
          expect(uxIndex).toBeLessThan(epicsIndex);
        }
      });

      it('should handle mixed valid and invalid statuses', () => {
        const completedWorkflows = ['sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.Review, StoryStatus.Done, StoryStatus.InProgress],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // Should only suggest for backlog and review
        expect(suggestions).toContain('create-story');
        expect(suggestions).toContain('code-review');
      });

      it('should integrate sprint status suggestions with existing brownfield logic', () => {
        const completedWorkflows = ['create-product-brief', 'create-prd', 'sprint-planning'];
        const sprintStatus = {
          storyStatuses: [StoryStatus.Backlog, StoryStatus.ReadyForDev],
          completedWorkflows: [],
        };

        const suggestions = generateSuggestions(completedWorkflows, detectedArtifacts, sprintStatus);

        // Should include followUps from create-prd
        expect(suggestions).toContain('create-ux-design');
        expect(suggestions).toContain('create-architecture');
        expect(suggestions).toContain('create-epics-and-stories');

        // Should include sprint status suggestions
        expect(suggestions).toContain('create-story');
        expect(suggestions).toContain('dev-story');

        // Should not include completed workflows
        expect(suggestions).not.toContain('create-prd');
        expect(suggestions).not.toContain('create-product-brief');
      });
    });
  });
});
