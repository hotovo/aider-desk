import { MouseEvent, useState } from 'react';
import { FaBrain, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { MdOutlineLightbulb } from 'react-icons/md';

import { CopyMessageButton } from './CopyMessageButton';
import { parseMessageContent } from './utils';

type Props = {
  thinking: string;
  answer?: string | null;
  baseDir?: string;
  allFiles?: string[];
};

export const ThinkingAnswerBlock = ({ thinking, answer, baseDir = '', allFiles = [] }: Props) => {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const handleToggleThinking = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsThinkingExpanded(!isThinkingExpanded);
  };

  return (
    <div className="flex flex-col w-full gap-3 pt-5">
      {/* Thinking section */}
      <div className="border border-neutral-700 rounded-md overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-2 bg-neutral-800 cursor-pointer hover:bg-neutral-750" onClick={handleToggleThinking}>
          <div className="flex items-center gap-2">
            <div className="text-neutral-200">{isThinkingExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}</div>
            <div className={`text-neutral-200 ${!answer ? 'animate-pulse' : ''}`}>
              <FaBrain size={16} />
            </div>
            <div className={`font-medium text-neutral-100 ${!answer ? 'animate-pulse' : ''}`}>THINKING</div>
          </div>
          {thinking && <CopyMessageButton content={thinking} className="text-neutral-600 hover:text-neutral-300" />}
        </div>

        {isThinkingExpanded && (
          <div className="p-3 text-xs whitespace-pre-wrap text-neutral-300 bg-neutral-850">{parseMessageContent(baseDir, thinking, allFiles)}</div>
        )}
      </div>

      {/* Answer section - only show if we have an answer or we're streaming */}
      {answer && (
        <div className="border border-neutral-700 rounded-md overflow-hidden">
          <div className="flex items-center justify-between gap-2 p-2 bg-neutral-800">
            <div className="flex items-center gap-2">
              <div className="text-neutral-200">
                <MdOutlineLightbulb size={18} />
              </div>
              <div className="font-medium text-neutral-100">ANSWER</div>
            </div>
            <CopyMessageButton content={answer} className="text-neutral-600 hover:text-neutral-300" />
          </div>
          <div className="p-3 text-xs whitespace-pre-wrap text-neutral-100 bg-neutral-850">{parseMessageContent(baseDir, answer, allFiles)}</div>
        </div>
      )}
    </div>
  );
};
