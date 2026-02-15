import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GroqProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: GroqProvider;
  onChange: (updated: GroqProvider) => void;
};

export const GroqParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: groqApiKeyEnv } = useEffectiveEnvironmentVariable('GROQ_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Groq API key
        </a>
      </div>
      <Input
        label={t('groq.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          groqApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: groqApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'GROQ_API_KEY' })
        }
      />
    </div>
  );
};
