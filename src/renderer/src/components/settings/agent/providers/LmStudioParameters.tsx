import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LmStudioProvider } from '@common/agent';

import { ProviderModels } from './ProviderModels';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: LmStudioProvider;
  onChange: (updated: LmStudioProvider) => void;
};

export const LmStudioParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';

  const { environmentVariable: lmStudioBaseEnv } = useEffectiveEnvironmentVariable('LMSTUDIO_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleModelsChange = (updatedModels: string[]) => {
    onChange({ ...provider, models: updatedModels });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('lmstudio.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={lmStudioBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: lmStudioBaseEnv.source }) : t('lmstudio.baseUrlPlaceholder')}
      />
      <ProviderModels models={provider.models || []} onChange={handleModelsChange} />
    </div>
  );
};
