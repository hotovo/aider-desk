import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenCodeGoProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenCodeGoProvider;
  onChange: (updated: OpenCodeGoProvider) => void;
};

export const OpenCodeGoParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: opencodeGoApiKeyEnv } = useEffectiveEnvironmentVariable('OPENCODE_GO_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://opencode.ai/docs/go" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get OpenCode Go API key
        </a>
      </div>
      <Input
        label={t('opencodeGo.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          opencodeGoApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: opencodeGoApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'OPENCODE_GO_API_KEY',
              })
        }
      />
    </div>
  );
};
