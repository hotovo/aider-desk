import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ClinePassProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: ClinePassProvider;
  onChange: (updated: ClinePassProvider) => void;
};

export const ClinePassParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: clineApiKeyEnv } = useEffectiveEnvironmentVariable('CLINE_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://app.cline.bot" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get ClinePass API key
        </a>
      </div>
      <Input
        label={t('clinepass.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          clineApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: clineApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'CLINE_API_KEY' })
        }
      />
    </div>
  );
};
