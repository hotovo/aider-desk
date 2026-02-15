import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { GpustackProvider } from '@aider-desk/common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: GpustackProvider;
  onChange: (updated: GpustackProvider) => void;
};

export const GpustackParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';

  const { environmentVariable: gpustackApiKeyEnv } = useEffectiveEnvironmentVariable('GPUSTACK_API_KEY');
  const { environmentVariable: gpustackApiBaseEnv } = useEffectiveEnvironmentVariable('GPUSTACK_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('gpustack.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={gpustackApiBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: gpustackApiBaseEnv.source }) : t('gpustack.baseUrlPlaceholder')}
      />
      <Input
        label={t('gpustack.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          gpustackApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: gpustackApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'GPUSTACK_API_KEY' })
        }
      />
    </div>
  );
};
