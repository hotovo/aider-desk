import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MessageActions } from '../MessageActions';

import { render } from '@/__tests__/render';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
  useIsReadonlyView: vi.fn(() => false),
}));

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: vi.fn(() => false),
}));

describe('MessageActions', () => {
  const mockApi = createMockApi();

  const defaultProps = {
    actions: [{ id: 'resolve-git-error-with-agent' }],
    baseDir: '/project',
    taskId: 'task-123',
    removeActionId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  it('renders the Resolve with AI button for resolve-git-error-with-agent action', () => {
    render(<MessageActions {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'git.resolveWithAI' })).toBeInTheDocument();
  });

  it('calls resolveGitErrorWithAgent and removeActionId when the button is clicked', () => {
    render(<MessageActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    expect(mockApi.resolveGitErrorWithAgent).toHaveBeenCalledWith('/project', 'task-123');
    expect(defaultProps.removeActionId).toHaveBeenCalledWith('resolve-git-error-with-agent');
  });

  it('hides the button after execution', () => {
    render(<MessageActions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    expect(screen.queryByRole('button', { name: 'git.resolveWithAI' })).not.toBeInTheDocument();
  });

  it('renders nothing when actions is empty', () => {
    render(<MessageActions {...defaultProps} actions={[]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not call removeActionId when the prop is not provided', () => {
    const { removeActionId: _omitted, ...propsWithoutRemoveActionId } = defaultProps;
    render(<MessageActions {...propsWithoutRemoveActionId} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    expect(mockApi.resolveGitErrorWithAgent).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, { requestId: 'request-1', nested: [true, null, 1] }])('does not pass the action as an interrupt ID: %j', (data) => {
    const onInterrupt = vi.fn();
    const action = { id: 'interrupt', data };
    render(<MessageActions {...defaultProps} actions={[action]} onInterrupt={onInterrupt} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(onInterrupt).toHaveBeenCalledExactlyOnceWith();
  });

  it('cancels the current response without supplying an interrupt ID', () => {
    const onInterrupt = (interruptId?: string) => {
      void mockApi.interruptResponse('/project', 'task-123', interruptId);
    };
    render(<MessageActions {...defaultProps} actions={[{ id: 'interrupt' }]} onInterrupt={onInterrupt} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(mockApi.interruptResponse).toHaveBeenCalledExactlyOnceWith('/project', 'task-123', undefined);
  });

  it('preserves existing API behavior when an action includes data', () => {
    render(<MessageActions {...defaultProps} actions={[{ id: 'resolve-git-error-with-agent', data: { reason: 'conflict' } }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    expect(mockApi.resolveGitErrorWithAgent).toHaveBeenCalledExactlyOnceWith('/project', 'task-123');
    expect(defaultProps.removeActionId).toHaveBeenCalledExactlyOnceWith('resolve-git-error-with-agent');
  });

  it('ignores unknown actions', () => {
    render(<MessageActions {...defaultProps} actions={[{ id: 'unknown', data: 42 }]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
