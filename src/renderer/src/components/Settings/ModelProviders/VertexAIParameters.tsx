import { LabeledInput } from '@renderer/components/LabeledInput';
import { LabeledTextArea } from '@renderer/components/LabeledTextArea';
import { useTranslation } from 'react-i18next';
import { LlmProviderComponentProps } from './common';
import { VertexAiProvider } from '@common/agent';

export const VertexAIParameters = ({ settings, onSettingsChange }: LlmProviderComponentProps) => {
  const { t } = useTranslation();

  const provider = settings.llmProviders['vertex-ai'] as VertexAiProvider;

  const handleProjectChange = (value: string) => {
    onSettingsChange({
      ...settings,
      llmProviders: {
        ...settings.llmProviders,
        'vertex-ai': {
          ...provider,
          project: value,
        },
      },
    });
  };

  const handleLocationChange = (value: string) => {
    onSettingsChange({
      ...settings,
      llmProviders: {
        ...settings.llmProviders,
        'vertex-ai': {
          ...provider,
          location: value,
        },
      },
    });
  };

  const handleCredentialsChange = (value: string) => {
    onSettingsChange({
      ...settings,
      llmProviders: {
        ...settings.llmProviders,
        'vertex-ai': {
          ...provider,
          googleCloudCredentialsJson: value,
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <LabeledInput
        label={t('Project')}
        placeholder={t('Enter Project ID')}
        value={provider.project}
        onChange={handleProjectChange}
      />
      <LabeledInput
        label={t('Location')}
        placeholder={t('Enter Location')}
        value={provider.location}
        onChange={handleLocationChange}
      />
      <LabeledTextArea
        label={t('Google Cloud Credentials (optional)')}
        placeholder={t('Enter Credentials JSON...')}
        value={provider.googleCloudCredentialsJson || ''}
        onChange={handleCredentialsChange}
      />
    </div>
  );
};
