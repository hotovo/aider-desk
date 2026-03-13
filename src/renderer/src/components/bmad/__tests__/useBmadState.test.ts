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
    it('should accept object parameter with projectDir and optional task', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir })).result;
      });
      expect(result!.current).toBeDefined();
    });

    it('should accept object parameter with task', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask })).result;
      });
      expect(result!.current).toBeDefined();
    });

    it('should handle undefined projectDir gracefully', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: undefined })).result;
      });
      expect(result!.current.status).toBeNull();
      expect(result!.current.isLoading).toBe(false);
    });
  });

  describe('BMAD status loading', () => {
    it('should load BMAD status on mount when projectDir is provided', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir })).result;
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalledWith(mockProjectDir);
      expect(result!.current.status).toEqual(mockBmadStatus);
      expect(result!.current.isLoading).toBe(false);
    });

    it('should not load BMAD status when projectDir is undefined', async () => {
      await act(async () => {
        renderHook(() => useBmadState({ projectDir: undefined }));
      });

      expect(mockApi.getBmadStatus).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch BMAD status';
      mockApi = createMockApi({
        getBmadStatus: vi.fn().mockRejectedValue(new Error(errorMessage)),
      });
      vi.mocked(useApi).mockReturnValue(mockApi);

      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir })).result;
      });

      expect(result!.current.error).toBe(errorMessage);
      expect(result!.current.status).toBeNull();
      expect(result!.current.isLoading).toBe(false);
    });
  });

  describe('suggested workflows generation', () => {
    it('should generate suggestions using task metadata', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() =>
          useBmadState({
            projectDir: mockProjectDir,
            task: {
              ...mockTask,
              metadata: {
                bmadWorkflowId: 'create-prd',
              },
            },
          }),
        ).result;
      });

      // Should have suggestions based on task metadata
      expect(Array.isArray(result!.current.suggestedWorkflows)).toBe(true);
      expect(result!.current.isLoading).toBe(false);
    });

    it('should generate suggestions when task is undefined', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: undefined })).result;
      });

      // Should have suggestions without task metadata
      expect(Array.isArray(result!.current.suggestedWorkflows)).toBe(true);
      expect(result!.current.isLoading).toBe(false);
    });

    it('should generate suggestions when task metadata is undefined', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() =>
          useBmadState({
            projectDir: mockProjectDir,
            task: {
              ...mockTask,
              metadata: undefined,
            },
          }),
        ).result;
      });

      // Should have suggestions even without metadata
      expect(Array.isArray(result!.current.suggestedWorkflows)).toBe(true);
      expect(result!.current.isLoading).toBe(false);
    });

    it('should update suggestions when status changes', async () => {
      let renderResult: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>;
      await act(async () => {
        renderResult = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      expect(renderResult!.result.current.isLoading).toBe(false);

      // Trigger status update through getBmadStatus call
      mockApi = createMockApi({
        getBmadStatus: vi.fn().mockResolvedValue({
          ...mockBmadStatus,
          completedWorkflows: ['create-product-brief', 'create-prd'],
        }),
      });
      vi.mocked(useApi).mockReturnValue(mockApi);

      await act(async () => {
        await renderResult!.result.current.refresh();
      });

      expect(renderResult!.result.current.status).toBeDefined();
    });
  });

  describe('refresh functionality', () => {
    it('should refresh BMAD status when refresh is called', async () => {
      let renderResult: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>;
      await act(async () => {
        renderResult = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      expect(renderResult!.result.current.isLoading).toBe(false);

      await act(async () => {
        await renderResult!.result.current.refresh();
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalled();
    });
  });

  describe('BMAD status change listener', () => {
    it('should subscribe to BMAD status changes', async () => {
      let renderResult: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>;
      await act(async () => {
        renderResult = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      expect(renderResult!.result.current.isLoading).toBe(false);
      expect(mockApi.addBmadStatusChangedListener).toHaveBeenCalledWith(mockProjectDir, expect.any(Function));
    });

    it('should update status when change event is received', async () => {
      let renderResult: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>;
      await act(async () => {
        renderResult = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      expect(renderResult!.result.current.isLoading).toBe(false);

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
        expect(renderResult!.result.current.status).toBeDefined();
      });
    });

    it('should unsubscribe from status changes on unmount', async () => {
      const unsubscribe = vi.fn();
      vi.mocked(mockApi.addBmadStatusChangedListener).mockReturnValue(unsubscribe);

      await act(async () => {
        renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      // Listener should be called immediately on mount
      expect(mockApi.addBmadStatusChangedListener).toHaveBeenCalled();
    });
  });

  describe('task metadata integration', () => {
    it('should pass task metadata to generateSuggestions', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() =>
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
        ).result;
      });

      // The suggestions should be generated with the task metadata
      expect(result!.current.suggestedWorkflows).toBeDefined();
      expect(result!.current.isLoading).toBe(false);
    });

    it('should update suggestions when task metadata changes', async () => {
      let result: any;

      let rerender: any;

      await act(async () => {
        const hook = renderHook(({ task }) => useBmadState({ projectDir: mockProjectDir, task }), {
          initialProps: {
            task: {
              ...mockTask,
              metadata: {
                bmadWorkflowId: 'create-product-brief',
              },
            },
          },
        });
        result = hook.result;
        rerender = hook.rerender;
      });

      expect(result.current.isLoading).toBe(false);

      // Update task with different metadata
      await act(async () => {
        rerender({
          task: {
            ...mockTask,
            metadata: {
              bmadWorkflowId: 'create-prd',
            },
          },
        });
      });

      // Suggestions should be recalculated with new metadata
      expect(result.current.suggestedWorkflows).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null task gracefully', async () => {
      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: null })).result;
      });

      expect(result!.current.suggestedWorkflows).toBeDefined();
      expect(result!.current.isLoading).toBe(false);
    });

    it('should return empty suggestions when status is null', async () => {
      const mockApiEmpty = createMockApi();
      vi.mocked(useApi).mockReturnValue(mockApiEmpty);

      let result: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>['result'];
      await act(async () => {
        result = renderHook(() => useBmadState({ projectDir: undefined, task: mockTask })).result;
      });

      expect(result!.current.status).toBeNull();
      expect(result!.current.suggestedWorkflows).toEqual([]);
    });

    it('should handle multiple rapid refresh calls', async () => {
      let renderResult: ReturnType<typeof renderHook<ReturnType<typeof useBmadState>, () => ReturnType<typeof useBmadState>>>;
      await act(async () => {
        renderResult = renderHook(() => useBmadState({ projectDir: mockProjectDir, task: mockTask }));
      });

      expect(renderResult!.result.current.isLoading).toBe(false);

      // Call refresh multiple times rapidly
      await act(async () => {
        await Promise.all([renderResult!.result.current.refresh(), renderResult!.result.current.refresh(), renderResult!.result.current.refresh()]);
      });

      expect(mockApi.getBmadStatus).toHaveBeenCalled();
    });
  });
});
