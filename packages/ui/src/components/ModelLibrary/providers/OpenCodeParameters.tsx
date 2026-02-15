import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenCodeProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenCodeProvider;
  onChange: (updated: OpenCodeProvider) => void;
};

export const OpenCodeParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: opencodeApiKeyEnv } = useEffectiveEnvironmentVariable('OPENCODE_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://opencode.ai/auth" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get OpenCode ZEN API key
        </a>
      </div>
      <Input
        label={t('opencode.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          opencodeApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: opencodeApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'OPENCODE_API_KEY',
              })
        }
      />
    </div>
  );
};
