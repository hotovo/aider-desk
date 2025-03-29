import { PROVIDER_MODELS, ProviderName } from '@common/llm-providers';
import { useTranslation } from 'react-i18next';

import { Option, Select } from '@/components/common/Select';

type Props = {
  providerName: ProviderName;
  currentModel: string;
  onChange: (model: string) => void;
};

export const ModelSelect = ({ providerName, currentModel, onChange }: Props) => {
  const { t } = useTranslation();
  const handleChange = (value: string) => {
    onChange(value);
  };

  const getModelOptions = (): Option[] => {
    const models = PROVIDER_MODELS[providerName]?.models || {};
    return Object.keys(models).map((model) => ({
      value: model,
      label: model,
    }));
  };

  return <Select label={t('model.label')} value={currentModel} onChange={handleChange} options={getModelOptions()} />;
};
