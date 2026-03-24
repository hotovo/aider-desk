import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KimiPlanProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: KimiPlanProvider;
  onChange: (updated: KimiPlanProvider) => void;
};

export const KimiPlanParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: kimiPlanApiKeyEnv } = useEffectiveEnvironmentVariable('KIMI_PLAN_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://www.kimi.com/code/console" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Kimi Coding Plan API Key
        </a>
      </div>
      <Input
        label={t('kimiPlan.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          kimiPlanApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: kimiPlanApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', { envVar: 'KIMI_PLAN_API_KEY' })
        }
      />
    </div>
  );
};
