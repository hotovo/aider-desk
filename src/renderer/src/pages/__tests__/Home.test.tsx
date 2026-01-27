import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { ApplicationAPI } from '@common/api';
import { ProjectData } from '@common/types';

import { Home } from '../Home';

import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

// Mock contexts
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/hooks/useVersions', () => ({
  useVersions: () => ({
    versions: {},
  }),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {},
  }),
}));

vi.mock('@/hooks/useConfiguredHotkeys', async () => {
  const { getHotkeys } = await import('@/utils/hotkeys');

  return {
    useConfiguredHotkeys: () => getHotkeys(),
  };
});

// Mock components
vi.mock('@/components/project/ProjectTabs', () => ({
  ProjectTabs: () => <div data-testid="project-tabs" />,
}));

vi.mock('@/components/project/ProjectView', () => ({
  ProjectView: () => <div data-testid="project-view" />,
}));

vi.mock('@/components/settings/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="settings-page" />,
}));

vi.mock('@/components/project/NoProjectsOpen', () => ({
  NoProjectsOpen: () => <div data-testid="no-projects" />,
}));

vi.mock('@/components/ModelLibrary', () => ({
  ModelLibrary: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="model-library">
      <button onClick={onClose}>Close Model Library</button>
    </div>
  ),
}));

vi.mock('@/components/common/IconButton', () => ({
  IconButton: ({ onClick, tooltip }: { onClick?: () => void; tooltip?: string }) => (
    <button onClick={onClick} title={tooltip}>
      Icon
    </button>
  ),
}));

vi.mock('@/components/common/StyledTooltip', () => ({
  StyledTooltip: () => <div data-testid="styled-tooltip" />,
}));

describe('Home', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockApi = createMockApi({
      getOpenProjects: vi.fn(() => Promise.resolve([])),
    });
    vi.mocked(useApi).mockReturnValue(mockApi as unknown as ApplicationAPI);
  });

  it('renders and shows NoProjectsOpen when no projects are loaded', async () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['home']}>
        <Home />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-projects')).toBeInTheDocument();
    });
  });

  it('opens Model Library when icon is clicked', async () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['home']}>
        <Home />
      </HotkeysProvider>,
    );

    const modelLibraryButton = screen.getByTitle('projectBar.modelLibrary');
    await act(async () => {
      fireEvent.click(modelLibraryButton);
    });

    expect(screen.getByTestId('model-library')).toBeInTheDocument();
  });

  it('switches between projects using Ctrl+Tab', async () => {
    const mockProjects = [
      { baseDir: '/project/1', active: true },
      { baseDir: '/project/2', active: false },
    ] as ProjectData[];
    mockApi.getOpenProjects.mockResolvedValue(mockProjects);
    mockApi.setActiveProject.mockImplementation((baseDir) => {
      return Promise.resolve(mockProjects.map((p) => ({ ...p, active: p.baseDir === baseDir })));
    });

    render(
      <HotkeysProvider initiallyActiveScopes={['home']}>
        <Home />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('no-projects')).not.toBeInTheDocument();
    });

    // Simulate Ctrl+Tab
    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true });

    await waitFor(() => {
      expect(mockApi.setActiveProject).toHaveBeenCalledWith('/project/2');
    });
  });

  it('switches back to previous project on first Ctrl+Tab', async () => {
    const mockProjects = [
      { baseDir: '/project/1', active: true },
      { baseDir: '/project/2', active: false },
    ] as ProjectData[];
    mockApi.getOpenProjects.mockResolvedValue(mockProjects);

    render(
      <HotkeysProvider initiallyActiveScopes={['home']}>
        <Home />
      </HotkeysProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('no-projects')).not.toBeInTheDocument();
    });

    // First switch to Project 2
    mockApi.setActiveProject.mockResolvedValue([
      { baseDir: '/project/1', active: false },
      { baseDir: '/project/2', active: true },
    ] as ProjectData[]);

    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true });

    await waitFor(() => {
      expect(mockApi.setActiveProject).toHaveBeenCalledWith('/project/2');
    });

    // Now Ctrl+Tab again should go back to Project 1 (the previous one)
    fireEvent.keyDown(document, { key: 'Tab', ctrlKey: true });

    await waitFor(() => {
      expect(mockApi.setActiveProject).toHaveBeenCalledWith('/project/1');
    });
  });
});
