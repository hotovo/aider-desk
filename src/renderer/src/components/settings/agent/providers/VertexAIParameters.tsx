import { useTranslation } from 'react-i18next';
import { VertexAiProvider } from '@common/agent';
import { ChangeEvent } from 'react';

import { Input } from '@/components/common/Input';
import { TextArea } from '@/components/common/TextArea';
import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

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

  const handleThinkingBudgetChange = (value: number) => {
    onChange({ ...provider, thinkingBudget: value });
  };

  const handleIncludeThoughtsChange = (checked: boolean) => {
    onChange({ ...provider, includeThoughts: checked });
  };

  return (
    <div className="flex flex-col gap-2">
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
      <Slider
        label={t('gemini.thinkingBudget')}
        value={provider.thinkingBudget ?? 0}
        min={0}
        max={24576}
        onChange={handleThinkingBudgetChange}
        className="max-w-[360px]"
      />
      <div className="flex items-center space-x-2">
        <Checkbox
          label={<span className="text-sm">{t('gemini.includeThoughts')}</span>}
          checked={provider.includeThoughts ?? false}
          onChange={handleIncludeThoughtsChange}
        />
        <InfoIcon tooltip={t('gemini.includeThoughtsTooltip')} />
      </div>
    </div>
  );
};
