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
    <div className="flex flex-col w-full gap-3 pt-5">
      {/* Thinking section */}
      <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--theme-border-primary)' }}>
        <div 
          className="flex items-center justify-between gap-2 p-2 cursor-pointer transition-colors duration-200" 
          style={{ backgroundColor: 'var(--theme-background-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-background-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
          }}
          onClick={handleToggleThinking}
        >
          <div className="flex items-center gap-2">
            <div style={{ color: 'var(--theme-foreground-primary)' }}>{isThinkingExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}</div>
            <div className={!answer ? 'animate-pulse' : ''} style={{ color: 'var(--theme-foreground-primary)' }}>
              <FaBrain size={16} />
            </div>
            <div className={`font-medium ${!answer ? 'animate-pulse' : ''}`} style={{ color: 'var(--theme-foreground-primary)' }}>{t('thinkingAnswer.thinking')}</div>
          </div>
          {thinking && <CopyMessageButton content={thinking} className="text-[var(--theme-foreground-tertiary)] hover:text-[var(--theme-accent-primary)]" />}
        </div>

        {isThinkingExpanded && (
          <div 
            className={clsx('p-3 text-xs', !renderMarkdown && 'whitespace-pre-wrap break-words')}
            style={{ 
              color: 'var(--theme-foreground-secondary)', 
              backgroundColor: 'var(--theme-background-primary)' 
            }}
          >
            {parsedThinking}
          </div>
        )}
      </div>

      {/* Answer section - only show if we have an answer or we're streaming */}
      {answer && parsedAnswer && (
        <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--theme-border-primary)' }}>
          <div className="flex items-center justify-between gap-2 p-2" style={{ backgroundColor: 'var(--theme-background-tertiary)' }}>
            <div className="flex items-center gap-2">
              <div style={{ color: 'var(--theme-foreground-primary)' }}>
                <MdOutlineLightbulb size={18} />
              </div>
              <div className="font-medium" style={{ color: 'var(--theme-foreground-primary)' }}>{t('thinkingAnswer.answer')}</div>
            </div>
            <CopyMessageButton content={answer} className="text-[var(--theme-foreground-tertiary)] hover:text-[var(--theme-accent-primary)]" />
          </div>
          <div 
            className={clsx('p-3 text-xs', !renderMarkdown && 'whitespace-pre-wrap break-words')}
            style={{ 
              color: 'var(--theme-foreground-primary)', 
              backgroundColor: 'var(--theme-background-primary)' 
            }}
          >
            {parsedAnswer}
          </div>
        </div>
      )}
    </div>
  );
};
