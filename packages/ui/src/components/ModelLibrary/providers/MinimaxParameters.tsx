import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MinimaxProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: MinimaxProvider;
  onChange: (updated: MinimaxProvider) => void;
};

export const MinimaxParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: minimaxApiKeyEnv } = useEffectiveEnvironmentVariable('MINIMAX_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a
          href="https://platform.minimax.io/user-center/basic-information/interface-key"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-info-light hover:underline"
        >
          Get MiniMax API key
        </a>
      </div>
      <Input
        label={t('minimax.apiKey')}
        type="password"
        value={apiKey || ''}
        onChange={handleApiKeyChange}
        placeholder={
          minimaxApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: minimaxApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'MINIMAX_API_KEY',
              })
        }
      />
    </div>
  );
};
