import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AuggieProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AuggieProvider;
  onChange: (updated: AuggieProvider) => void;
};

export const AuggieParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const apiUrl = provider.apiUrl || '';

  const { environmentVariable: auggieApiKeyEnv } = useEffectiveEnvironmentVariable('AUGMENT_API_TOKEN');
  const { environmentVariable: auggieApiUrlEnv } = useEffectiveEnvironmentVariable('AUGMENT_API_URL');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleApiUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiUrl: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border-default-dark p-3 text-2xs text-text-primary bg-bg-secondary">{t('modelLibrary.auggieAuthRequired')}</div>
      <div className="rounded-md border border-border-default-dark p-3 text-2xs text-text-primary bg-bg-secondary">{t('modelLibrary.auggieAgentOnly')}</div>
      <Input
        label={t('auggie.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={auggieApiKeyEnv ? t('settings.agent.envVarFoundPlaceholder', { source: auggieApiKeyEnv.source }) : t('auggie.apiKeyPlaceholder')}
      />
      <Input
        label={t('auggie.apiUrl')}
        type="text"
        value={apiUrl}
        onChange={handleApiUrlChange}
        placeholder={auggieApiUrlEnv ? t('settings.agent.envVarFoundPlaceholder', { source: auggieApiUrlEnv.source }) : t('auggie.apiUrlPlaceholder')}
      />
    </div>
  );
};
