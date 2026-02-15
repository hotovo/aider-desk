import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SyntheticProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: SyntheticProvider;
  onChange: (updated: SyntheticProvider) => void;
};

export const SyntheticParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: syntheticApiKeyEnv } = useEffectiveEnvironmentVariable('SYNTHETIC_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://dev.synthetic.new" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Synthetic API key
        </a>
      </div>
      <Input
        label={t('synthetic.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          syntheticApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: syntheticApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'SYNTHETIC_API_KEY',
              })
        }
      />
    </div>
  );
};
