import { screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodoItem } from '@common/types';

import { TodoWindow } from '../TodoWindow';

vi.mock('@/stores/taskStore', () => ({
  useTaskTodoItems: vi.fn(),
}));

import { render } from '@/__tests__/render';
import { useTaskTodoItems } from '@/stores/taskStore';

const mockedUseTaskTodoItems = vi.mocked(useTaskTodoItems);

const todo = (name: string, completed = false): TodoItem => ({ name, completed });

const BaseProps = { onClearAllTodos: vi.fn() };

describe('TodoWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there are no todos', () => {
    mockedUseTaskTodoItems.mockReturnValue([]);
    const { container } = render(<TodoWindow taskId="task-1" {...BaseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows expanded todo list when there are incomplete items', () => {
    mockedUseTaskTodoItems.mockReturnValue([todo('First'), todo('Second')]);
    render(<TodoWindow taskId="task-1" {...BaseProps} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('auto-collapses when all items are completed', () => {
    mockedUseTaskTodoItems.mockReturnValue([todo('First', true), todo('Second')]);
    const { rerender } = render(<TodoWindow taskId="task-1" {...BaseProps} />);
    expect(screen.getByText('First')).toBeInTheDocument();

    act(() => {
      mockedUseTaskTodoItems.mockReturnValue([todo('First', true), todo('Second', true)]);
      rerender(<TodoWindow taskId="task-1" {...BaseProps} />);
    });

    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });

  it('auto-expands again when a completed list is replaced with new items', () => {
    mockedUseTaskTodoItems.mockReturnValue([todo('First', true), todo('Second', true)]);
    const { rerender } = render(<TodoWindow taskId="task-1" {...BaseProps} />);
    expect(screen.queryByText('First')).not.toBeInTheDocument();

    act(() => {
      mockedUseTaskTodoItems.mockReturnValue([todo('New First'), todo('New Second')]);
      rerender(<TodoWindow taskId="task-1" {...BaseProps} />);
    });

    expect(screen.getByText('New First')).toBeInTheDocument();
    expect(screen.getByText('New Second')).toBeInTheDocument();
  });

  it('auto-expands again when items are cleared and a new set arrives', () => {
    mockedUseTaskTodoItems.mockReturnValue([todo('First', true), todo('Second', true)]);
    const { rerender } = render(<TodoWindow taskId="task-1" {...BaseProps} />);
    expect(screen.queryByText('First')).not.toBeInTheDocument();

    act(() => {
      mockedUseTaskTodoItems.mockReturnValue([]);
      rerender(<TodoWindow taskId="task-1" {...BaseProps} />);
    });

    act(() => {
      mockedUseTaskTodoItems.mockReturnValue([todo('New First')]);
      rerender(<TodoWindow taskId="task-1" {...BaseProps} />);
    });

    expect(screen.getByText('New First')).toBeInTheDocument();
  });
});
