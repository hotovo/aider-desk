import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RequestyProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { ProviderModels } from './ProviderModels';

import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';
import Select from '@/components/common/Select';

type Props = {
  provider: RequestyProvider;
  onChange: (updated: RequestyProvider) => void;
};

export const RequestyParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey, models, useAutoCache, reasoningEffort } = provider;

  const reasoningOptions = [
    { value: 'none', label: t('reasoningEffort.none') },
    { value: 'low', label: t('reasoningEffort.low') },
    { value: 'medium', label: t('reasoningEffort.medium') },
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'max', label: t('reasoningEffort.max') },
  ];

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleModelsChange = (updatedModels: string[]) => {
    onChange({ ...provider, models: updatedModels });
  };

  const handleUseAutoCacheChange = (checked: boolean) => {
    onChange({ ...provider, useAutoCache: checked });
  };

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as ReasoningEffort });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium uppercase !pb-0">
        {t('providers.requesty')} {t('settings.agent.providerSettings')}
      </h3>
      <div className="!mt-0 !mb-5">
        <a href="https://requesty.ai" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
          https://requesty.ai
        </a>
      </div>
      <Input
        label={t('requesty.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={t('settings.agent.envVarPlaceholder', {
          envVar: 'REQUESTY_API_KEY',
        })}
      />
      <div className="grid grid-cols-2 gap-x-10">
        <Select
          label={
            <div className="flex items-center font-medium">
              <span>{t('reasoningEffort.label')}</span>
              <InfoIcon className="ml-1" tooltip={t('reasoningEffort.tooltip')} />
            </div>
          }
          value={reasoningEffort}
          onChange={handleReasoningEffortChange}
          options={reasoningOptions}
        />
        <div className="flex items-center space-x-2">
          <Checkbox label={t('requesty.autoCacheLabel')} checked={useAutoCache} onChange={handleUseAutoCacheChange} size="md" />
          <InfoIcon tooltip={t('requesty.autoCacheTooltip')} />
        </div>
      </div>
      <ProviderModels models={models} onChange={handleModelsChange} />
    </div>
  );
};
