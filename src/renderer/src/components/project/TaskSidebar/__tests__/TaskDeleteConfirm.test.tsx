import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TaskDeleteConfirm } from '../TaskDeleteConfirm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => (options?.count !== undefined ? `${key}:${options.count}` : key),
  }),
}));

describe('TaskDeleteConfirm', () => {
  it('shows the subtask count when the task has subtasks', () => {
    render(<TaskDeleteConfirm taskId="task-1" getAllSubtasksCount={() => 3} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('taskSidebar.deleteConfirmWithSubtasks:3')).toBeInTheDocument();
  });

  it('shows the plain confirmation when the task has no subtasks', () => {
    render(<TaskDeleteConfirm taskId="task-1" getAllSubtasksCount={() => 0} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('taskSidebar.deleteConfirm')).toBeInTheDocument();
  });

  it('counts subtasks only once when shown, not on re-renders', () => {
    const getAllSubtasksCount = vi.fn(() => 2);
    const onCancel = vi.fn();
    const { rerender } = render(<TaskDeleteConfirm taskId="task-1" getAllSubtasksCount={getAllSubtasksCount} onConfirm={vi.fn()} onCancel={onCancel} />);

    rerender(<TaskDeleteConfirm taskId="task-1" getAllSubtasksCount={getAllSubtasksCount} onConfirm={vi.fn()} onCancel={onCancel} />);

    expect(getAllSubtasksCount).toHaveBeenCalledTimes(1);
    expect(getAllSubtasksCount).toHaveBeenCalledWith('task-1');
  });

  it('calls onConfirm with the task id and onCancel on cancel', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(<TaskDeleteConfirm taskId="task-1" getAllSubtasksCount={() => 0} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('common.confirm'));
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onConfirm).toHaveBeenCalledWith('task-1');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
