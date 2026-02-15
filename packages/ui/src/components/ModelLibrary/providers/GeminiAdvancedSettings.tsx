import { useTranslation } from 'react-i18next';
import { GeminiProvider } from '@aider-desk/common/agent';

import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: GeminiProvider;
  onChange: (updated: GeminiProvider) => void;
};

export const GeminiAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { thinkingBudget, includeThoughts, useSearchGrounding } = provider;

  const handleThinkingBudgetChange = (value: number) => {
    onChange({ ...provider, thinkingBudget: value });
  };

  const handleIncludeThoughtsChange = (checked: boolean) => {
    onChange({ ...provider, includeThoughts: checked });
  };

  const handleUseSearchGroundingChange = (checked: boolean) => {
    onChange({ ...provider, useSearchGrounding: checked });
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
        <Checkbox label={t('gemini.includeThoughts')} checked={includeThoughts ?? false} size="md" onChange={handleIncludeThoughtsChange} />
        <InfoIcon tooltip={t('gemini.includeThoughtsTooltip')} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox label={t('gemini.useSearchGrounding')} checked={useSearchGrounding ?? false} onChange={handleUseSearchGroundingChange} size="md" />
        <InfoIcon tooltip={t('gemini.useSearchGroundingTooltip')} />
      </div>
    </div>
  );
};
