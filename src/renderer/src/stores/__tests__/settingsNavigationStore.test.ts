import { beforeEach, describe, expect, it } from 'vitest';

import { closeSettings, openSettingsPage, useSettingsNavigationStore } from '../settingsNavigationStore';

describe('settingsNavigationStore', () => {
  beforeEach(() => {
    useSettingsNavigationStore.setState({ settingsPage: null });
  });

  it('opens a settings page without options', () => {
    openSettingsPage('mcpServers');

    expect(useSettingsNavigationStore.getState().settingsPage).toEqual({ pageId: 'mcpServers' });
  });

  it('opens a settings page with options', () => {
    openSettingsPage('agents', { agentProfileId: 'profile-1' });

    expect(useSettingsNavigationStore.getState().settingsPage).toEqual({ pageId: 'agents', options: { agentProfileId: 'profile-1' } });
  });

  it('closes the settings page', () => {
    openSettingsPage('general');
    closeSettings();

    expect(useSettingsNavigationStore.getState().settingsPage).toBeNull();
  });
});
