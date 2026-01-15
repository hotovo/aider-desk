import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskData } from '@common/types';

import { TaskSidebar } from '../TaskSidebar';

import { useTaskState, EMPTY_TASK_STATE } from '@/stores/taskStore';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

describe('TaskSidebar Hierarchy', () => {
  const mockTasks = [
    { id: 'parent-1', name: 'Parent 1', updatedAt: '2023-01-01T00:00:00Z', parentId: null },
    { id: 'child-1', name: 'Child 1', updatedAt: '2023-01-02T00:00:00Z', parentId: 'parent-1' },
  ] as TaskData[];

  beforeEach(() => {
    vi.mocked(useTaskState).mockReturnValue(EMPTY_TASK_STATE);
    localStorage.clear();
  });

  it('renders chevron for parent tasks', () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    // Chevron should be visible for parent-1
    expect(screen.getByTestId('chevron-parent-1')).toBeInTheDocument();
  });

  it('toggles subtask visibility when chevron is clicked', async () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    // Initially child-1 should be visible (default expanded or handled by state)
    // Let's assume default is collapsed if not in localStorage
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();

    const chevron = screen.getByTestId('chevron-parent-1');

    // Wrap state update in act()
    await act(async () => {
      fireEvent.click(chevron);
    });

    expect(screen.getByText('Child 1')).toBeInTheDocument();
  });

  it('persists expanded state in localStorage', async () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    const chevron = screen.getByTestId('chevron-parent-1');

    // Wrap state update in act()
    await act(async () => {
      fireEvent.click(chevron);
    });

    const stored = JSON.parse(localStorage.getItem('aider-desk-expanded-tasks') || '[]');
    expect(stored).toContain('parent-1');
  });

  it('shows "+ create subtask" button on hover for parent tasks', () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    // The button might only be visible on hover in CSS, but it should be in the DOM
    expect(screen.getByTestId('create-subtask-parent-1')).toBeInTheDocument();
  });

  it('moves "Pin" button to dropdown menu', () => {
    render(<TaskSidebar loading={false} tasks={mockTasks} activeTaskId="parent-1" onTaskSelect={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);

    // Pin should NOT be in the hover actions anymore (or at least not the main one)
    // Actually, the AC says "The Pin action should be moved to the dropdown menu (⋮)"
    // And "+ create subtask" should replace it in hover actions.

    // Check that pin button is NOT visible in the hover actions row
    expect(screen.queryByTestId('pin-button-parent-1')).not.toBeInTheDocument();
  });
});
