import { ReactNode } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskData } from '@common/types';

import { TaskSidebar } from '../TaskSidebar';

import { render } from '@/__tests__/render';
import { useTask } from '@/contexts/TasksContext';
import { useTaskState, EMPTY_TASK_STATE } from '@/stores/taskStore';
import { createMockTaskContext } from '@/__tests__/mocks/contexts';

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

// Mock useTask context
vi.mock('@/contexts/TasksContext', () => ({
  useTask: vi.fn(),
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

interface IconButtonProps {
  onClick?: () => void;
  icon: ReactNode;
  tooltip?: string;
}

// Mock IconButton and other components if needed
vi.mock('@/components/common/IconButton', () => ({
  IconButton: ({ onClick, icon, tooltip }: IconButtonProps) => (
    <button onClick={onClick} title={tooltip}>
      {icon}
    </button>
  ),
}));

describe('TaskSidebar', () => {
  const mockTasks = [
    { id: 'task-1', name: 'Task 1', createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z' },
    { id: 'task-2', name: 'Task 2', createdAt: '2023-01-02T00:00:00Z', updatedAt: '2023-01-02T00:00:00Z' },
  ] as TaskData[];

  beforeEach(() => {
    vi.mocked(useTask).mockReturnValue(createMockTaskContext());
    vi.mocked(useTaskState).mockReturnValue(EMPTY_TASK_STATE);
  });

  it('renders a list of tasks', () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="task-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('calls onTaskSelect when a task is clicked', () => {
    const onTaskSelect = vi.fn();
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="task-1" onTaskSelect={onTaskSelect} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    fireEvent.click(screen.getByText('Task 2'));
    expect(onTaskSelect).toHaveBeenCalledWith('task-2');
  });

  it('calls createNewTask when plus button is clicked', () => {
    const createNewTask = vi.fn();
    render(
      <TaskSidebar
        loading={false}
        tasks={mockTasks}
        activeTaskId="task-1"
        onTaskSelect={vi.fn()}
        createNewTask={createNewTask}
        isCollapsed={false}
        onToggleCollapse={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('create-task-button'));
    expect(createNewTask).toHaveBeenCalled();
  });

  it('filters tasks based on search query', async () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="task-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    fireEvent.click(screen.getByTestId('search-toggle-button'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('taskSidebar.searchPlaceholder')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('taskSidebar.searchPlaceholder'), {
      target: { value: 'Task 1' },
    });

    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.queryByText('Task 2')).not.toBeInTheDocument();
    });
  });

  it('sorts tasks by updatedAt descending', () => {
    const tasks = [
      { id: 'task-1', name: 'Task 1', updatedAt: '2023-01-01T00:00:00Z' },
      { id: 'task-2', name: 'Task 2', updatedAt: '2023-01-02T00:00:00Z' },
    ] as TaskData[];

    const { container } = render(
      <TaskSidebar loading={false} tasks={tasks} activeTaskId="task-2" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />,
    );

    const taskItems = container.querySelectorAll('[data-task-id]');
    expect(taskItems[0]).toHaveAttribute('data-task-id', 'task-2');
    expect(taskItems[1]).toHaveAttribute('data-task-id', 'task-1');
  });

  it('hides archived tasks by default', () => {
    const tasks = [
      { id: 'task-1', name: 'Task 1', archived: false },
      { id: 'task-2', name: 'Task 2', archived: true },
    ] as TaskData[];

    render(<TaskSidebar loading={false} tasks={tasks} activeTaskId="task-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.queryByText('Task 2')).not.toBeInTheDocument();
  });
});
