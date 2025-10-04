import { useTranslation } from 'react-i18next';
import { GeminiProvider } from '@common/agent';

import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';
import { WarningIcon } from '@/components/common/WarningIcon';

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
        <Checkbox
          label={<span className="text-sm">{t('gemini.includeThoughts')}</span>}
          checked={includeThoughts ?? false}
          onChange={handleIncludeThoughtsChange}
        />
        <InfoIcon tooltip={t('gemini.includeThoughtsTooltip')} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          label={<span className="text-sm">{t('gemini.useSearchGrounding')}</span>}
          checked={useSearchGrounding ?? false}
          onChange={handleUseSearchGroundingChange}
        />
        <InfoIcon tooltip={t('gemini.useSearchGroundingTooltip')} />
        {useSearchGrounding && <WarningIcon tooltip={t('gemini.useSearchGroundingWarning')} />}
      </div>
    </div>
  );
};
