import { useTranslation } from 'react-i18next';

import { InfoIcon } from '@/components/common/InfoIcon';

export const AdvancedSettings = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-center text-xs">
        {t('onboarding.providers.order')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.orderDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#ordering-specific-providers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.allowFallbacks')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.allowFallbacksDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#disabling-fallbacks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.dataCollection')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.dataCollectionDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#requiring-providers-to-comply-with-data-policies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.only')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.onlyDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#allowing-only-specific-providers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.ignore')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.ignoreDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#ignoring-providers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.quantizations')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.quantizationsDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#quantization"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.sort')}
        <div className="flex items-center gap-2 text-xs">
          <InfoIcon className="ml-1" tooltip={t('onboarding.providers.sortDescription')} />
          <a
            href="https://openrouter.ai/docs/features/provider-routing#provider-sorting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            {t('settings.common.learnMore')}
          </a>
        </div>
      </div>
    </div>
  );
};
