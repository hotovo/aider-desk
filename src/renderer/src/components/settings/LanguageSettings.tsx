import { SettingsData } from '@common/types';
import { t, getTranslatedLanguageOptions } from '@/utils/i18n';

import { Select } from '@/components/common/Select';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const LanguageSettings = ({ settings, setSettings }: Props) => {
  const handleLanguageChange = (newLanguage: string) => {
    setSettings({
      ...settings,
      language: newLanguage as 'en' | 'zh',
    });
    // 不再立即应用语言设置，而是等待用户点击保存按钮后才应用
  };

  return (
    <div className="space-y-4 min-h-[300px]">
      <div>
        <Select
          label="Language / 语言"
          value={settings.language || 'en'}
          onChange={handleLanguageChange}
          options={getTranslatedLanguageOptions()}
        />
        <p className="text-xs text-neutral-400 mt-1">
          {t('Changes will take effect after saving settings')}
        </p>
      </div>
      {/* 添加空白区域以保持与其他设置页面一致的高度 */}
      <div className="h-[200px]"></div>
    </div>
  );
};