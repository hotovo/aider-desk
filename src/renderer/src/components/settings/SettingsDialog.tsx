import { SettingsData } from '@common/types';
import { useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useHotkeysContext } from 'react-hotkeys-hook';
import { LlmProviderName } from '@common/agent';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/contexts/SettingsContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  onClose: () => void;
  initialTab?: number;
  initialAgentProfileId?: string;
  initialAgentProvider?: LlmProviderName;
};

export const SettingsDialog = ({ onClose, initialTab = 0, initialAgentProfileId, initialAgentProvider }: Props) => {
  const { t, i18n } = useTranslation();
  const api = useApi();
  const hotkeys = useHotkeysContext();
  const appliedRef = useRef(false);

  const { settings: originalSettings, saveSettings, setTheme, setFont, setFontSize } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(originalSettings);

  useEffect(() => {
    if (appliedRef.current) {
      return;
    }
    appliedRef.current = true;

    try {
      hotkeys.disableScope('home');
      hotkeys.disableScope('task');
      hotkeys.enableScope('dialog');
    } catch {
      // Hotkey scopes may be unavailable in some contexts; ignore errors.
    }
    return () => {
      try {
        hotkeys.enableScope('home');
        hotkeys.enableScope('task');
      } catch {
        // Hotkey scopes may already be restored; ignore errors.
      }
    };
  }, [hotkeys]);

  useEffect(() => {
    if (originalSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  useEffect(() => {
    if (!localSettings || !originalSettings) {
      return;
    }

    if (isEqual(localSettings, originalSettings)) {
      return;
    }

    const handle = setTimeout(() => {
      void saveSettings(localSettings);
    }, 400);

    return () => {
      clearTimeout(handle);
    };
  }, [localSettings, originalSettings, saveSettings]);

  useEffect(() => {
    if (!localSettings || !originalSettings) {
      return;
    }

    if (isEqual(localSettings.mcpServers, originalSettings.mcpServers)) {
      return;
    }

    const handle = setTimeout(() => {
      void api.reloadMcpServers(localSettings.mcpServers || {});
    }, 400);

    return () => {
      clearTimeout(handle);
    };
  }, [api, localSettings, originalSettings]);

  const handleClose = () => {
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
      void api.setZoomLevel(zoomLevel);
    }
  };

  return (
    <ConfirmDialog
      title={t('settings.title')}
      onCancel={handleClose}
      onConfirm={handleClose}
      confirmButtonText={t('common.done', { defaultValue: 'Done' })}
      width={1000}
      closeOnEscape={true}
    >
      {localSettings && (
        <Settings
          settings={localSettings}
          updateSettings={setLocalSettings}
          onLanguageChange={handleLanguageChange}
          onZoomChange={handleZoomChange}
          onThemeChange={setTheme}
          onFontChange={setFont}
          onFontSizeChange={setFontSize}
          initialTab={initialTab}
          initialAgentProfileId={initialAgentProfileId}
          initialAgentProvider={initialAgentProvider}
        />
      )}
    </ConfirmDialog>
  );
};
