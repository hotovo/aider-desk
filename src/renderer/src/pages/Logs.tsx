import { useTranslation } from 'react-i18next';

import { LogsPage } from '@/components/logs/LogsPage';

export const Logs = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full p-[4px] bg-gradient-to-b from-bg-primary to-bg-primary-light">
      <title>{t('logs.title')}</title>
      <div className="flex flex-col h-full border-2 border-border-default relative">
        <LogsPage onClose={() => window.close()} />
      </div>
    </div>
  );
};
