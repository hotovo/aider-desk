import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiCompatibleProvider } from '@aider-desk/common/agent';

import { OpenAiCompatibleAdvancedSettings } from './OpenAiCompatibleAdvancedSettings';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenAiCompatibleProvider;
  onChange: (updated: OpenAiCompatibleProvider) => void;
};

export const OpenAiCompatibleParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';

  const { environmentVariable: openAiApiKeyEnv } = useEffectiveEnvironmentVariable('OPENAI_API_KEY');
  const { environmentVariable: openAiApiBaseEnv } = useEffectiveEnvironmentVariable('OPENAI_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('openai.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={openAiApiBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: openAiApiBaseEnv.source }) : t('openai.baseUrlPlaceholder')}
      />
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openAiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: openAiApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'OPENAI_API_KEY' })
        }
      />
      <OpenAiCompatibleAdvancedSettings provider={provider} onChange={onChange} />
    </div>
  );
};
