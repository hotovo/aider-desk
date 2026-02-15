import { useTranslation } from 'react-i18next';
import { VertexAiProvider } from '@aider-desk/common/agent';

import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: VertexAiProvider;
  onChange: (updated: VertexAiProvider) => void;
};

export const VertexAiAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { thinkingBudget, includeThoughts } = provider;

  const handleThinkingBudgetChange = (value: number) => {
    onChange({ ...provider, thinkingBudget: value });
  };

  const handleIncludeThoughtsChange = (checked: boolean) => {
    onChange({ ...provider, includeThoughts: checked });
  };

  return (
    <div className="space-y-4">
      <Slider
        label={t('gemini.thinkingBudget')}
        value={thinkingBudget ?? 0}
        min={0}
        max={24576}
        onChange={handleThinkingBudgetChange}
        className="max-w-[360px]"
      />
      <div className="flex items-center space-x-2">
        <Checkbox
          label={<span className="text-sm">{t('gemini.includeThoughts')}</span>}
          checked={includeThoughts ?? false}
          onChange={handleIncludeThoughtsChange}
        />
        <InfoIcon tooltip={t('gemini.includeThoughtsTooltip')} />
      </div>
    </div>
  );
};
