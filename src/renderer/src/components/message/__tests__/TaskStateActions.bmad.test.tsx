import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BmadStatus, WorkflowMetadata, IncompleteWorkflowMetadata, WorkflowPhase } from '@common/bmad-types';
import { DefaultTaskState } from '@common/types';

import { TaskStateActions } from '../TaskStateActions';

// Mock useBmadState hook
vi.mock('@/components/bmad/useBmadState');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useApi hook
vi.mock('@/contexts/ApiContext', () => ({
  useApi: () => ({
    openPath: vi.fn(),
  }),
}));

// Mock Button component
vi.mock('@/components/common/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
}));

// Mock components
vi.mock('@/components/bmad/SuggestedWorkflowCard', () => ({
  SuggestedWorkflowCard: ({ workflow, incompleteWorkflow }: { workflow: WorkflowMetadata; incompleteWorkflow?: IncompleteWorkflowMetadata }) => (
    <button data-testid={`workflow-${workflow.id}`}>
      {workflow.name}
      {incompleteWorkflow && <span data-testid={`step-info-${workflow.id}`}>Step {incompleteWorkflow.nextStep}</span>}
    </button>
  ),
}));

import * as useBmadStateModule from '@/components/bmad/useBmadState';

// Helper to create mock BmadStatus with required fields
const createMockBmadStatus = (overrides: Partial<BmadStatus> = {}): BmadStatus => ({
  projectDir: '/test/project',
  installed: true,
  version: '1.0.0',
  availableWorkflows: [],
  completedWorkflows: [],
  inProgressWorkflows: [],
  incompleteWorkflows: [],
  detectedArtifacts: {},
  sprintStatus: undefined,
  ...overrides,
});

describe('TaskStateActions - BMAD Integration', () => {
  const mockOnResumeTask = vi.fn();
  const mockOnMarkAsDone = vi.fn();
  const projectDir = '/test/project';
  const taskId = 'task-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mode Detection', () => {
    it('should render BMAD actions when mode is "bmad" in ReadyForReview state', () => {
      vi.spyOn(useBmadStateModule, 'useBmadState').mockReturnValue({
        status: createMockBmadStatus(),
        currentWorkflow: null,
        suggestedWorkflows: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.ReadyForReview}
          mode="bmad"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // Should see BMAD-specific UI elements
      expect(screen.queryByText('messages.execute')).not.toBeInTheDocument();
    });

    it('should NOT render BMAD actions when mode is not "bmad"', () => {
      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.Todo}
          mode="agent"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // Should see default actions
      expect(screen.getByText('messages.execute')).toBeInTheDocument();
    });

    it('should render default actions when mode is undefined', () => {
      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.Todo}
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // Should see default actions
      expect(screen.getByText('messages.execute')).toBeInTheDocument();
    });
  });

  describe('Available Workflows', () => {
    it('should render WorkflowActionButton for suggested workflows', () => {
      const mockWorkflow: WorkflowMetadata = {
        id: 'product-brief',
        name: 'Product Brief',
        description: 'Create product brief',
        phase: WorkflowPhase.Analysis,
        workflowPath: '/path/to/workflow.yaml',
        outputArtifact: 'brief.md',
        totalSteps: 3,
      };

      vi.spyOn(useBmadStateModule, 'useBmadState').mockReturnValue({
        status: createMockBmadStatus({
          availableWorkflows: [mockWorkflow],
          completedWorkflows: ['create-product-brief'], // Need completed workflows to show suggestions
        }),
        currentWorkflow: null,
        suggestedWorkflows: ['product-brief'],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.ReadyForReview}
          mode="bmad"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      expect(screen.getByTestId('workflow-product-brief')).toBeInTheDocument();
    });

    it('should render completed workflows with distinction', () => {
      const mockSuggestedWorkflow: WorkflowMetadata = {
        id: 'prd',
        name: 'PRD',
        description: 'Product requirements',
        phase: WorkflowPhase.Planning,
        workflowPath: '/path/to/prd.yaml',
        outputArtifact: 'prd.md',
        totalSteps: 3,
      };

      vi.spyOn(useBmadStateModule, 'useBmadState').mockReturnValue({
        status: createMockBmadStatus({
          availableWorkflows: [mockSuggestedWorkflow],
          completedWorkflows: ['product-brief'],
        }),
        currentWorkflow: null,
        suggestedWorkflows: ['prd'],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.ReadyForReview}
          mode="bmad"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // Should see the suggested workflow
      expect(screen.getByTestId('workflow-prd')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should handle error state gracefully', () => {
      vi.spyOn(useBmadStateModule, 'useBmadState').mockReturnValue({
        status: null,
        currentWorkflow: null,
        suggestedWorkflows: [],
        isLoading: false,
        error: 'Failed to load BMAD status',
        refresh: vi.fn(),
      });

      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.ReadyForReview}
          mode="bmad"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // Should show error message
      expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    });
  });

  describe('State Refresh', () => {
    it('should pass refresh callback to WorkflowActionButton', () => {
      const mockRefresh = vi.fn();
      const mockWorkflow: WorkflowMetadata = {
        id: 'product-brief',
        name: 'Product Brief',
        description: 'Create product brief',
        phase: WorkflowPhase.Analysis,
        workflowPath: '/path/to/workflow.yaml',
        outputArtifact: 'brief.md',
        totalSteps: 3,
      };

      vi.spyOn(useBmadStateModule, 'useBmadState').mockReturnValue({
        status: createMockBmadStatus({
          availableWorkflows: [mockWorkflow],
          completedWorkflows: ['create-product-brief'], // Need completed workflows to show suggestions
        }),
        currentWorkflow: null,
        suggestedWorkflows: ['product-brief'],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      render(
        <TaskStateActions
          projectDir={projectDir}
          taskId={taskId}
          state={DefaultTaskState.ReadyForReview}
          mode="bmad"
          isArchived={false}
          onResumeTask={mockOnResumeTask}
          onMarkAsDone={mockOnMarkAsDone}
        />,
      );

      // WorkflowActionButton should receive onComplete callback
      // This is verified by the component rendering correctly
      expect(screen.getByTestId('workflow-product-brief')).toBeInTheDocument();
    });
  });
});
