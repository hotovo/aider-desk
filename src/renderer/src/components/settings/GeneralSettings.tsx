import ReactCountryFlag from 'react-country-flag';
import { SettingsData } from '@common/types';

import { SUPPORTED_LANGUAGES } from '@/i18n';
import { Select } from '@/components/common/Select';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const GeneralSettings = ({ settings, setSettings }: Props) => {
  const languageOptions = Object.entries(SUPPORTED_LANGUAGES).map(([code, { label, countryCode }]) => ({
    value: code,
    label: (
      <div className="flex items-center gap-2">
        <ReactCountryFlag countryCode={countryCode} />
        <span>{label}</span>
      </div>
    ),
  }));

  const handleLanguageChange = (language: string) => {
    setSettings({
      ...settings,
      language,
    });
  };

  return (
    <div className="space-y-4 min-h-[300px]">
      <Select label="Language" value={settings.language} onChange={handleLanguageChange} options={languageOptions} />
    </div>
  );
};
