import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiProvider } from '@common/agent';

import { OpenAiAdvancedSettings } from './OpenAiAdvancedSettings';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenAiProvider;
  onChange: (updated: OpenAiProvider) => void;
};

export const OpenAiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: openAiApiKeyEnv } = useEffectiveEnvironmentVariable('OPENAI_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get OpenAI API key
        </a>
      </div>
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openAiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: openAiApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'OPENAI_API_KEY',
              })
        }
      />

      <OpenAiAdvancedSettings provider={provider} onChange={onChange} />
    </div>
  );
};
