import { useTranslation } from 'react-i18next';

import { InfoIcon } from '@/components/common/InfoIcon';

export const AdvancedSettings = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <div className="flex items-center text-xs">
        {t('onboarding.providers.order')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.orderDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.allowFallbacks')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.allowFallbacksDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.dataCollection')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.dataCollectionDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.only')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.onlyDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.ignore')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.ignoreDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.quantizations')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.quantizationsDescription')} />
      </div>

      <div className="flex items-center text-xs">
        {t('onboarding.providers.sort')}
        <InfoIcon className="ml-1" tooltip={t('onboarding.providers.sortDescription')} />
      </div>
    </div>
  );
};
