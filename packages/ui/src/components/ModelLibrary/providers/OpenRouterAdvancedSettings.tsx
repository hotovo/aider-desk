import { useTranslation } from 'react-i18next';
import { OpenRouterProvider } from '@aider-desk/common/agent';

import { useArrayField } from './useArrayField';

import { InfoIcon } from '@/components/common/InfoIcon';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  provider: OpenRouterProvider;
  onChange: (updated: OpenRouterProvider) => void;
};

export const OpenRouterAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const orderField = useArrayField(provider, 'order', onChange);
  const onlyField = useArrayField(provider, 'only', onChange);
  const ignoreField = useArrayField(provider, 'ignore', onChange);
  const quantizationsField = useArrayField(provider, 'quantizations', onChange);

  const handleAllowFallbacksChange = (checked: boolean) => {
    onChange({
      ...provider,
      allowFallbacks: checked,
    });
  };

  const handleDataCollectionChange = (value: string) => {
    onChange({
      ...provider,
      dataCollection: value as 'allow' | 'deny',
    });
  };

  const handleSortChange = (value: string) => {
    onChange({
      ...provider,
      sort: value ? (value as 'price' | 'throughput') : null,
    });
  };

  const handleRequireParametersChange = (checked: boolean) => {
    onChange({
      ...provider,
      requireParameters: checked,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Input
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.order')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.orderDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#ordering-specific-providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          placeholder="e.g. anthropic, openai"
          value={orderField.value}
          onChange={orderField.onChange}
          onBlur={orderField.onBlur}
          className="flex-1"
        />
        <div className="flex items-center gap-2 mt-4">
          <Checkbox
            label={
              <div className="flex items-center text-xs">
                {t('onboarding.providers.allowFallbacks')}
                <div className="flex items-center gap-2">
                  <InfoIcon className="ml-1" tooltip={t('onboarding.providers.allowFallbacksDescription')} />
                  <a
                    href="https://openrouter.ai/docs/features/provider-routing#disabling-fallbacks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info-lighter hover:text-info-lightest ml-1"
                  >
                    {t('settings.common.learnMore')}
                  </a>
                </div>
              </div>
            }
            onChange={handleAllowFallbacksChange}
            checked={provider.allowFallbacks}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.only')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.onlyDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#allowing-only-specific-providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          placeholder="e.g. anthropic, openai"
          value={onlyField.value}
          onChange={onlyField.onChange}
          onBlur={onlyField.onBlur}
          className="flex-1"
        />
        <Input
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.ignore')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.ignoreDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#ignoring-providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          placeholder="e.g. anthropic, openai"
          value={ignoreField.value}
          onChange={ignoreField.onChange}
          onBlur={ignoreField.onBlur}
          className="flex-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-2">
        <Input
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.quantizations')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.quantizationsDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#quantization"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          placeholder="e.g. int4, int8"
          value={quantizationsField.value}
          onChange={quantizationsField.onChange}
          onBlur={quantizationsField.onBlur}
        />
        <Checkbox
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.requireParameters')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.requireParametersDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#requiring-providers-to-support-all-parameters-beta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          onChange={handleRequireParametersChange}
          checked={provider.requireParameters}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-2">
        <Select
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.sort')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.sortDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#provider-sorting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          options={[
            { label: '-', value: '' },
            { label: 'price', value: 'price' },
            { label: 'throughput', value: 'throughput' },
          ]}
          value={provider.sort || ''}
          onChange={handleSortChange}
        />
        <Select
          label={
            <div className="flex items-center text-xs">
              {t('onboarding.providers.dataCollection')}
              <div className="flex items-center gap-2">
                <InfoIcon className="ml-1" tooltip={t('onboarding.providers.dataCollectionDescription')} />
                <a
                  href="https://openrouter.ai/docs/features/provider-routing#requiring-providers-to-comply-with-data-policies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info-lighter hover:text-info-lightest ml-1"
                >
                  {t('settings.common.learnMore')}
                </a>
              </div>
            </div>
          }
          options={[
            { label: 'allow', value: 'allow' },
            { label: 'deny', value: 'deny' },
          ]}
          value={provider.dataCollection || 'allow'}
          onChange={handleDataCollectionChange}
        />
      </div>
    </div>
  );
};
