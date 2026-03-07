import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlibabaPlanProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AlibabaPlanProvider;
  onChange: (updated: AlibabaPlanProvider) => void;
};

export const AlibabaPlanParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: alibabaPlanApiKeyEnv } = useEffectiveEnvironmentVariable('ALIBABA_PLAN_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://bailian.console.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Alibaba Coding Plan API Key
        </a>
      </div>
      <Input
        label={t('alibabaPlan.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          alibabaPlanApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: alibabaPlanApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', { envVar: 'ALIBABA_PLAN_API_KEY' })
        }
      />
    </div>
  );
};
