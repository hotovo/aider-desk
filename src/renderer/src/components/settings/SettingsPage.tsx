import { ProjectData, ProviderProfile, SettingsData } from '@common/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/contexts/SettingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';

type Props = {
  onClose: () => void;
  initialPageId?: string;
  initialOptions?: Record<string, unknown>;
  openProjects?: ProjectData[];
};

export const SettingsPage = ({ onClose, initialPageId, initialOptions, openProjects }: Props) => {
  const { t, i18n } = useTranslation();
  const api = useApi();

  const { settings: originalSettings, saveSettings, setTheme, setFont, setFontSize } = useSettings();
  const { profiles: originalAgentProfiles, createProfile, updateProfile, deleteProfile, updateProfilesOrder } = useAgents();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);
  const [agentProfiles, setAgentProfiles] = useState(originalAgentProfiles);

  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [originalProviders, setOriginalProviders] = useState<ProviderProfile[]>([]);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await api.getProviders();
        setProviders(data);
        setOriginalProviders(data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load providers:', error);
      }
    };

    void loadProviders();
  }, [api]);

  useEffect(() => {
    setAgentProfiles(originalAgentProfiles);
  }, [originalAgentProfiles]);

  const hasChanges = useMemo(() => {
    const settingsChanged = localSettings && originalSettings && !isEqual(localSettings, originalSettings);
    const agentProfilesChanged = !isEqual(agentProfiles, originalAgentProfiles);
    const providersChanged = !isEqual(providers, originalProviders);
    return settingsChanged || agentProfilesChanged || providersChanged;
  }, [localSettings, originalSettings, agentProfiles, originalAgentProfiles, providers, originalProviders]);

  const handleCancel = useCallback(() => {
    if (originalSettings && localSettings?.language !== originalSettings.language) {
      void i18n.changeLanguage(originalSettings.language);
    }
    if (originalSettings && localSettings?.zoomLevel !== originalSettings.zoomLevel) {
      void api.setZoomLevel(originalSettings.zoomLevel ?? 1);
    }
    if (originalSettings && originalSettings.theme && localSettings?.theme !== originalSettings.theme) {
      setTheme(originalSettings.theme);
    }

    if (originalSettings && originalSettings.font && localSettings?.font !== originalSettings.font) {
      setFont(originalSettings.font);
    }

    if (originalSettings && originalSettings.fontSize && localSettings?.fontSize !== originalSettings.fontSize) {
      setFontSize(originalSettings.fontSize);
    }

    // Updated to use settings.mcpServers directly
    if (originalSettings && localSettings && !isEqual(localSettings.mcpServers, originalSettings.mcpServers)) {
      void api.reloadMcpServers(originalSettings.mcpServers || {});
    }

    setAgentProfiles(originalAgentProfiles);
    setProviders(originalProviders);
    onClose();
  }, [originalSettings, localSettings, i18n, api, setTheme, setFont, setFontSize, originalAgentProfiles, originalProviders, onClose]);

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
    }

    try {
      if (!isEqual(providers, originalProviders)) {
        const updatedProviders = await api.updateProviders(providers);
        setProviders(updatedProviders);
        setOriginalProviders(updatedProviders);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save providers:', error);
    }

    // Save agent profile changes
    try {
      // Find profiles that were added, updated, or deleted
      const originalProfileIds = new Set(originalAgentProfiles.map((p) => p.id));
      const currentProfileIds = new Set(agentProfiles.map((p) => p.id));

      // Handle deleted profiles
      for (const profileId of originalProfileIds) {
        if (!currentProfileIds.has(profileId)) {
          await deleteProfile(profileId, originalAgentProfiles.find((p) => p.id === profileId)?.projectDir);
        }
      }

      // Handle added and updated profiles
      for (const profile of agentProfiles) {
        if (!originalProfileIds.has(profile.id)) {
          // New profile
          await createProfile(profile, profile.projectDir);
        } else {
          // Updated profile - check if it actually changed
          const originalProfile = originalAgentProfiles.find((p) => p.id === profile.id);
          if (originalProfile && !isEqual(originalProfile, profile)) {
            await updateProfile(profile, profile.projectDir);
          }
        }
      }

      // Update profile order if needed
      if (
        !isEqual(
          agentProfiles.map((p) => p.id),
          originalAgentProfiles.map((p) => p.id),
        )
      ) {
        await updateProfilesOrder(agentProfiles);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save agent profiles:', error);
    }

    onClose();
  };

  useHotkeys(
    'esc',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [handleCancel],
  );

  const handleLanguageChange = (language: string) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        language,
      });
      void i18n.changeLanguage(language);
    }
  };

  const handleZoomChange = (zoomLevel: number) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        zoomLevel,
      });
      void api.setZoomLevel(zoomLevel);
    }
  };

  return (
    <ModalOverlayLayout title={t('settings.title')}>
      <div className="flex flex-col flex-1 min-h-0">
        {localSettings && (
          <Settings
            settings={localSettings}
            updateSettings={setLocalSettings}
            onLanguageChange={handleLanguageChange}
            onZoomChange={handleZoomChange}
            onThemeChange={setTheme}
            onFontChange={setFont}
            onFontSizeChange={setFontSize}
            initialPageId={initialPageId}
            initialOptions={initialOptions}
            agentProfiles={agentProfiles}
            setAgentProfiles={setAgentProfiles}
            openProjects={openProjects}
            providers={providers}
            setProviders={setProviders}
          />
        )}
      </div>
      <div className="flex items-center justify-end p-3 gap-3 border-t border-border-default-dark">
        <Button variant="text" onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges}>
          {t('common.save')}
        </Button>
      </div>
    </ModalOverlayLayout>
  );
};
