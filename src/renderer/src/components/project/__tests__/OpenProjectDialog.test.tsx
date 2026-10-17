/* eslint-disable no-console */
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { ProjectCheckResult } from '@common/types';
import { ApplicationAPI } from '@common/api';

import { OpenProjectDialog } from '../OpenProjectDialog';

import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';

// Suppress HotkeysProvider warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('HotkeysProvider')) {
      return;
    }
    originalConsoleError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('HotkeysProvider')) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

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
    checkProject: vi.fn((): Promise<ProjectCheckResult> => Promise.resolve({ agents: [], mcpServers: [], extensions: [] })),
    getOpenProjects: vi.fn(() => Promise.resolve([])),
    getRecentProjects: vi.fn((): Promise<string[]> => Promise.resolve([])),
    addRecentProject: vi.fn(),
    removeRecentProject: vi.fn(),
    openDirectory: vi.fn(() => Promise.resolve('/selected/path')),
    isOpenDialogSupported: vi.fn(() => true),
    getFilePathSuggestions: vi.fn(() => Promise.resolve([])),
    isProjectPath: vi.fn(() => Promise.resolve(false)),
    cloneProject: vi.fn(() => Promise.resolve('/cloned/project')),
    cancelCloneProject: vi.fn(() => Promise.resolve()),
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: false, filePaths: ['/selected/path'] })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.checkProject.mockResolvedValue({ agents: [], mcpServers: [], extensions: [] });
    mockApi.getRecentProjects.mockResolvedValue([]);
    localStorage.clear();
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

    await waitFor(() => expect(onAddProject).toHaveBeenCalledWith('/some/path'));
  });

  it('switches to clone mode and clones a repository', async () => {
    const onAddProject = vi.fn();
    const onClose = vi.fn();
    render(<OpenProjectDialog onClose={onClose} onAddProject={onAddProject} openProjects={[]} />);

    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));

    const input = screen.getByTestId('repository-url-input');
    expect(input).toBeInTheDocument();

    const cloneButton = screen.getByText('common.clone');
    expect(cloneButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo.git' } });
    fireEvent.change(screen.getByPlaceholderText('dialogs.cloneDestinationPlaceholder'), { target: { value: '/custom/projects' } });

    await waitFor(() => {
      expect(screen.getByText('common.clone')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('common.clone'));

    await waitFor(() => {
      expect(mockApi.cloneProject).toHaveBeenCalledWith('https://github.com/owner/repo.git', '/custom/projects');
    });
    expect(onAddProject).toHaveBeenCalledWith('/cloned/project');
    expect(onClose).toHaveBeenCalled();
  });

  it('clones an SSH repository', async () => {
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={vi.fn()} openProjects={[]} />);

    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));
    const input = screen.getByTestId('repository-url-input');
    fireEvent.change(input, { target: { value: 'ftp://github.com/owner/repo.git' } });
    expect(screen.getByText('common.clone')).toBeDisabled();

    fireEvent.change(input, { target: { value: 'git@github.com:owner/repo.git' } });

    await waitFor(() => {
      expect(screen.getByText('common.clone')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('common.clone'));

    await waitFor(() => {
      expect(mockApi.cloneProject).toHaveBeenCalledWith('git@github.com:owner/repo.git', undefined);
    });
  });

  it('preloads and clears the saved clone destination', async () => {
    localStorage.setItem('aider-desk-clone-destination', '/custom/projects');
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={vi.fn()} openProjects={[]} />);

    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));

    const destinationInput = screen.getByPlaceholderText('dialogs.cloneDestinationPlaceholder');
    expect(destinationInput).toHaveValue('/custom/projects');
    expect(destinationInput).toHaveAttribute('placeholder', 'dialogs.cloneDestinationPlaceholder');

    fireEvent.change(destinationInput, { target: { value: '' } });

    expect(destinationInput).toHaveValue('');
    expect(localStorage.getItem('aider-desk-clone-destination')).toBeNull();

    fireEvent.change(screen.getByTestId('repository-url-input'), { target: { value: 'https://github.com/owner/repo.git' } });
    fireEvent.click(screen.getByText('common.clone'));

    await waitFor(() => {
      expect(mockApi.cloneProject).toHaveBeenCalledWith('https://github.com/owner/repo.git', undefined);
    });
  });

  it('shows error and keeps dialog open when cloning fails', async () => {
    mockApi.cloneProject.mockRejectedValue(new Error('repository not found'));
    const onAddProject = vi.fn();
    const onClose = vi.fn();
    render(<OpenProjectDialog onClose={onClose} onAddProject={onAddProject} openProjects={[]} />);

    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));

    const input = screen.getByTestId('repository-url-input');
    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo.git' } });

    await waitFor(() => {
      expect(screen.getByText('common.clone')).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('common.clone'));

    await waitFor(() => {
      expect(screen.getByTestId('clone-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('clone-error')).toHaveTextContent('repository not found');
    expect(onAddProject).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows cloning view with tabs hidden and cancels the clone', async () => {
    const onClose = vi.fn();
    let resolveClone: ((path: string) => void) | undefined;
    mockApi.cloneProject.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveClone = resolve;
        }),
    );
    render(<OpenProjectDialog onClose={onClose} onAddProject={vi.fn()} openProjects={[]} />);

    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));
    fireEvent.change(screen.getByTestId('repository-url-input'), { target: { value: 'https://github.com/owner/repo.git' } });

    await waitFor(() => {
      expect(screen.getByText('common.clone')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByText('common.clone'));

    await waitFor(() => {
      expect(screen.getByText('dialogs.cloningProject')).toBeInTheDocument();
    });
    expect(screen.queryByText('dialogs.cloneFromGit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

    expect(mockApi.cancelCloneProject).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    resolveClone?.('/cloned/project');
  });
  const requestLocalProject = async () => {
    mockApi.isProjectPath.mockResolvedValue(true);
    fireEvent.change(screen.getByPlaceholderText('dialogs.projectPathPlaceholder'), { target: { value: '/some/path' } });
    await waitFor(() => expect(screen.getByText('common.open')).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(screen.getByText('common.open'));
    });
  };

  it('requires explicit trust before opening a project with local configuration', async () => {
    mockApi.checkProject.mockResolvedValue({
      agents: [{ name: 'default', path: '.aider-desk/agents/default' }],
      mcpServers: [{ name: 'test-server', path: '.aider-desk/mcp-servers.json' }],
      extensions: [{ name: 'test-extension', path: '.aider-desk/extensions/test.ts' }],
    });
    const onAddProject = vi.fn();
    const onClose = vi.fn();
    render(<OpenProjectDialog onClose={onClose} onAddProject={onAddProject} openProjects={[]} />);
    await requestLocalProject();
    await screen.findByText('projectTrust.title');
    expect(screen.getByText('test-server')).toBeInTheDocument();
    expect(screen.getByText('test-extension')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(onAddProject).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('projectTrust.confirm')).toHaveClass('bg-button-danger');
    fireEvent.click(screen.getByText('projectTrust.confirm'));
    expect(onAddProject).toHaveBeenCalledWith('/some/path');
    expect(onClose).toHaveBeenCalled();
  });

  it('cancels opening when project trust is declined', async () => {
    mockApi.checkProject.mockResolvedValue({ agents: [], mcpServers: [], extensions: [{ name: 'test', path: 'test.ts' }] });
    const onAddProject = vi.fn();
    const onClose = vi.fn();
    render(<OpenProjectDialog onClose={onClose} onAddProject={onAddProject} openProjects={[]} />);
    await requestLocalProject();
    await screen.findByText('projectTrust.title');
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onAddProject).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('blocks opening and shows an error when inspection fails', async () => {
    mockApi.checkProject.mockRejectedValue(new Error('invalid configuration'));
    const onAddProject = vi.fn();
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);
    await requestLocalProject();
    expect(await screen.findByRole('alert')).toHaveTextContent('projectTrust.checkFailed');
    expect(onAddProject).not.toHaveBeenCalled();
  });

  it('checks recent projects before opening', async () => {
    mockApi.getRecentProjects.mockResolvedValue(['/recent/project']);
    const onAddProject = vi.fn();
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);
    await screen.findByText('dialogs.recentProjects');
    fireEvent.click(screen.getByText('dialogs.recentProjects'));
    fireEvent.click(await screen.findByText('/recent/project'));
    await waitFor(() => expect(onAddProject).toHaveBeenCalledWith('/recent/project'));
    expect(mockApi.checkProject).toHaveBeenCalledWith('/recent/project');
  });

  it('does not open a project after an in-flight check is cancelled', async () => {
    let resolveCheck: ((result: ProjectCheckResult) => void) | undefined;
    mockApi.checkProject.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    const onAddProject = vi.fn();
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);
    await requestLocalProject();
    await screen.findByText('projectTrust.checking');
    fireEvent.click(screen.getByText('common.cancel'));
    await act(async () => {
      resolveCheck?.({ agents: [], mcpServers: [], extensions: [] });
    });
    await waitFor(() => expect(screen.queryByText('projectTrust.checking')).not.toBeInTheDocument());
    expect(onAddProject).not.toHaveBeenCalled();
  });

  it('requires trust for a cloned project before opening it', async () => {
    mockApi.cloneProject.mockResolvedValue('/cloned/project');
    mockApi.checkProject.mockResolvedValue({
      agents: [{ name: 'default', path: '.aider-desk/agents/default' }],
      mcpServers: [],
      extensions: [],
    });
    const onAddProject = vi.fn();
    render(<OpenProjectDialog onClose={vi.fn()} onAddProject={onAddProject} openProjects={[]} />);
    fireEvent.click(screen.getByText('dialogs.cloneFromGit'));
    fireEvent.change(screen.getByTestId('repository-url-input'), { target: { value: 'https://github.com/owner/repo.git' } });
    fireEvent.click(screen.getByText('common.clone'));
    await screen.findByText('projectTrust.title');
    expect(mockApi.checkProject).toHaveBeenCalledWith('/cloned/project');
    expect(onAddProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('projectTrust.confirm'));
    expect(onAddProject).toHaveBeenCalledWith('/cloned/project');
  });
});
