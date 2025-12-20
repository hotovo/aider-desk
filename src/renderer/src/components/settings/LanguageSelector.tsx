import { ReactCountryFlag } from 'react-country-flag';
import { useTranslation } from 'react-i18next';

import Select, { Option } from '../common/Select';

import { SUPPORTED_LANGUAGES } from '@/i18n';

type Props = {
  language: string;
  onChange: (language: string) => void;
  hideLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export const LanguageSelector = ({ language, onChange, hideLabel, size }: Props) => {
  const { t } = useTranslation();
  const languageOptions: Option[] = Object.entries(SUPPORTED_LANGUAGES).map(([code, { label, countryCode }]) => ({
    value: code,
    label: (
      <div className="flex items-center gap-2">
        <ReactCountryFlag countryCode={countryCode} />
        <span>{t(`languages.${code}`, { defaultValue: label })}</span>
      </div>
    ),
  }));

  return (
    <Select
      label={!hideLabel && <span className={size === 'sm' ? 'text-xs' : ''}>{t('settings.language')}</span>}
      value={language}
      onChange={onChange}
      options={languageOptions}
      size={size}
    />
  );
};
