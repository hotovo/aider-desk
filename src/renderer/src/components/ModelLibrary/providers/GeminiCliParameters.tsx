import React from 'react';
import { useTranslation } from 'react-i18next';
import { GeminiCliProvider } from '@common/agent';

import { Input } from '@/components/common/Input';

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
      <Input
        label={t('modelLibrary.projectId')}
        value={provider.projectId || ''}
        onChange={handleProjectIdChange}
        placeholder={t('modelLibrary.projectIdPlaceholder')}
      />
      <div className="rounded-md border border-border-default-dark p-3 text-2xs text-text-primary bg-bg-secondary">
        {t('modelLibrary.geminiCliAuthRequired')}
      </div>
      <div className="rounded-md border border-border-default-dark p-3 text-2xs text-text-primary bg-bg-secondary">{t('modelLibrary.geminiCliAgentOnly')}</div>
    </div>
  );
};
