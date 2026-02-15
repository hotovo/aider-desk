import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ZaiPlanProvider } from '@aider-desk/common/agent';

import { ZaiPlanAdvancedSettings } from './ZaiPlanAdvancedSettings';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: ZaiPlanProvider;
  onChange: (updated: ZaiPlanProvider) => void;
};

export const ZaiPlanParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: zaiApiKeyEnv } = useEffectiveEnvironmentVariable('ZAI_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://z.ai/subscribe" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Z.AI API key
        </a>
      </div>
      <Input
        label={t('zaiPlan.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          zaiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: zaiApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'ZAI_API_KEY',
              })
        }
      />

      <ZaiPlanAdvancedSettings provider={provider} onChange={onChange} />
    </div>
  );
};
