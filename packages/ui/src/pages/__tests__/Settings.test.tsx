import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsData } from '@aider-desk/common/types';

import { Settings } from '../Settings';

import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useApi
vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

// Mock sub-settings components
vi.mock('@/components/settings/GeneralSettings', () => ({
  GeneralSettings: () => <div data-testid="general-settings">General Settings</div>,
}));
vi.mock('@/components/settings/AiderSettings', () => ({
  AiderSettings: () => <div data-testid="aider-settings">Aider Settings</div>,
}));
vi.mock('@/components/settings/agent/AgentSettings', () => ({
  AgentSettings: () => <div data-testid="agent-settings">Agent Settings</div>,
}));
vi.mock('@/components/settings/AboutSettings', () => ({
  AboutSettings: () => <div data-testid="about-settings">About Settings</div>,
}));
vi.mock('@/components/settings/MemorySettings', () => ({
  MemorySettings: () => <div data-testid="memory-settings">Memory Settings</div>,
}));
vi.mock('@/components/settings/VoiceSettings', () => ({
  VoiceSettings: () => <div data-testid="voice-settings">Voice Settings</div>,
}));
vi.mock('@/components/settings/ServerSettings', () => ({
  ServerSettings: () => <div data-testid="server-settings">Server Settings</div>,
}));

describe('Settings', () => {
  const mockSettings = { language: 'en', theme: 'dark' } as SettingsData;
  const mockApi = createMockApi();

  beforeEach(() => {
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  it('renders general settings by default', () => {
    render(
      <Settings
        settings={mockSettings as SettingsData}
        updateSettings={vi.fn()}
        onLanguageChange={vi.fn()}
        onZoomChange={vi.fn()}
        onThemeChange={vi.fn()}
        onFontChange={vi.fn()}
        onFontSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('general-settings')).toBeInTheDocument();
  });

  it('switches to aider settings when clicked', () => {
    render(
      <Settings
        settings={mockSettings}
        updateSettings={vi.fn()}
        onLanguageChange={vi.fn()}
        onZoomChange={vi.fn()}
        onThemeChange={vi.fn()}
        onFontChange={vi.fn()}
        onFontSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('settings.tabs.aider'));
    expect(screen.getByTestId('aider-settings')).toBeInTheDocument();
  });

  it('renders initial page based on initialPageId', () => {
    render(
      <Settings
        settings={mockSettings}
        updateSettings={vi.fn()}
        onLanguageChange={vi.fn()}
        onZoomChange={vi.fn()}
        onThemeChange={vi.fn()}
        onFontChange={vi.fn()}
        onFontSizeChange={vi.fn()}
        initialPageId="about"
      />,
    );

    expect(screen.getByTestId('about-settings')).toBeInTheDocument();
  });
});
