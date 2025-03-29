import { SettingsData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/common/Select';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const LanguageSettings = ({ settings, setSettings }: Props) => {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
    setSettings({
      ...settings,
      language,
    });
  };

  return (
    <div className="flex flex-col h-full p-6">
      <h3 className="text-lg font-medium mb-6">{t('settings.language')}</h3>
      <div className="min-h-[300px]">
        <div className="w-full max-w-md"> 
          <Select
            label={t('settings.language')}
            value={settings.language || 'en'}
            onChange={handleLanguageChange}
            options={[
              { value: 'en', label: 'English' },
              { value: 'zh', label: '中文' },
            ]}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

export default LanguageSettings;