import { screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultTaskState, TaskData } from '@common/types';

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

const hasSpinner = (taskId: string): boolean => {
  const row = document.querySelector(`[data-task-id="${taskId}"]`);
  return !!row && !!row.querySelector('.animate-spin');
};

describe('TaskSidebar spinner propagation', () => {
  beforeEach(() => {
    vi.mocked(useOptimizedTaskState).mockReturnValue(EMPTY_TASK_STATE);
    localStorage.clear();
  });

  const renderSidebar = (tasks: TaskData[]) =>
    render(<TaskSidebar loading={false} tasks={tasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

  it('shows spinner on collapsed parent of in-progress subtask', () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
      { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1', state: DefaultTaskState.InProgress },
    ] as TaskData[];

    renderSidebar(tasks);

    expect(hasSpinner('parent-1')).toBe(true);
  });

  it('does not show spinner on expanded parent when subtask is visible', () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
      { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1', state: DefaultTaskState.InProgress },
    ] as TaskData[];

    localStorage.setItem('aider-desk-expanded-tasks', JSON.stringify(['parent-1']));
    renderSidebar(tasks);

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(hasSpinner('parent-1')).toBe(false);
    expect(hasSpinner('child-1')).toBe(true);
  });

  it('shows spinner on nearest collapsed ancestor with multi-level nesting', () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
      { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1' },
      { id: 'grandchild-1', name: 'Grandchild 1', updatedAt: '2023-01-03T00:00:00Z', parentId: 'child-1', state: DefaultTaskState.InProgress },
    ] as TaskData[];

    // parent-1 expanded, child-1 collapsed -> spinner on child-1 only
    localStorage.setItem('aider-desk-expanded-tasks', JSON.stringify(['parent-1']));
    const { unmount } = renderSidebar(tasks);

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(hasSpinner('child-1')).toBe(true);
    expect(hasSpinner('parent-1')).toBe(false);
    unmount();

    // everything collapsed -> spinner propagates to parent-1
    localStorage.setItem('aider-desk-expanded-tasks', JSON.stringify([]));
    renderSidebar(tasks);

    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    expect(hasSpinner('parent-1')).toBe(true);
  });

  it('shows spinner on parent when expanding and collapsing via chevron', async () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
      { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1', state: DefaultTaskState.InProgress },
    ] as TaskData[];

    localStorage.setItem('aider-desk-expanded-tasks', JSON.stringify(['parent-1']));
    renderSidebar(tasks);

    expect(hasSpinner('parent-1')).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByTestId('chevron-parent-1'));
    });

    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    expect(hasSpinner('parent-1')).toBe(true);
  });
});
