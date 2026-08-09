import { McpServersData, ProjectData, ProviderProfile, SettingsData } from '@common/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';

import { Settings } from '@/pages/Settings';
import { useSaveSettings, setFont, setFontSize, setTheme, useSettingsStore } from '@/stores/settingsStore';
import { useAgents } from '@/contexts/AgentsContext';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';

type Props = {
  onClose: () => void;
  initialPageId?: string;
  initialOptions?: Record<string, unknown>;
  openProjects?: ProjectData[];
  onShowLogs?: () => void;
};

export const SettingsPage = ({ onClose, initialPageId, initialOptions, openProjects, onShowLogs }: Props) => {
  const { t, i18n } = useTranslation();
  const api = useApi();

  const originalSettings = useSettingsStore((state) => state.settings);
  const saveSettings = useSaveSettings();
  const { profiles: originalAgentProfiles, createProfile, updateProfile, deleteProfile, updateProfilesOrder } = useAgents();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);
  const [agentProfiles, setAgentProfiles] = useState(originalAgentProfiles);

  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [originalProviders, setOriginalProviders] = useState<ProviderProfile[]>([]);

  const [mcpServers, setMcpServers] = useState<McpServersData>({ global: {}, projectServers: {} });
  const [originalMcpServers, setOriginalMcpServers] = useState<McpServersData>({ global: {}, projectServers: {} });

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
    const loadMcpServers = async () => {
      try {
        const data = await api.getMcpServers();
        setMcpServers(data);
        setOriginalMcpServers(data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load MCP servers:', error);
      }
    };

    void loadMcpServers();
  }, [api]);

  useEffect(() => {
    setAgentProfiles(originalAgentProfiles);
  }, [originalAgentProfiles]);

  const hasChanges = useMemo(() => {
    const settingsChanged = localSettings && originalSettings && !isEqual(localSettings, originalSettings);
    const agentProfilesChanged = !isEqual(agentProfiles, originalAgentProfiles);
    const providersChanged = !isEqual(providers, originalProviders);
    const mcpServersChanged = !isEqual(mcpServers, originalMcpServers);
    return settingsChanged || agentProfilesChanged || providersChanged || mcpServersChanged;
  }, [localSettings, originalSettings, agentProfiles, originalAgentProfiles, providers, originalProviders, mcpServers, originalMcpServers]);

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

    setAgentProfiles(originalAgentProfiles);
    setProviders(originalProviders);
    setMcpServers(originalMcpServers);
    onClose();
  }, [originalSettings, localSettings, i18n, api, originalAgentProfiles, originalProviders, originalMcpServers, onClose]);

  const performSave = async (): Promise<boolean> => {
    try {
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
        return false;
      }

      // Save MCP server changes
      try {
        if (!isEqual(mcpServers, originalMcpServers)) {
          const scopes = new Set<string | undefined>([undefined, ...Object.keys(originalMcpServers.projectServers), ...Object.keys(mcpServers.projectServers)]);
          for (const projectDir of scopes) {
            const originalScope = projectDir ? originalMcpServers.projectServers[projectDir] || {} : originalMcpServers.global;
            const draftScope = projectDir ? mcpServers.projectServers[projectDir] || {} : mcpServers.global;
            if (!isEqual(originalScope, draftScope)) {
              await api.replaceMcpServers(draftScope, projectDir);
            }
          }
          setOriginalMcpServers(mcpServers);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to save MCP servers:', error);
        return false;
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
        return false;
      }

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save settings:', error);
      return false;
    }
  };

  const handleSave = () => {
    onClose();
    void performSave().then((success) => {
      if (success) {
        showSuccessNotification(t('settings.savedSuccessfully'));
      } else {
        showErrorNotification(t('settings.saveError'));
      }
    });
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
            mcpServers={mcpServers}
            setMcpServers={setMcpServers}
            openProjects={openProjects}
            providers={providers}
            setProviders={setProviders}
            onShowLogs={onShowLogs}
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
