import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitInitButton } from '../GitInitButton';

import { showInfoNotification, showErrorNotification } from '@/utils/notifications';
import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/utils/notifications', () => ({
  showErrorNotification: vi.fn(),
  showInfoNotification: vi.fn(),
}));

const defaultProps = {
  baseDir: '/project',
  taskId: 'task-123',
  onInitialized: vi.fn(),
};

describe('GitInitButton', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  it('calls initializeGitRepository and signals the parent on success', async () => {
    render(<GitInitButton {...defaultProps} />);

    const button = screen.getByText('git.initializeGit').closest('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockApi.initializeGitRepository).toHaveBeenCalledWith('/project', 'task-123');
      expect(showInfoNotification).toHaveBeenCalledWith('git.gitInitialized');
      expect(defaultProps.onInitialized).toHaveBeenCalled();
    });
  });

  it('shows an error notification and does not signal the parent on failure', async () => {
    mockApi.initializeGitRepository = vi.fn().mockRejectedValue(new Error('init failed'));
    render(<GitInitButton {...defaultProps} />);

    const button = screen.getByText('git.initializeGit').closest('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(showErrorNotification).toHaveBeenCalledWith('init failed');
      expect(defaultProps.onInitialized).not.toHaveBeenCalled();
    });
  });

  it('disables the button while initializing', async () => {
    mockApi.initializeGitRepository = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<GitInitButton {...defaultProps} />);

    const button = screen.getByText('git.initializeGit').closest('button')!;
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByText('git.initializingGit')).toBeInTheDocument();
    });
  });
});
