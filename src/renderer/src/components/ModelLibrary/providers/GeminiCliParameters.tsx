import React from 'react';
import { useTranslation } from 'react-i18next';
import { GeminiCliProvider } from '@common/agent';

type Props = {
  provider: GeminiCliProvider;
  onChange: (updated: GeminiCliProvider) => void;
};

export const GeminiCliParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...provider,
      projectId: e.target.value,
    });
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border-default-dark p-3 text-xs text-text-primary">{t('modelLibrary.geminiCliAuthRequired')}</div>
      <div className="rounded-md border border-border-default-dark p-3 text-xs text-text-primary">{t('modelLibrary.geminiCliAgentOnly')}</div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">{t('modelLibrary.projectId')}</label>
        <input
          type="text"
          value={provider.projectId || ''}
          onChange={handleProjectIdChange}
          placeholder={t('modelLibrary.projectIdPlaceholder')}
          className="w-full px-2 py-1 text-xs bg-bg-primary text-text-primary border border-border-default-dark rounded-md focus:outline-none focus:ring-1 focus:ring-accent-primary"
        />
      </div>
    </div>
  );
};
