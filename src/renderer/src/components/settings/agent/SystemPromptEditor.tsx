import { ChangeEvent, ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SYSTEM_PROMPT_PLACEHOLDERS, SystemPromptPlaceholder, formatSystemPromptPlaceholder } from '@common/system-prompt-placeholders';

import { TextArea } from '@/components/common/TextArea';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
  info?: ReactNode;
};

export const SystemPromptEditor = ({ value, onChange, label, placeholder, className = 'min-h-[160px]', info }: Props) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleInsertPlaceholder = (placeholderName: SystemPromptPlaceholder) => {
    const token = formatSystemPromptPlaceholder(placeholderName);
    const textarea = textareaRef.current;

    if (!textarea) {
      onChange(`${value}${token}`);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    const nextCursor = start + token.length;

    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div>
      <TextArea ref={textareaRef} label={label} className={className} value={value} onChange={handleChange} placeholder={placeholder} />
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {SYSTEM_PROMPT_PLACEHOLDERS.map((name) => (
          <Tooltip key={name} content={t(`settings.agent.systemPromptPlaceholders.${name}`)}>
            <button
              type="button"
              onClick={() => handleInsertPlaceholder(name)}
              className="px-2 py-0.5 text-2xs font-mono rounded border border-border-default bg-bg-secondary-light text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            >
              {formatSystemPromptPlaceholder(name)}
            </button>
          </Tooltip>
        ))}
      </div>
      {info && <div className="text-2xs text-text-muted-light mt-2">{info}</div>}
    </div>
  );
};
