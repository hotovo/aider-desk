import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogMessage } from '@common/types';

import { LogMessageBlock } from '../LogMessageBlock';

import { render } from '@/__tests__/render';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { setMessages, useTaskStore } from '@/stores/taskStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
  useIsReadonlyView: vi.fn(() => false),
}));

vi.mock('../CopyMessageButton', () => ({
  CopyMessageButton: () => <div data-testid="copy-button" />,
}));

describe('LogMessageBlock', () => {
  const mockApi = createMockApi();

  const defaultProps = {
    baseDir: '/project',
    taskId: 'task-123',
  };

  const createLogMessage = (overrides: Partial<LogMessage> = {}): LogMessage => ({
    id: 'log-1',
    type: 'log',
    level: 'error',
    content: 'git error occurred',
    actions: [{ id: 'resolve-git-error-with-agent' }],
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi);
    setMessages('task-123', () => []);
  });

  it('renders the message content and the action button', () => {
    render(<LogMessageBlock {...defaultProps} message={createLogMessage()} />);

    expect(screen.getByText('git error occurred')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'git.resolveWithAI' })).toBeInTheDocument();
  });

  it('removes the action id from the stored message when the action is executed', async () => {
    setMessages('task-123', () => [createLogMessage()]);

    render(<LogMessageBlock {...defaultProps} message={createLogMessage()} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    await waitFor(() => {
      const storedMessage = useTaskStore
        .getState()
        .taskMessagesMap.get('task-123')
        ?.find((message) => message.id === 'log-1') as LogMessage | undefined;
      expect(storedMessage?.actions ?? []).not.toContainEqual({ id: 'resolve-git-error-with-agent' });
    });
  });

  it('uses the provided removeActionId prop when given', () => {
    const removeActionId = vi.fn();

    render(<LogMessageBlock {...defaultProps} message={createLogMessage()} removeActionId={removeActionId} />);

    fireEvent.click(screen.getByRole('button', { name: 'git.resolveWithAI' }));

    expect(removeActionId).toHaveBeenCalledWith('resolve-git-error-with-agent');
  });

  it('does not render actions in compact mode', () => {
    render(<LogMessageBlock {...defaultProps} message={createLogMessage()} compact />);

    expect(screen.queryByRole('button', { name: 'git.resolveWithAI' })).not.toBeInTheDocument();
  });
});
