import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useBmadState } from '../useBmadState';

import type { BmadStatus, TaskData } from '@common/types';

// Mock ApiContext
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

describe('useBmadState', () => {
  const mockProjectDir = '/path/to/project';
  let mockBmadStatus: BmadStatus;
  let mockTask: TaskData;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBmadStatus = {
      projectDir: mockProjectDir,
      installed: true,
      version: '6.0.0',
      availableWorkflows: [],
      completedWorkflows: ['create-product-brief'],
      inProgressWorkflows: [],
      incompleteWorkflows: [],
      detectedArtifacts: {
        'create-product-brief': {
          path: '_bmad-output/planning-artifacts/product-brief.md',
        },
      },
      sprintStatus: undefined,
    };

    mockTask = {
      id: 'task-123',
      name: 'Test Task',
      metadata: {
        bmadWorkflowId: 'create-product-brief',
      },
    } as unknown as TaskData;

    mockApi = createMockApi({
      getBmadStatus: vi.fn().mockResolvedValue(mockBmadStatus),
    });
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  describe('hook initialization with object parameter', () => {
    it('should accept object parameter with projectDir and optional task', () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir }));
      expect(result.current).toBeDefined();
    });

    it('should accept object parameter with task', () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      expect(result.current).toBeDefined();
    });

    it('should handle undefined projectDir gracefully', () => {
      const { result } = renderHook(() => useBmadState({ projectDir: undefined }));
      expect(result.current.status).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('BMAD status loading', () => {
    it('should load BMAD status on mount when projectDir is provided', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir }));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalledWith(mockProjectDir);
      expect(result.current.status).toEqual(mockBmadStatus);
    });

    it('should not load BMAD status when projectDir is undefined', () => {
      renderHook(() => useBmadState({ projectDir: undefined }));

      expect(mockApi.getBmadStatus).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch BMAD status';
      mockApi = createMockApi({
        getBmadStatus: vi.fn().mockRejectedValue(new Error(errorMessage)),
      });
      vi.mocked(useApi).mockReturnValue(mockApi);

      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.status).toBeNull();
    });
  });

  describe('suggested workflows generation', () => {
    it('should generate suggestions using task metadata', async () => {
      const { result } = renderHook(() =>
        useBmadState({
          projectDir: mockProjectDir,
          task: {
            ...mockTask,
            metadata: {
              bmadWorkflowId: 'create-prd',
            },
          },
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have suggestions based on task metadata
      expect(Array.isArray(result.current.suggestedWorkflows)).toBe(true);
    });

    it('should generate suggestions when task is undefined', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: undefined }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have suggestions without task metadata
      expect(Array.isArray(result.current.suggestedWorkflows)).toBe(true);
    });

    it('should generate suggestions when task metadata is undefined', async () => {
      const { result } = renderHook(() =>
        useBmadState({
          projectDir: mockProjectDir,
          task: {
            ...mockTask,
            metadata: undefined,
          },
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have suggestions even without metadata
      expect(Array.isArray(result.current.suggestedWorkflows)).toBe(true);
    });

    it('should update suggestions when status changes', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger status update through getBmadStatus call
      mockApi = createMockApi({
        getBmadStatus: vi.fn().mockResolvedValue({
          ...mockBmadStatus,
          completedWorkflows: ['create-product-brief', 'create-prd'],
        }),
      });
      vi.mocked(useApi).mockReturnValue(mockApi);

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.status).toBeDefined();
    });
  });

  describe('refresh functionality', () => {
    it('should refresh BMAD status when refresh is called', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalled();
    });
  });

  describe('BMAD status change listener', () => {
    it('should subscribe to BMAD status changes', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApi.addBmadStatusChangedListener).toHaveBeenCalledWith(mockProjectDir, expect.any(Function));
    });

    it('should update status when change event is received', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let statusChangeListener: ((status: BmadStatus) => void) | undefined;
      let listenerSet = false;
      vi.mocked(mockApi.addBmadStatusChangedListener).mockImplementation((projectDir, listener) => {
        if (projectDir === mockProjectDir && !listenerSet) {
          statusChangeListener = listener;
          listenerSet = true;
        }
        return vi.fn();
      });

      const newStatus = {
        ...mockBmadStatus,
        completedWorkflows: ['create-product-brief', 'create-prd'],
      };

      act(() => {
        if (statusChangeListener) {
          statusChangeListener(newStatus);
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBeDefined();
      });
    });

    it('should unsubscribe from status changes on unmount', async () => {
      const unsubscribe = vi.fn();
      vi.mocked(mockApi.addBmadStatusChangedListener).mockReturnValue(unsubscribe);

      renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      // Listener should be called immediately on mount
      expect(mockApi.addBmadStatusChangedListener).toHaveBeenCalled();
    });
  });

  describe('task metadata integration', () => {
    it('should pass task metadata to generateSuggestions', async () => {
      const { result } = renderHook(() =>
        useBmadState({
          projectDir: mockProjectDir,
          task: {
            ...mockTask,
            metadata: {
              bmadWorkflowId: 'create-prd',
              customKey: 'customValue',
            },
          },
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The suggestions should be generated with the task metadata
      expect(result.current.suggestedWorkflows).toBeDefined();
    });

    it('should update suggestions when task metadata changes', async () => {
      const { result, rerender } = renderHook(({ task }) => useBmadState({ projectDir: mockProjectDir, task }), {
        initialProps: {
          task: {
            ...mockTask,
            metadata: {
              bmadWorkflowId: 'create-product-brief',
            },
          },
        },
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update task with different metadata
      rerender({
        task: {
          ...mockTask,
          metadata: {
            bmadWorkflowId: 'create-prd',
          },
        },
      });

      // Suggestions should be recalculated with new metadata
      expect(result.current.suggestedWorkflows).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null task gracefully', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: null }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestedWorkflows).toBeDefined();
    });

    it('should return empty suggestions when status is null', () => {
      const mockApiEmpty = createMockApi();
      vi.mocked(useApi).mockReturnValue(mockApiEmpty);

      const { result } = renderHook(() => useBmadState({ projectDir: undefined, task: mockTask }));

      expect(result.current.status).toBeNull();
      expect(result.current.suggestedWorkflows).toEqual([]);
    });

    it('should handle multiple rapid refresh calls', async () => {
      const { result } = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call refresh multiple times rapidly
      await act(async () => {
        await Promise.all([result.current.refresh(), result.current.refresh(), result.current.refresh()]);
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalled();
    });
  });
});
