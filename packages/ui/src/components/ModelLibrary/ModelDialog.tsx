import { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Model, ProviderProfile } from '@aider-desk/common/types';
import { DEFAULT_MODEL_TEMPERATURE } from '@aider-desk/common/agent';

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
  const [temperatureEnabled, setTemperatureEnabled] = useState(model?.temperature !== undefined);
  const [costDisplayValues, setCostDisplayValues] = useState<Record<string, string>>({
    inputCostPerToken: model?.inputCostPerToken !== undefined && model.inputCostPerToken !== null ? (model.inputCostPerToken * 1000000).toFixed(4) : '',
    outputCostPerToken: model?.outputCostPerToken !== undefined && model.outputCostPerToken !== null ? (model.outputCostPerToken * 1000000).toFixed(4) : '',
    cacheReadInputTokenCost:
      model?.cacheReadInputTokenCost !== undefined && model.cacheReadInputTokenCost !== null ? (model.cacheReadInputTokenCost * 1000000).toFixed(4) : '',
    cacheWriteInputTokenCost:
      model?.cacheWriteInputTokenCost !== undefined && model.cacheWriteInputTokenCost !== null ? (model.cacheWriteInputTokenCost * 1000000).toFixed(4) : '',
  });
  const selectedProvider = providers.find((p) => p.id === formData.providerId);

  useEffect(() => {
    if (model) {
      const newFormData = {
        id: model.id,
        providerId: model.providerId,
        maxInputTokens: model.maxInputTokens,
        maxOutputTokens: model.maxOutputTokens,
        temperature: model.temperature,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
        cacheReadInputTokenCost: model.cacheReadInputTokenCost,
        cacheWriteInputTokenCost: model.cacheWriteInputTokenCost,
        supportsTools: model.supportsTools,
        isHidden: model.isHidden,
      };
      const newCostDisplayValues = {
        inputCostPerToken: model.inputCostPerToken !== undefined && model.inputCostPerToken !== null ? (model.inputCostPerToken * 1000000).toFixed(4) : '',
        outputCostPerToken: model.outputCostPerToken !== undefined && model.outputCostPerToken !== null ? (model.outputCostPerToken * 1000000).toFixed(4) : '',
        cacheReadInputTokenCost:
          model.cacheReadInputTokenCost !== undefined && model.cacheReadInputTokenCost !== null ? (model.cacheReadInputTokenCost * 1000000).toFixed(4) : '',
        cacheWriteInputTokenCost:
          model.cacheWriteInputTokenCost !== undefined && model.cacheWriteInputTokenCost !== null ? (model.cacheWriteInputTokenCost * 1000000).toFixed(4) : '',
      };

      // Batch state updates to avoid cascading renders
      startTransition(() => {
        setFormData(newFormData);
        setProviderOverrides(model.providerOverrides || {});
        setTemperatureEnabled(model.temperature !== undefined);
        setCostDisplayValues(newCostDisplayValues);
      });
    } else {
      const newFormData = {
        id: '',
        providerId: providers[0]?.id || '',
      };
      const newCostDisplayValues = {
        inputCostPerToken: '',
        outputCostPerToken: '',
        cacheReadInputTokenCost: '',
        cacheWriteInputTokenCost: '',
      };

      // Batch state updates to avoid cascading renders
      startTransition(() => {
        setFormData(newFormData);
        setProviderOverrides({});
        setTemperatureEnabled(false);
        setCostDisplayValues(newCostDisplayValues);
      });
    }

    startTransition(() => {
      setErrors({});
    });
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

    if (temperatureEnabled && formData.temperature && (formData.temperature < 0 || formData.temperature > 2)) {
      newErrors.temperature = t('modelLibrary.errors.invalidTemperature');
    }

    const inputCostValue = costDisplayValues.inputCostPerToken !== '' ? parseFloat(costDisplayValues.inputCostPerToken) / 1000000 : undefined;
    const outputCostValue = costDisplayValues.outputCostPerToken !== '' ? parseFloat(costDisplayValues.outputCostPerToken) / 1000000 : undefined;

    if (inputCostValue && inputCostValue < 0) {
      newErrors.inputCostPerToken = t('modelLibrary.errors.invalidCost');
    }

    if (outputCostValue && outputCostValue < 0) {
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
      temperature: temperatureEnabled ? formData.temperature : undefined,
      inputCostPerToken: costDisplayValues.inputCostPerToken !== '' ? parseFloat(costDisplayValues.inputCostPerToken) / 1000000 : undefined,
      outputCostPerToken: costDisplayValues.outputCostPerToken !== '' ? parseFloat(costDisplayValues.outputCostPerToken) / 1000000 : undefined,
      cacheReadInputTokenCost: costDisplayValues.cacheReadInputTokenCost !== '' ? parseFloat(costDisplayValues.cacheReadInputTokenCost) / 1000000 : undefined,
      cacheWriteInputTokenCost:
        costDisplayValues.cacheWriteInputTokenCost !== '' ? parseFloat(costDisplayValues.cacheWriteInputTokenCost) / 1000000 : undefined,
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

  const handleCostBlur = (field: keyof Model, displayField: keyof typeof costDisplayValues, inputValue: string) => {
    const perMillionValue = inputValue !== '' ? parseFloat(inputValue) : undefined;
    const perTokenValue = perMillionValue !== undefined ? perMillionValue / 1000000 : undefined;
    handleInputChange(field, perTokenValue);
    setCostDisplayValues((prev) => ({
      ...prev,
      [displayField]: perTokenValue !== undefined ? (perTokenValue * 1000000).toFixed(4) : '',
    }));
  };

  const handleTemperatureToggle = (enabled: boolean) => {
    setTemperatureEnabled(enabled);
    if (enabled) {
      handleInputChange('temperature', DEFAULT_MODEL_TEMPERATURE);
    } else {
      handleInputChange('temperature', undefined);
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
              label={
                <div className="flex justify-between items-center">
                  {t('modelLibrary.maxOutputTokens')}
                  {model?.maxOutputTokensLimit && (
                    <span className="text-text-muted text-xs">
                      {t('modelLibrary.limit')}: {model.maxOutputTokensLimit}
                    </span>
                  )}
                </div>
              }
              type="number"
              value={formData.maxOutputTokens !== undefined && formData.maxOutputTokens !== null ? formData.maxOutputTokens : ''}
              onChange={(e) =>
                handleInputChange(
                  'maxOutputTokens',
                  e.target.value !== ''
                    ? model?.maxOutputTokensLimit
                      ? Math.min(model?.maxOutputTokensLimit, parseInt(e.target.value))
                      : parseInt(e.target.value)
                    : undefined,
                )
              }
              max={model?.maxOutputTokensLimit || undefined}
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
              value={costDisplayValues.inputCostPerToken}
              onChange={(e) => setCostDisplayValues((prev) => ({ ...prev, inputCostPerToken: e.target.value }))}
              onBlur={(e) => handleCostBlur('inputCostPerToken', 'inputCostPerToken', e.target.value)}
            />
            {errors.inputCostPerToken && <p className="text-error text-2xs mt-1">{errors.inputCostPerToken}</p>}
          </div>

          <div>
            <Input
              label={t('modelLibrary.outputTokenCost')}
              type="number"
              step="0.01"
              value={costDisplayValues.outputCostPerToken}
              onChange={(e) => setCostDisplayValues((prev) => ({ ...prev, outputCostPerToken: e.target.value }))}
              onBlur={(e) => handleCostBlur('outputCostPerToken', 'outputCostPerToken', e.target.value)}
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
              value={costDisplayValues.cacheReadInputTokenCost}
              onChange={(e) => setCostDisplayValues((prev) => ({ ...prev, cacheReadInputTokenCost: e.target.value }))}
              onBlur={(e) => handleCostBlur('cacheReadInputTokenCost', 'cacheReadInputTokenCost', e.target.value)}
            />
          </div>

          <div>
            <Input
              label={t('modelLibrary.cacheWriteInputTokenCost')}
              type="number"
              step="0.01"
              value={costDisplayValues.cacheWriteInputTokenCost}
              onChange={(e) => setCostDisplayValues((prev) => ({ ...prev, cacheWriteInputTokenCost: e.target.value }))}
              onBlur={(e) => handleCostBlur('cacheWriteInputTokenCost', 'cacheWriteInputTokenCost', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 grid grid-cols-2 gap-4 mb-8">
          <div>
            <div className="flex justify-between items-center">
              <Checkbox
                label={
                  <div className="flex items-center text-sm">
                    <span>{t('modelLibrary.temperature')}</span>
                    <InfoIcon tooltip={t('modelLibrary.temperatureTooltip')} className="ml-2" />
                  </div>
                }
                checked={temperatureEnabled}
                onChange={handleTemperatureToggle}
              />
              {temperatureEnabled && <span className="text-sm font-medium text-text-primary">{formData.temperature}</span>}
            </div>
            {temperatureEnabled && (
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={formData.temperature ?? DEFAULT_MODEL_TEMPERATURE}
                onChange={(value) => handleInputChange('temperature', value)}
              />
            )}
            {errors.temperature && <p className="text-error text-2xs mt-1">{errors.temperature}</p>}
          </div>
        </div>

        {/* Advanced Settings - Provider Overrides */}
        {selectedProvider && (
          <div className="pt-2">
            <ModelParameterOverrides provider={selectedProvider.provider} overrides={providerOverrides} onChange={setProviderOverrides} />
          </div>
        )}

        <div className="flex justify-end">
          <Checkbox label={t('modelLibrary.hidden')} checked={formData.isHidden || false} onChange={(checked) => handleInputChange('isHidden', checked)} />
        </div>
      </div>
    </ConfirmDialog>
  );
};
