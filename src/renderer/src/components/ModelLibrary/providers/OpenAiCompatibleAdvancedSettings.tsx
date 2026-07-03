import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiCompatibleProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Select, Option } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';
import { TextArea } from '@/components/common/TextArea';
import { Accordion } from '@/components/common/Accordion';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: OpenAiCompatibleProvider;
  onChange: (updated: OpenAiCompatibleProvider) => void;
};

export const OpenAiCompatibleAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const reasoningEffort = provider.reasoningEffort || ReasoningEffort.None;

  const reasoningOptions: Option[] = [
    { value: ReasoningEffort.None, label: t('reasoningEffort.none') },
    { value: ReasoningEffort.Minimal, label: t('reasoningEffort.minimal') },
    { value: ReasoningEffort.Low, label: t('reasoningEffort.low') },
    { value: ReasoningEffort.Medium, label: t('reasoningEffort.medium') },
    { value: ReasoningEffort.High, label: t('reasoningEffort.high') },
    { value: ReasoningEffort.XHigh, label: t('reasoningEffort.xhigh') },
  ];

  const [extraBodyText, setExtraBodyText] = useState(() => {
    const extraBody = provider.extraBody as Record<string, unknown> | undefined;
    if (!extraBody || Object.keys(extraBody).length === 0) {
      return '';
    }
    try {
      return JSON.stringify(extraBody, null, 2);
    } catch {
      return '';
    }
  });

  const [extraBodyError, setExtraBodyError] = useState<string | null>(null);

  const handleReasoningEffortChange = (value: string) => {
    onChange({
      ...provider,
      reasoningEffort: value as ReasoningEffort,
    });
  };

  const handleTrackTokenUsageChange = (trackTokenUsage: boolean) => {
    onChange({
      ...provider,
      trackTokenUsage,
    });
  };

  const handleExtraBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setExtraBodyText(value);
    if (!value.trim()) {
      setExtraBodyError(null);
      onChange({ ...provider, extraBody: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setExtraBodyError(t('modelLibrary.extraBodyErrorInvalid'));
        return;
      }
      setExtraBodyError(null);
      onChange({ ...provider, extraBody: parsed });
    } catch {
      setExtraBodyError(t('modelLibrary.extraBodyErrorInvalid'));
    }
  };

  return (
    <div className="space-y-4">
      <Select
        label={
          <div className="flex items-center font-medium">
            <span>{t('reasoningEffort.label')}</span>
            <InfoIcon className="ml-1" tooltip={t('reasoningEffort.tooltip')} />
          </div>
        }
        value={reasoningEffort}
        onChange={handleReasoningEffortChange}
        options={reasoningOptions}
      />
      <div className="flex items-center space-x-2">
        <Checkbox label={t('modelLibrary.trackTokenUsage')} checked={provider.trackTokenUsage !== false} onChange={handleTrackTokenUsageChange} size="md" />
        <InfoIcon tooltip={t('modelLibrary.trackTokenUsageInfo')} />
      </div>
      <Accordion
        title={
          <div className="flex items-center text-sm font-medium gap-1">
            <span>{t('modelLibrary.extraBody')}</span>
            <InfoIcon className="ml-1" tooltip={t('modelLibrary.extraBodyInfo')} />
          </div>
        }
        className="border rounded-md border-border-default"
      >
        <div className="p-4 pt-2">
          <TextArea
            value={extraBodyText}
            onChange={handleExtraBodyChange}
            placeholder={'{\n  "thinking": {\n    "type": "adaptive"\n  }\n}'}
            rows={5}
            error={extraBodyError}
          />
        </div>
      </Accordion>
    </div>
  );
};
