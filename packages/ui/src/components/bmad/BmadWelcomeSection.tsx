import { useTranslation } from 'react-i18next';
import { FiPackage } from 'react-icons/fi';

export const BmadWelcomeSection = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="w-12 h-12 rounded-xl bg-button-primary-subtle flex items-center justify-center mb-4">
        <FiPackage className="w-6 h-6 text-button-primary" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{t('bmad.welcome.title')}</h2>
      <p className="text-sm text-text-secondary text-center">{t('bmad.welcome.subtitle')}</p>
    </div>
  );
};
