import { MouseEvent, useState } from 'react';
import { FaBrain, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { MdOutlineLightbulb } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

import { CopyMessageButton } from './CopyMessageButton';

import { useParsedContent } from '@/hooks/useParsedContent';

type Props = {
  thinking: string;
  answer?: string | null;
  baseDir?: string;
  allFiles?: string[];
  renderMarkdown: boolean;
};

export const ThinkingAnswerBlock = ({ thinking, answer, baseDir = '', allFiles = [], renderMarkdown }: Props) => {
  const { t } = useTranslation();
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const parsedThinking = useParsedContent(baseDir, thinking, allFiles, renderMarkdown);
  const parsedAnswer = useParsedContent(baseDir, answer, allFiles, renderMarkdown);

  const handleToggleThinking = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsThinkingExpanded(!isThinkingExpanded);
  };

  return (
    <div className="flex flex-col w-full gap-3 pt-0">
      {/* Thinking section */}
      <div className="border border-border-default-dark rounded-md overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-2 bg-bg-secondary-light cursor-pointer hover:bg-bg-tertiary" onClick={handleToggleThinking}>
          <div className="flex items-center gap-2">
            <div className="text-text-secondary">{isThinkingExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}</div>
            <div className={`text-text-secondary ${!answer ? 'animate-pulse' : ''}`}>
              <FaBrain size={16} />
            </div>
            <div className={`font-medium text-text-primary ${!answer ? 'animate-pulse' : ''}`}>{t('thinkingAnswer.thinking')}</div>
          </div>
          {thinking && <CopyMessageButton content={thinking} className="text-text-mutedDark hover:text-text-tertiary" />}
        </div>

        {isThinkingExpanded && (
          <div className={clsx('p-3 text-xs text-text-tertiary bg-bg-secondary', !renderMarkdown && 'whitespace-pre-wrap break-words')}>{parsedThinking}</div>
        )}
      </div>

      {/* Answer section - only show if we have an answer or we're streaming */}
      {answer && parsedAnswer && (
        <div className="border border-border-default-dark rounded-md overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-2 bg-bg-secondary-light">
            <div className="flex items-center gap-2">
              <div className="text-text-secondary">
                <MdOutlineLightbulb size={18} />
              </div>
              <div className="font-medium text-text-primary">{t('thinkingAnswer.answer')}</div>
            </div>
            <CopyMessageButton content={answer} className="text-text-mutedDark hover:text-text-tertiary" />
          </div>
          <div className={clsx('p-3 text-xs text-text-primary bg-bg-secondary', !renderMarkdown && 'whitespace-pre-wrap break-words')}>{parsedAnswer}</div>
        </div>
      )}
    </div>
  );
};
