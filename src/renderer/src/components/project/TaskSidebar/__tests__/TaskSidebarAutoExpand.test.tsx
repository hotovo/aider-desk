import { screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskData } from '@common/types';

import { TaskSidebar } from '../TaskSidebar';

import { render } from '@/__tests__/render';
import { useOptimizedTaskState, EMPTY_TASK_STATE } from '@/stores/taskStore';

// Mock @tanstack/react-virtual
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 28,
        size: 28,
        key: i,
      })),
    getTotalSize: () => count * 28,
    scrollToOffset: vi.fn(),
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
    isScrolling: false,
  })),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useTaskState from taskStore
vi.mock('@/stores/taskStore', () => ({
  useOptimizedTaskState: vi.fn(() => EMPTY_TASK_STATE),
  useTaskState: vi.fn(),
  useTaskQuestion: vi.fn(() => null),
  EMPTY_TASK_STATE: {
    loading: false,
    loaded: false,
    tokensInfo: null,
    question: null,
    todoItems: [],
    aiderTotalCost: 0,
    contextFiles: [],
    aiderModelsData: null,
  },
}));

// Mock useExtensions hook
vi.mock('@/contexts/ExtensionsContext', () => ({
  useExtensions: vi.fn(() => ({
    componentProps: {
      projectDir: '/test/project',
      task: null,
      agentProfile: null,
    },
  })),
}));

// Mock ExtensionComponentWrapper to avoid API context requirement
vi.mock('@/components/extensions/ExtensionComponentWrapper', () => ({
  ExtensionComponentWrapper: () => null,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('TaskSidebar Auto Expand', () => {
  const parentTask = { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null } as TaskData;
  const newSubtask = { id: 'subtask-new', name: 'New Subtask', updatedAt: '2023-01-03T00:00:00Z', parentId: 'parent-1' } as TaskData;

  const makeSidebar = (tasks: TaskData[], activeTaskId: string) => (
    <TaskSidebar loading={false} tasks={tasks} activeTaskId={activeTaskId} onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />
  );

  beforeEach(() => {
    vi.mocked(useOptimizedTaskState).mockReturnValue(EMPTY_TASK_STATE);
    localStorage.clear();
  });

  it('expands parent when activated subtask appears in tasks list after activation', async () => {
    // Simulate the race when the task is activated before the task list update arrives
    const { rerender } = render(makeSidebar([parentTask], 'parent-1'));

    await act(async () => {
      rerender(makeSidebar([parentTask], 'subtask-new'));
    });
    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'subtask-new'));
    });

    expect(screen.getByText('New Subtask')).toBeInTheDocument();
  });

  it('expands parent when activated subtask is already in tasks list', async () => {
    const { rerender } = render(makeSidebar([parentTask], 'parent-1'));

    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'parent-1'));
    });
    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'subtask-new'));
    });

    expect(screen.getByText('New Subtask')).toBeInTheDocument();
  });

  it('expands whole ancestor chain for deeply nested active subtask', async () => {
    const child = { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1' } as TaskData;
    const grandchild = { id: 'grandchild-1', name: 'Grandchild 1', updatedAt: '2023-01-03T00:00:00Z', parentId: 'child-1' } as TaskData;

    const { rerender } = render(makeSidebar([parentTask], 'parent-1'));

    await act(async () => {
      rerender(makeSidebar([parentTask, child, grandchild], 'parent-1'));
    });
    await act(async () => {
      rerender(makeSidebar([parentTask, child, grandchild], 'grandchild-1'));
    });

    expect(screen.getByText('Grandchild 1')).toBeInTheDocument();
  });

  it('does not re-expand after user manually collapses parent of active task', async () => {
    const { rerender } = render(makeSidebar([parentTask], 'parent-1'));

    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'parent-1'));
    });
    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'subtask-new'));
    });

    expect(screen.getByText('New Subtask')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('chevron-parent-1'));
    });
    expect(screen.queryByText('New Subtask')).not.toBeInTheDocument();

    // unrelated tasks update while the same task stays active must keep the parent collapsed
    await act(async () => {
      rerender(makeSidebar([parentTask, newSubtask], 'subtask-new'));
    });

    expect(screen.queryByText('New Subtask')).not.toBeInTheDocument();
  });
});
