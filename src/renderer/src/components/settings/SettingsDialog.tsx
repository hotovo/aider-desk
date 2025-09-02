import { SettingsData, StartupMode } from '@common/types';
import { useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/context/SettingsContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Props = {
  onClose: () => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const SettingsDialog = ({ onClose, initialTab = 0, initialAgentProfileId, initialAgentProvider }: Props) => {
  const { t, i18n } = useTranslation();

  const { settings: originalSettings, saveSettings, saveTheme, saveFont, saveFontSize } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  const hasChanges = useMemo(() => {
    return localSettings && originalSettings && !isEqual(localSettings, originalSettings);
  }, [localSettings, originalSettings]);

  const handleCancel = () => {
    if (originalSettings && localSettings?.language !== originalSettings.language) {
      void i18n.changeLanguage(originalSettings.language);
    }
    if (originalSettings && localSettings?.zoomLevel !== originalSettings.zoomLevel) {
      void window.api.setZoomLevel(originalSettings.zoomLevel ?? 1);
    }
    if (originalSettings && originalSettings.theme && localSettings?.theme !== originalSettings.theme) {
      saveTheme(originalSettings.theme);
    }

    if (originalSettings && originalSettings.font && localSettings?.font !== originalSettings.font) {
      saveFont(originalSettings.font);
    }

    if (originalSettings && originalSettings.fontSize && localSettings?.fontSize !== originalSettings.fontSize) {
      saveFontSize(originalSettings.fontSize);
    }

    // Updated to use settings.mcpServers directly
    if (originalSettings && localSettings && !isEqual(localSettings.mcpServers, originalSettings.mcpServers)) {
      void window.api.reloadMcpServers(originalSettings.mcpServers || {});
    }
    onClose();
  };

  const handleSave = async () => {
    if (localSettings) {
      const aiderOptionsChanged = localSettings.aider.options !== originalSettings?.aider.options;
      const aiderAutoCommitsChanged = localSettings.aider.autoCommits !== originalSettings?.aider.autoCommits;
      const aiderWatchFilesChanged = localSettings.aider.watchFiles !== originalSettings?.aider.watchFiles;
      const aiderCachingEnabledChanged = localSettings.aider.cachingEnabled !== originalSettings?.aider.cachingEnabled;
      const aiderConfirmBeforeEditChanged = localSettings.aider.confirmBeforeEdit !== originalSettings?.aider.confirmBeforeEdit;
      const startupModeChanged = localSettings.startupMode !== originalSettings?.startupMode;

      await saveSettings(localSettings);

      if (
        aiderOptionsChanged ||
        aiderAutoCommitsChanged ||
        aiderWatchFilesChanged ||
        aiderCachingEnabledChanged ||
        aiderConfirmBeforeEditChanged ||
        startupModeChanged
      ) {
        const openProjects = await window.api.getOpenProjects();
        openProjects.forEach((project) => {
          window.api.restartProject(project.baseDir, StartupMode.Last);
        });
      }
      onClose();
    }
  };

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
      void window.api.setZoomLevel(zoomLevel);
    }
  };

  const handleFontSizeChange = (fontSize: number) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        fontSize,
      });
      saveFontSize(fontSize);
    }
  };

  return (
    <ConfirmDialog
      title={t('settings.title')}
      onCancel={handleCancel}
      onConfirm={handleSave}
      confirmButtonText={t('common.save')}
      width={1000}
      disabled={!hasChanges}
    >
      {localSettings && (
        <Settings
          settings={localSettings}
          updateSettings={setLocalSettings}
          onLanguageChange={handleLanguageChange}
          onZoomChange={handleZoomChange}
          onThemeChange={saveTheme}
          onFontChange={saveFont}
          onFontSizeChange={handleFontSizeChange}
          initialTab={initialTab}
          initialAgentProfileId={initialAgentProfileId}
          initialAgentProvider={initialAgentProvider}
        />
      )}
    </ConfirmDialog>
  );
};
