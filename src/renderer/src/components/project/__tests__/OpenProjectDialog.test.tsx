import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationAPI } from '@common/api';

import { OpenProjectDialog } from '../OpenProjectDialog';

import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/hooks/useConfiguredHotkeys', async () => {
  const { getHotkeys } = await import('@/utils/hotkeys');

  return {
    useConfiguredHotkeys: () => getHotkeys(),
  };
});

describe('OpenProjectDialog', () => {
  const mockApi = {
    getOpenProjects: vi.fn(() => Promise.resolve([])),
    getRecentProjects: vi.fn(() => Promise.resolve([])),
    addRecentProject: vi.fn(),
    removeRecentProject: vi.fn(),
    openDirectory: vi.fn(() => Promise.resolve('/selected/path')),
    isOpenDialogSupported: vi.fn(() => true),
    getFilePathSuggestions: vi.fn(() => Promise.resolve([])),
    isProjectPath: vi.fn(() => Promise.resolve(false)),
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/selected/path'] })),
  };

  beforeEach(() => {
    vi.mocked(useApi).mockReturnValue(mockApi as unknown as ApplicationAPI);
  });

  it('renders and allows browsing for a project', async () => {
    const onAddProject = vi.fn();
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);

    expect(screen.getByText('dialogs.openProjectTitle')).toBeInTheDocument();

    const browseButton = screen.getByTestId('browse-folder-button');
    fireEvent.click(browseButton);

    await waitFor(() => {
      expect(mockApi.showOpenDialog).toHaveBeenCalled();
    });
  });

  it('calls onAddProject when a path is entered and Open is clicked', async () => {
    const onAddProject = vi.fn();
    mockApi.isProjectPath.mockResolvedValue(true);

    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);

    const input = screen.getByPlaceholderText('dialogs.projectPathPlaceholder');
    fireEvent.change(input, { target: { value: '/some/path' } });

    // Wait for validation
    await waitFor(() => {
      const openButton = screen.getByText('common.open');
      expect(openButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('common.open'));

    expect(onAddProject).toHaveBeenCalledWith('/some/path');
  });
});
