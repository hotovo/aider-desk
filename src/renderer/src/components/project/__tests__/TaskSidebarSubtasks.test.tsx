import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskData } from '@common/types';

import { TaskSidebar } from '../TaskSidebar';

import { useTask } from '@/contexts/TaskContext';
import { useTaskState, EMPTY_TASK_STATE } from '@/stores/taskStore';
import { createMockTaskContext } from '@/__tests__/mocks/contexts';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useTask context
vi.mock('@/contexts/TaskContext', () => ({
  useTask: vi.fn(),
}));

// Mock useTaskState from taskStore
vi.mock('@/stores/taskStore', () => ({
  useTaskState: vi.fn(),
  EMPTY_TASK_STATE: {
    loading: false,
    loaded: false,
    tokensInfo: null,
    question: null,
    todoItems: [],
    allFiles: [],
    autocompletionWords: [],
    aiderTotalCost: 0,
    contextFiles: [],
    aiderModelsData: null,
  },
}));

describe('TaskSidebar Subtasks', () => {
  const mockTasks = [{ id: 'parent-1', name: 'Parent 1', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z', parentId: null }] as TaskData[];

  beforeEach(() => {
    vi.mocked(useTask).mockReturnValue(createMockTaskContext());
    vi.mocked(useTaskState).mockReturnValue(EMPTY_TASK_STATE);
    localStorage.clear();
  });

  it('calls createNewTask with parentId when subtask plus button is clicked', () => {
    const createNewTask = vi.fn();
    render(
      <TaskSidebar
        loading={false}
        tasks={mockTasks}
        activeTaskId="parent-1"
        onTaskSelect={vi.fn()}
        createNewTask={createNewTask}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    const createSubtaskButton = screen.getByTestId('create-subtask-parent-1');
    fireEvent.click(createSubtaskButton);

    expect(createNewTask).toHaveBeenCalledWith('parent-1');
  });

  it('automatically expands parent when activeTaskId is a subtask', async () => {
    const tasks = [
      { id: 'parent-1', name: 'Parent 1', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
      { id: 'child-1', name: 'Child 1', createdAt: '2023-01-02T00:00:00Z', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1' },
    ] as TaskData[];

    const { rerender } = render(
      <TaskSidebar loading={false} tasks={tasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />,
    );

    // Initially child should not be visible if not expanded
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();

    // Change activeTaskId to child-1
    rerender(<TaskSidebar loading={false} tasks={tasks} activeTaskId="child-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    // Now child should be visible because parent should be automatically expanded
    expect(screen.getByText('Child 1')).toBeInTheDocument();
  });
});
