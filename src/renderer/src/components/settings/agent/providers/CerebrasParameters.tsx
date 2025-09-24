import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CerebrasProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: CerebrasProvider;
  onChange: (updated: CerebrasProvider) => void;
};

export const CerebrasParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: cerebrasApiKeyEnv } = useEffectiveEnvironmentVariable('CEREBRAS_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Cerebras API key
        </a>
      </div>
      <Input
        label={t('cerebras.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          cerebrasApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: cerebrasApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'CEREBRAS_API_KEY' })
        }
      />
    </div>
  );
};
