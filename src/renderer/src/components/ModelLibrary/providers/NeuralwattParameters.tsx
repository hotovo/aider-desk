import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { NeuralwattProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: NeuralwattProvider;
  onChange: (updated: NeuralwattProvider) => void;
};

export const NeuralwattParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: neuralwattApiKeyEnv } = useEffectiveEnvironmentVariable('NEURALWATT_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://portal.neuralwatt.com" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Neuralwatt API key
        </a>
      </div>
      <Input
        label={t('neuralwatt.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          neuralwattApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: neuralwattApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'NEURALWATT_API_KEY' })
        }
      />
    </div>
  );
};
