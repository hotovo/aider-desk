import { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsData } from '@aider-desk/common/types';
import { ApplicationAPI } from '@aider-desk/common/api';

import { SettingsPage } from '../SettingsPage';

import { useSettings } from '@/contexts/SettingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useApi } from '@/contexts/ApiContext';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock contexts
vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/contexts/AgentsContext', () => ({
  useAgents: vi.fn(),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

// Mock components
vi.mock('../../common/ModalOverlayLayout', () => ({
  ModalOverlayLayout: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="modal-overlay">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../../../pages/Settings', () => ({
  Settings: ({ updateSettings }: { updateSettings: (settings: Partial<SettingsData>) => void }) => (
    <div data-testid="settings-content">
      <button onClick={() => updateSettings({ language: 'zh' })}>Change Language</button>
    </div>
  ),
}));

describe('SettingsPage', () => {
  const mockSettings = { language: 'en', theme: 'dark', mcpServers: {} } as SettingsData;
  const mockSaveSettings = vi.fn();
  const mockApi = {
    getProviders: vi.fn(() => Promise.resolve([])),
    updateProviders: vi.fn(() => Promise.resolve([])),
    setZoomLevel: vi.fn(),
    reloadMcpServers: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useSettings).mockReturnValue({
      settings: mockSettings,
      saveSettings: mockSaveSettings,
      theme: 'dark',
      setTheme: vi.fn(),
      font: 'Sono',
      setFont: vi.fn(),
      fontSize: 14,
      setFontSize: vi.fn(),
    });

    vi.mocked(useAgents).mockReturnValue({
      profiles: [],
      loading: false,
      error: null,
      getProfiles: vi.fn(() => []),
      createProfile: vi.fn(),
      updateProfile: vi.fn(),
      deleteProfile: vi.fn(),
      refreshProfiles: vi.fn(),
      updateProfilesOrder: vi.fn(),
    });

    vi.mocked(useApi).mockReturnValue(mockApi as unknown as ApplicationAPI);
  });

  it('renders and loads providers', async () => {
    await act(async () => {
      render(<SettingsPage onClose={vi.fn()} />);
    });
    expect(screen.getByText('settings.title')).toBeInTheDocument();
    expect(mockApi.getProviders).toHaveBeenCalled();
  });

  it('calls saveSettings when Save is clicked after changes', async () => {
    render(<SettingsPage onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('Change Language'));

    // Save button should be enabled now
    const saveButton = screen.getByText('common.save');
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'zh' }));
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    render(<SettingsPage onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getByText('common.cancel'));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
