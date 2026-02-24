import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BMAD_WORKFLOWS } from '@common/bmad-workflows';

import { BmadManager } from '../bmad-manager';

import type { WorkflowArtifacts } from '@common/types';

// Mock file system operations
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify({ version: '1.0.0' })),
  },
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({ version: '1.0.0' })),
}));

vi.mock('fs/promises');

describe('BmadManager - Status', () => {
  let bmadManager: BmadManager;
  const mockProjectPath = '/mock/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
    bmadManager = new BmadManager(mockProjectPath);
  });

  describe('getBmadStatus - Response Structure', () => {
    it('populates all BmadStatus fields correctly', async () => {
      const mockWorkflowArtifacts: WorkflowArtifacts = {
        completedWorkflows: ['create-product-brief'],
        inProgressWorkflows: [],
        detectedArtifacts: {
          'create-product-brief': {
            path: 'planning-artifacts/product-brief-example.md',
          },
        },
        sprintStatus: undefined,
      };

      vi.spyOn(bmadManager as any, 'scanWorkflows').mockResolvedValue(mockWorkflowArtifacts);

      const status = await bmadManager.getBmadStatus();

      // Verify all required fields are present
      expect(status).toHaveProperty('installed');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('availableWorkflows');
      expect(status).toHaveProperty('completedWorkflows');
      expect(status).toHaveProperty('inProgressWorkflows');
      expect(status).toHaveProperty('incompleteWorkflows');
      expect(status).toHaveProperty('detectedArtifacts');
      expect(status).toHaveProperty('sprintStatus');

      // Verify field types and values
      expect(typeof status.installed).toBe('boolean');
      expect(Array.isArray(status.availableWorkflows)).toBe(true);
      expect(Array.isArray(status.completedWorkflows)).toBe(true);
      expect(Array.isArray(status.inProgressWorkflows)).toBe(true);
      expect(typeof status.detectedArtifacts).toBe('object');

      // Verify availableWorkflows equals BMAD_WORKFLOWS
      expect(status.availableWorkflows).toEqual(BMAD_WORKFLOWS);

      // Verify completedWorkflows from scanWorkflows result
      expect(status.completedWorkflows).toEqual(mockWorkflowArtifacts.completedWorkflows);
      expect(status.inProgressWorkflows).toEqual(mockWorkflowArtifacts.inProgressWorkflows);

      // Verify detectedArtifacts from scanWorkflows result
      expect(status.detectedArtifacts).toEqual(mockWorkflowArtifacts.detectedArtifacts);
      expect(status.sprintStatus).toBeUndefined();
    });

    it('returns empty completed workflows for greenfield projects', async () => {
      const mockWorkflowArtifacts: WorkflowArtifacts = {
        completedWorkflows: [],
        inProgressWorkflows: [],
        detectedArtifacts: {},
        sprintStatus: undefined,
      };

      vi.spyOn(bmadManager as any, 'scanWorkflows').mockResolvedValue(mockWorkflowArtifacts);

      const status = await bmadManager.getBmadStatus();

      expect(status.completedWorkflows).toEqual([]);
      expect(status.inProgressWorkflows).toEqual([]);
    });

    it('returns detected artifacts from scanWorkflows', async () => {
      const mockWorkflowArtifacts: WorkflowArtifacts = {
        completedWorkflows: ['create-product-brief', 'create-prd'],
        inProgressWorkflows: ['create-architecture'],
        detectedArtifacts: {
          'create-product-brief': {
            path: 'planning-artifacts/product-brief-example.md',
          },
          'create-prd': {
            path: 'planning-artifacts/prd.md',
          },
        },
        sprintStatus: undefined,
      };

      vi.spyOn(bmadManager as any, 'scanWorkflows').mockResolvedValue(mockWorkflowArtifacts);

      const status = await bmadManager.getBmadStatus();

      expect(status.completedWorkflows).toEqual(['create-product-brief', 'create-prd']);
      expect(status.inProgressWorkflows).toEqual(['create-architecture']);
      expect(status.detectedArtifacts).toEqual(mockWorkflowArtifacts.detectedArtifacts);
    });
  });
});
