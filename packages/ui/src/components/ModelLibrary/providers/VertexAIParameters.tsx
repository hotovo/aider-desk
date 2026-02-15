import { useTranslation } from 'react-i18next';
import { VertexAiProvider } from '@aider-desk/common/agent';
import { ChangeEvent } from 'react';

import { VertexAiAdvancedSettings } from './VertexAiAdvancedSettings';

import { Input } from '@/components/common/Input';
import { TextArea } from '@/components/common/TextArea';

type Props = {
  provider: VertexAiProvider;
  onChange: (updated: VertexAiProvider) => void;
};

export const VertexAIParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const handleProjectChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...provider,
      project: e.target.value,
    });
  };

  const handleLocationChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...provider,
      location: e.target.value,
    });
  };

  const handleCredentialsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({
      ...provider,
      googleCloudCredentialsJson: e.target.value,
    });
  };

  return (
    <div className="space-y-4">
      <Input
        label={t('settings.vertexAi.project')}
        placeholder={t('settings.vertexAi.projectPlaceholder')}
        value={provider.project}
        onChange={handleProjectChange}
      />
      <Input
        label={t('settings.vertexAi.location')}
        placeholder={t('settings.vertexAi.locationPlaceholder')}
        value={provider.location}
        onChange={handleLocationChange}
      />
      <TextArea
        label={t('settings.vertexAi.credentials')}
        placeholder={t('settings.vertexAi.credentialsPlaceholder')}
        value={provider.googleCloudCredentialsJson || ''}
        onChange={handleCredentialsChange}
      />

      <VertexAiAdvancedSettings provider={provider} onChange={onChange} />
    </div>
  );
};
