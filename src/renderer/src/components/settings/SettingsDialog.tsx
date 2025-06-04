import { SettingsData } from '@common/types';
import { useEffect, useMemo, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { LlmProviderName } from '@common/agent';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/context/SettingsContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Props = {
  onClose: () => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const SettingsDialog = ({ onClose, initialTab = 0, initialAgentProfileId, initialAgentProvider }: Props) => {
  const { t, i18n } = useTranslation();

  const { settings: originalSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(null);
  const [showRestartConfirmDialog, setShowRestartConfirmDialog] = useState(false);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  // Apply font settings when dialog opens
  useEffect(() => {
    if (localSettings) {
      const root = document.documentElement;
      root.style.setProperty('--font-family-sans', localSettings.fontFamily || 'Sono');
      root.style.setProperty('--font-family-mono', localSettings.monospaceFontFamily || 'Sono');
      console.log('Font settings applied in dialog:', { 
        sans: localSettings.fontFamily || 'Sono', 
        mono: localSettings.monospaceFontFamily || 'Sono' 
      });
    }
  }, [localSettings?.fontFamily, localSettings?.monospaceFontFamily]);

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
    // Restore original font settings if they were changed
    if (originalSettings && localSettings && 
        (localSettings.fontFamily !== originalSettings.fontFamily || 
         localSettings.monospaceFontFamily !== originalSettings.monospaceFontFamily)) {
      const root = document.documentElement;
      root.style.setProperty('--font-family-sans', originalSettings.fontFamily || 'Sono');
      root.style.setProperty('--font-family-mono', originalSettings.monospaceFontFamily || 'Sono');
      console.log('Font settings restored:', { 
        sans: originalSettings.fontFamily || 'Sono', 
        mono: originalSettings.monospaceFontFamily || 'Sono' 
      });
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
      const aiderEnvVarsChanged = localSettings.aider.environmentVariables !== originalSettings?.aider.environmentVariables;

      await saveSettings(localSettings);

      if (aiderOptionsChanged || aiderEnvVarsChanged) {
        setShowRestartConfirmDialog(true);
      } else {
        onClose();
      }
    }
  };

  const handleConfirmRestart = async () => {
    const openProjects = await window.api.getOpenProjects();
    openProjects.forEach((project) => {
      window.api.restartProject(project.baseDir);
    });
    setShowRestartConfirmDialog(false);
    onClose();
  };

  const handleCancelRestart = async () => {
    setShowRestartConfirmDialog(false);
    onClose();
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

  const handleFontChange = (fontFamily: string, monospaceFontFamily: string) => {
    if (localSettings) {
      setLocalSettings({
        ...localSettings,
        fontFamily,
        monospaceFontFamily,
      });
      
      // Apply font changes immediately
      const root = document.documentElement;
      root.style.setProperty('--font-family-sans', fontFamily);
      root.style.setProperty('--font-family-mono', monospaceFontFamily);
      console.log('Font change handler called:', { fontFamily, monospaceFontFamily });
    }
  };

  if (showRestartConfirmDialog) {
    return (
      <ConfirmDialog
        title={t('settings.aiderRestartConfirm.title')}
        onConfirm={handleConfirmRestart}
        onCancel={handleCancelRestart}
        confirmButtonText={t('settings.aiderRestartConfirm.restartNow')}
        cancelButtonText={t('settings.aiderRestartConfirm.later')}
        width={600}
        closeOnEscape
      >
        <span className="text-sm">{t('settings.aiderRestartConfirm.message')}</span>
      </ConfirmDialog>
    );
  }

  return (
    <ConfirmDialog
      title={t('settings.title')}
      onCancel={handleCancel}
      onConfirm={handleSave}
      confirmButtonText={t('common.save')}
      width={1000}
      closeOnEscape
      disabled={!hasChanges}
    >
      {localSettings && (
        <Settings
          settings={localSettings}
          updateSettings={setLocalSettings}
          onLanguageChange={handleLanguageChange}
          onZoomChange={handleZoomChange}
          onFontChange={handleFontChange}
          initialTab={initialTab}
          initialAgentProfileId={initialAgentProfileId}
          initialAgentProvider={initialAgentProvider}
        />
      )}
    </ConfirmDialog>
  );
};
