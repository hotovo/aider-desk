import { MouseEvent, useState } from 'react';
import { FaBrain, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

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
    <div className="flex flex-col w-full gap-1 pt-0">
      {/* Thinking section */}
      <div className="border border-border-default-dark rounded-md overflow-hidden ml-2">
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 bg-bg-secondary-light cursor-pointer hover:bg-bg-tertiary w-full"
          onClick={handleToggleThinking}
        >
          <div className="flex items-center gap-2 w-full">
            <div className={`text-text-secondary ${!answer ? 'animate-pulse' : ''}`}>
              <FaBrain className="w-4 h-4" />
            </div>
            <div className={`font-medium text-text-primary flex-1 ${!answer ? 'animate-pulse' : ''}`}>{t('thinkingAnswer.thinking')}</div>
          </div>
          {thinking && <CopyMessageButton content={thinking} className="text-text-muted-dark hover:text-text-tertiary" />}
          <div className="text-text-secondary">{isThinkingExpanded ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}</div>
        </div>

        {isThinkingExpanded && (
          <div className={clsx('p-3 text-xs text-text-tertiary bg-bg-secondary', !renderMarkdown && 'whitespace-pre-wrap break-words')}>{parsedThinking}</div>
        )}
      </div>

      {/* Answer section - only show if we have an answer or we're streaming */}
      {answer && parsedAnswer && (
        <div className="overflow-hidden relative">
          <div className={clsx('p-3 text-xs text-text-primary bg-bg-secondary', !renderMarkdown && 'whitespace-pre-wrap break-words')}>{parsedAnswer}</div>
        </div>
      )}
    </div>
  );
};
