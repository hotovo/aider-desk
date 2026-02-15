import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GeminiProvider } from '@aider-desk/common/agent';

import { GeminiAdvancedSettings } from './GeminiAdvancedSettings';
import { EnableVoiceControl } from './EnableVoiceControl';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: GeminiProvider;
  onChange: (updated: GeminiProvider) => void;
};

export const GeminiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey, customBaseUrl } = provider;
  const voiceEnabled = provider.voiceEnabled ?? false;

  const { environmentVariable: geminiApiKeyEnv } = useEffectiveEnvironmentVariable('GEMINI_API_KEY');
  const { environmentVariable: geminiBaseUrlEnv } = useEffectiveEnvironmentVariable('GEMINI_API_BASE_URL');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleCustomBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, customBaseUrl: e.target.value });
  };

  const handleVoiceEnabledChange = (checked: boolean) => {
    onChange({ ...provider, voiceEnabled: checked });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Gemini API key
        </a>
      </div>
      <Input
        label={t('gemini.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          geminiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: geminiApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'GEMINI_API_KEY',
              })
        }
      />
      <Input
        label={t('gemini.customBaseUrl')}
        value={customBaseUrl || ''}
        onChange={handleCustomBaseUrlChange}
        placeholder={
          geminiBaseUrlEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: geminiBaseUrlEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'GEMINI_API_BASE_URL',
              })
        }
      />

      <GeminiAdvancedSettings provider={provider} onChange={onChange} />

      <EnableVoiceControl voiceEnabled={voiceEnabled} onChange={handleVoiceEnabledChange} />
    </div>
  );
};
