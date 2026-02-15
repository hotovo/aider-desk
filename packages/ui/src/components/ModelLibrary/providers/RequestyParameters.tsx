import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestyProvider } from '@aider-desk/common/agent';

import { RequestyAdvancedSettings } from './RequestyAdvancedSettings';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: RequestyProvider;
  onChange: (updated: RequestyProvider) => void;
};

export const RequestyParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: requestyApiKeyEnv } = useEffectiveEnvironmentVariable('REQUESTY_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://app.requesty.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Requesty API key
        </a>
      </div>
      <Input
        label={t('requesty.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          requestyApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: requestyApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'REQUESTY_API_KEY',
              })
        }
      />

      <RequestyAdvancedSettings provider={provider} onChange={onChange} />
    </div>
  );
};
