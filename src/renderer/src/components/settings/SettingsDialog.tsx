import { SettingsData } from '@common/types';
import { useState, useEffect, useMemo } from 'react';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/context/SettingsContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Props = {
  onClose: () => void;
  initialTab?: number;
};

export const SettingsDialog = ({ onClose, initialTab = 0 }: Props) => {
  const { t } = useTranslation();
  const { settings: originalSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(null);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  const hasChanges = useMemo(() => {
    if (!localSettings || !originalSettings) return false;
    return (
      localSettings.language !== originalSettings.language ||
      !isEqual(localSettings.aider, originalSettings.aider) ||
      !isEqual(localSettings.models, originalSettings.models) ||
      !isEqual(localSettings.mcpAgent, originalSettings.mcpAgent)
    );
  }, [localSettings, originalSettings]);

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
      onClose();
    }
  };

  return (
    <ConfirmDialog 
      title={t('settings.title').toUpperCase()} 
      onCancel={onClose} 
      onConfirm={handleSave} 
      confirmButtonText={t('common.save')} 
      width={800} 
      closeOnEscape 
      disabled={!hasChanges}
    >
      <div className="h-[600px] w-full">
        {localSettings && <Settings settings={localSettings} updateSettings={setLocalSettings} initialTab={initialTab} />}
      </div>
    </ConfirmDialog>
  );
};
