import { SettingsData } from '@common/types';
import { useState, useEffect, useMemo } from 'react';
import { isEqual } from 'lodash';

import { Settings } from '@/pages/Settings';
import { useSettings } from '@/context/SettingsContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { t } from '@/utils/i18n';

type Props = {
  onClose: () => void;
  initialTab?: number;
};

export const SettingsDialog = ({ onClose, initialTab = 0 }: Props) => {
  const { settings: originalSettings, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<SettingsData | null>(null);

  useEffect(() => {
    if (originalSettings) {
      setLocalSettings(originalSettings);
    }
  }, [originalSettings]);

  const hasChanges = useMemo(() => {
    return localSettings && originalSettings && !isEqual(localSettings, originalSettings);
  }, [localSettings, originalSettings]);

  const handleSave = async () => {
    if (localSettings) {
      await saveSettings(localSettings);
      
      // 检查语言是否发生变化，如果变化则刷新页面以应用新语言
      if (originalSettings && localSettings.language !== originalSettings.language) {
        // 使用setTimeout确保设置保存完成后再刷新
        setTimeout(() => {
          // 强制刷新页面以应用新语言设置
          localStorage.setItem('current-language', localSettings.language || 'en');
          window.location.reload();
        }, 300); // 增加延迟时间确保设置已保存
      } else {
        onClose();
      }
    }
  };

  return (
    <ConfirmDialog title={t('SETTINGS')} onCancel={onClose} onConfirm={handleSave} confirmButtonText={t('Save')} width={800} closeOnEscape disabled={!hasChanges}>
      {localSettings && <Settings settings={localSettings} updateSettings={setLocalSettings} initialTab={initialTab} />}
    </ConfirmDialog>
  );
};
