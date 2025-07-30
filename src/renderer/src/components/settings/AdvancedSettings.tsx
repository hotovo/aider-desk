import { useTranslation } from 'react-i18next';

import { InfoIcon } from '@/components/common/InfoIcon';

export const AdvancedSettings = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-center text-xs">
        {t('onboarding.providers.order')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.orderDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#ordering-specific-providers"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.allowFallbacks')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.allowFallbacksDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#disabling-fallbacks"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.dataCollection')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.dataCollectionDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#requiring-providers-to-comply-with-data-policies"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.only')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.onlyDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#allowing-only-specific-providers"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.ignore')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.ignoreDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#ignoring-providers"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.quantizations')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.quantizationsDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#quantization"
        />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.sort')}
        <InfoIcon
          className="ml-1"
          tooltip={t('onboarding.providers.sortDescription')}
          url="https://openrouter.ai/docs/features/provider-routing#provider-sorting"
        />
      </div>
    </div>
  );
};
