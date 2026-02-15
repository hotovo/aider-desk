import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeepseekProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: DeepseekProvider;
  onChange: (updated: DeepseekProvider) => void;
};

export const DeepseekParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: deepseekApiKeyEnv } = useEffectiveEnvironmentVariable('DEEPSEEK_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('deepseek.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          deepseekApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: deepseekApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'DEEPSEEK_API_KEY' })
        }
      />
    </div>
  );
};
