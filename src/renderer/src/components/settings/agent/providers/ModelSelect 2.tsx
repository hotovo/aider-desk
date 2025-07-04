import { DEFAULT_AGENT_PROVIDER_MODELS, LlmProviderName } from '@common/agent';
import { useTranslation } from 'react-i18next';

import { Option, Select } from '@/components/common/Select';

type Props = {
  providerName: LlmProviderName;
  currentModel: string;
  onChange: (model: string) => void;
};

export const ModelSelect = ({ providerName, currentModel, onChange }: Props) => {
  const { t } = useTranslation();

  const handleChange = (value: string) => {
    onChange(value);
  };

  const getModelOptions = (): Option[] => {
    const models = DEFAULT_AGENT_PROVIDER_MODELS[providerName] || [];
    return Object.keys(models).map((model) => ({
      value: model,
      label: model,
    }));
  };

  return <Select label={t('model.selectLabel')} value={currentModel} onChange={handleChange} options={getModelOptions()} />;
};
