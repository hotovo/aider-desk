import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model, ProviderProfile } from '@common/types';

import { ModelParameterOverrides } from './ModelParameterOverrides';

import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

type Props = {
  model?: Model;
  providers: ProviderProfile[];
  onSave: (model: Model) => void;
  onCancel: () => void;
};

export const ModelDialog = ({ model, providers, onSave, onCancel }: Props) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Model>>({
    id: '',
    providerId: providers[0]?.id || '',
    ...model,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providerOverrides, setProviderOverrides] = useState<Record<string, unknown>>(model?.providerOverrides || {});
  const selectedProvider = providers.find((p) => p.id === formData.providerId);

  useEffect(() => {
    if (model) {
      setFormData({
        id: model.id,
        providerId: model.providerId,
        maxInputTokens: model.maxInputTokens,
        maxOutputTokens: model.maxOutputTokens,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
        cacheReadInputTokenCost: model.cacheReadInputTokenCost,
        cacheWriteInputTokenCost: model.cacheWriteInputTokenCost,
        supportsTools: model.supportsTools,
        isHidden: model.isHidden,
      });
      setProviderOverrides(model.providerOverrides || {});
    } else {
      setFormData({
        id: '',
        providerId: providers[0]?.id || '',
      });
      setProviderOverrides({});
    }
    setErrors({});
  }, [model, providers]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.id?.trim()) {
      newErrors.id = t('modelLibrary.errors.idRequired');
    }

    if (!formData.providerId) {
      newErrors.providerId = t('modelLibrary.errors.providerRequired');
    }

    if (formData.maxInputTokens && formData.maxInputTokens <= 0) {
      newErrors.maxInputTokens = t('modelLibrary.errors.invalidTokenCount');
    }

    if (formData.maxOutputTokens && formData.maxOutputTokens <= 0) {
      newErrors.maxOutputTokens = t('modelLibrary.errors.invalidTokenCount');
    }

    if (formData.inputCostPerToken && formData.inputCostPerToken < 0) {
      newErrors.inputCostPerToken = t('modelLibrary.errors.invalidCost');
    }

    if (formData.outputCostPerToken && formData.outputCostPerToken < 0) {
      newErrors.outputCostPerToken = t('modelLibrary.errors.invalidCost');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const modelData: Model = {
      id: formData.id!.trim(),
      providerId: formData.providerId!,
      maxInputTokens: formData.maxInputTokens,
      maxOutputTokens: formData.maxOutputTokens,
      inputCostPerToken: formData.inputCostPerToken,
      outputCostPerToken: formData.outputCostPerToken,
      cacheReadInputTokenCost: formData.cacheReadInputTokenCost,
      cacheWriteInputTokenCost: formData.cacheWriteInputTokenCost,
      supportsTools: formData.supportsTools,
      isHidden: formData.isHidden,
      isCustom: model?.isCustom || !model,
      providerOverrides,
    };

    onSave(modelData);
  };

  const handleInputChange = (field: keyof Model, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ConfirmDialog
      title={model ? t('modelLibrary.editModel') : t('modelLibrary.addModel')}
      contentClass="bg-bg-secondary"
      onCancel={onCancel}
      onConfirm={handleSubmit}
      width={700}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Select
              label={t('modelLibrary.provider')}
              value={formData.providerId || ''}
              onChange={(value) => handleInputChange('providerId', value)}
              options={providers.map((provider) => ({
                value: provider.id,
                label: provider.name || provider.provider.name,
              }))}
              disabled={!!model} // Don't allow changing provider for existing models
            />
            {errors.providerId && <p className="text-error text-2xs mt-1">{errors.providerId}</p>}
          </div>

          <div>
            <Input
              label={t('modelLibrary.modelId')}
              value={formData.id || ''}
              onChange={(e) => handleInputChange('id', e.target.value)}
              placeholder={t('modelLibrary.modelIdPlaceholder')}
              disabled={!!model} // Don't allow changing ID for existing models
            />
            {errors.id && <p className="text-error text-2xs mt-1">{errors.id}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label={t('modelLibrary.maxInputTokens')}
              type="number"
              value={formData.maxInputTokens !== undefined && formData.maxInputTokens !== null ? formData.maxInputTokens : ''}
              onChange={(e) => handleInputChange('maxInputTokens', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
            />
            {errors.maxInputTokens && <p className="text-error text-2xs mt-1">{errors.maxInputTokens}</p>}
          </div>

          <div>
            <Input
              label={t('modelLibrary.maxOutputTokens')}
              type="number"
              value={formData.maxOutputTokens !== undefined && formData.maxOutputTokens !== null ? formData.maxOutputTokens : ''}
              onChange={(e) => handleInputChange('maxOutputTokens', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
            />
            {errors.maxOutputTokens && <p className="text-error text-2xs mt-1">{errors.maxOutputTokens}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label={t('modelLibrary.inputTokenCost')}
              type="number"
              step="0.01"
              value={formData.inputCostPerToken !== undefined && formData.inputCostPerToken !== null ? (formData.inputCostPerToken * 1000000).toFixed(4) : ''}
              onChange={(e) => {
                const perMillionValue = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
                handleInputChange('inputCostPerToken', perTokenValue);
              }}
            />
            {errors.inputCostPerToken && <p className="text-error text-2xs mt-1">{errors.inputCostPerToken}</p>}
          </div>

          <div>
            <Input
              label={t('modelLibrary.outputTokenCost')}
              type="number"
              step="0.01"
              value={
                formData.outputCostPerToken !== undefined && formData.outputCostPerToken !== null ? (formData.outputCostPerToken * 1000000).toFixed(4) : ''
              }
              onChange={(e) => {
                const perMillionValue = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
                handleInputChange('outputCostPerToken', perTokenValue);
              }}
            />
            {errors.outputCostPerToken && <p className="text-error text-2xs mt-1">{errors.outputCostPerToken}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label={t('modelLibrary.cacheReadInputTokenCost')}
              type="number"
              step="0.01"
              value={
                formData.cacheReadInputTokenCost !== undefined && formData.cacheReadInputTokenCost !== null
                  ? (formData.cacheReadInputTokenCost * 1000000).toFixed(4)
                  : ''
              }
              onChange={(e) => {
                const perMillionValue = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
                handleInputChange('cacheReadInputTokenCost', perTokenValue);
              }}
            />
          </div>

          <div>
            <Input
              label={t('modelLibrary.cacheWriteInputTokenCost')}
              type="number"
              step="0.01"
              value={
                formData.cacheWriteInputTokenCost !== undefined && formData.cacheWriteInputTokenCost !== null
                  ? (formData.cacheWriteInputTokenCost * 1000000).toFixed(4)
                  : ''
              }
              onChange={(e) => {
                const perMillionValue = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
                handleInputChange('cacheWriteInputTokenCost', perTokenValue);
              }}
            />
          </div>
        </div>

        {/* Advanced Settings - Provider Overrides */}
        {selectedProvider && <ModelParameterOverrides provider={selectedProvider.provider} overrides={providerOverrides} onChange={setProviderOverrides} />}

        <div className="flex justify-end">
          <Checkbox label={t('modelLibrary.hidden')} checked={formData.isHidden || false} onChange={(checked) => handleInputChange('isHidden', checked)} />
        </div>
      </div>
    </ConfirmDialog>
  );
};
