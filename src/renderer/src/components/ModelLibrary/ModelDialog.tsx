import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model, ProviderProfile } from '@common/types';
import { DEFAULT_MODEL_TEMPERATURE } from '@common/agent';

import { ModelParameterOverrides } from './ModelParameterOverrides';

import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Slider } from '@/components/common/Slider';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  model?: Model;
  providers: ProviderProfile[];
  onSave: (model: Model) => void;
  onCancel: () => void;
  onAutoSave?: (model: Model) => void;
};

export const ModelDialog = ({ model, providers, onSave, onCancel, onAutoSave }: Props) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Model>>({
    id: '',
    providerId: providers[0]?.id || '',
    temperature: DEFAULT_MODEL_TEMPERATURE,
    ...model,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providerOverrides, setProviderOverrides] = useState<Record<string, unknown>>(model?.providerOverrides || {});
  const initialModelRef = useRef(model);
  const initialProvidersRef = useRef(providers);
  const selectedProvider = providers.find((p) => p.id === formData.providerId);
  const lastSavedJsonRef = useRef<string | null>(null);

  useEffect(() => {
    const existingModel = initialModelRef.current;
    const providerList = initialProvidersRef.current;

    const initialData: Partial<Model> = existingModel
      ? {
          id: existingModel.id,
          providerId: existingModel.providerId,
          maxInputTokens: existingModel.maxInputTokens,
          maxOutputTokens: existingModel.maxOutputTokens,
          temperature: existingModel.temperature ?? DEFAULT_MODEL_TEMPERATURE,
          inputCostPerToken: existingModel.inputCostPerToken,
          outputCostPerToken: existingModel.outputCostPerToken,
          cacheReadInputTokenCost: existingModel.cacheReadInputTokenCost,
          cacheWriteInputTokenCost: existingModel.cacheWriteInputTokenCost,
          supportsTools: existingModel.supportsTools,
          isHidden: existingModel.isHidden,
        }
      : {
          id: '',
          providerId: providerList[0]?.id || '',
          temperature: DEFAULT_MODEL_TEMPERATURE,
        };

    setFormData(initialData);
    setProviderOverrides(existingModel?.providerOverrides ? { ...existingModel.providerOverrides } : {});
    lastSavedJsonRef.current = existingModel
      ? JSON.stringify({
          ...existingModel,
          providerOverrides: existingModel.providerOverrides || {},
        })
      : null;
    setErrors({});
  }, []);

  const modelData = useMemo<Model>(
    () => ({
      id: (formData.id || '').trim(),
      providerId: formData.providerId || '',
      maxInputTokens: formData.maxInputTokens,
      maxOutputTokens: formData.maxOutputTokens,
      temperature: formData.temperature,
      inputCostPerToken: formData.inputCostPerToken,
      outputCostPerToken: formData.outputCostPerToken,
      cacheReadInputTokenCost: formData.cacheReadInputTokenCost,
      cacheWriteInputTokenCost: formData.cacheWriteInputTokenCost,
      supportsTools: formData.supportsTools,
      isHidden: formData.isHidden,
      isCustom: model?.isCustom || !model,
      providerOverrides,
    }),
    [formData, providerOverrides, model],
  );

  const isModelDataValid = (data: Model) => {
    if (!data.id) {
      return false;
    }

    if (!data.providerId) {
      return false;
    }

    if (data.maxInputTokens !== undefined && data.maxInputTokens !== null && data.maxInputTokens <= 0) {
      return false;
    }

    if (data.maxOutputTokens !== undefined && data.maxOutputTokens !== null && data.maxOutputTokens <= 0) {
      return false;
    }

    if (data.temperature !== undefined && data.temperature !== null && (data.temperature < 0 || data.temperature > 2)) {
      return false;
    }

    if (data.inputCostPerToken !== undefined && data.inputCostPerToken !== null && data.inputCostPerToken < 0) {
      return false;
    }

    if (data.outputCostPerToken !== undefined && data.outputCostPerToken !== null && data.outputCostPerToken < 0) {
      return false;
    }

    if (data.cacheReadInputTokenCost !== undefined && data.cacheReadInputTokenCost !== null && data.cacheReadInputTokenCost < 0) {
      return false;
    }

    if (data.cacheWriteInputTokenCost !== undefined && data.cacheWriteInputTokenCost !== null && data.cacheWriteInputTokenCost < 0) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    lastSavedJsonRef.current = model
      ? JSON.stringify({
          ...model,
          providerOverrides: model.providerOverrides || {},
        })
      : null;
  }, [model]);

  useEffect(() => {
    if (!onAutoSave) {
      return;
    }

    const handle = setTimeout(() => {
      if (!isModelDataValid(modelData)) {
        return;
      }

      const modelJson = JSON.stringify(modelData);
      if (modelJson === lastSavedJsonRef.current) {
        return;
      }

      lastSavedJsonRef.current = modelJson;
      void onAutoSave(modelData);
    }, 400);

    return () => {
      clearTimeout(handle);
    };
  }, [modelData, onAutoSave]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug('ModelDialog: formData changed', formData);
  }, [formData]);

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

    if (formData.temperature && (formData.temperature < 0 || formData.temperature > 2)) {
      newErrors.temperature = t('modelLibrary.errors.invalidTemperature');
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

    onSave(modelData);
    lastSavedJsonRef.current = JSON.stringify(modelData);
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
      confirmButtonText={t('common.done', { defaultValue: 'Done' })}
      closeOnEscape={true}
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
              value={formData.maxInputTokens ?? ''}
              onChange={(e) => handleInputChange('maxInputTokens', e.target.value !== '' ? parseInt(e.target.value) : undefined)}
            />
            {errors.maxInputTokens && <p className="text-error text-2xs mt-1">{errors.maxInputTokens}</p>}
          </div>

          <div>
            <Input
              label={t('modelLibrary.maxOutputTokens')}
              type="number"
              value={formData.maxOutputTokens ?? ''}
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
              value={formData.inputCostPerToken != null ? (formData.inputCostPerToken * 1000000).toFixed(4) : ''}
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
              value={formData.outputCostPerToken != null ? (formData.outputCostPerToken * 1000000).toFixed(4) : ''}
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
              value={formData.cacheReadInputTokenCost != null ? (formData.cacheReadInputTokenCost * 1000000).toFixed(4) : ''}
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
              value={formData.cacheWriteInputTokenCost != null ? (formData.cacheWriteInputTokenCost * 1000000).toFixed(4) : ''}
              onChange={(e) => {
                const perMillionValue = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
                const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
                handleInputChange('cacheWriteInputTokenCost', perTokenValue);
              }}
            />
          </div>
        </div>

        <div className="space-y-2 grid grid-cols-2 gap-4">
          <Slider
            label={
              <div className="flex items-center text-sm">
                <span>{t('modelLibrary.temperature')}</span>
                <InfoIcon tooltip={t('modelLibrary.temperatureTooltip')} className="ml-2" />
              </div>
            }
            min={0}
            max={2}
            step={0.05}
            value={formData.temperature ?? DEFAULT_MODEL_TEMPERATURE}
            onChange={(value) => handleInputChange('temperature', value)}
          />
          {errors.temperature && <p className="text-error text-2xs mt-1">{errors.temperature}</p>}
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
