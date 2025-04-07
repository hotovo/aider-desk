import { useState, useEffect } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { CgSpinner } from 'react-icons/cg';
import { RiToolsFill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { VscError } from 'react-icons/vsc';
import clsx from 'clsx';

import { CopyMessageButton } from './CopyMessageButton';
import { parseToolContent } from './utils';

import { ToolMessage } from '@/types/message';

type Props = {
  message: ToolMessage;
};

export const ToolMessageBlock = ({ message }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded
  const isExecuting = message.content === '';
  const parsedResult = !isExecuting ? parseToolContent(message.content) : null;

  useEffect(() => {
    // Collapse after 2 seconds
    const timer = setTimeout(() => {
      setIsExpanded(false);
    }, 1000);

    // Cleanup function to clear the timeout if the component unmounts
    return () => clearTimeout(timer);
  }, []);

  const getResultContent = () => {
    if (!parsedResult) {
      return null;
    }

    let displayContent: string;
    let rawContentToCopy: string;

    if (parsedResult.parsedInnerJson) {
      // Display pretty-printed JSON
      displayContent = JSON.stringify(parsedResult.parsedInnerJson, null, 2);
      rawContentToCopy = JSON.stringify(parsedResult.parsedInnerJson); // Copy raw JSON
    } else if (parsedResult.extractedText) {
      // Display extracted text if inner JSON parsing failed
      displayContent = parsedResult.extractedText;
      rawContentToCopy = parsedResult.extractedText;
    } else {
      // Fallback to the original raw content if no text was extracted
      displayContent = parsedResult.rawContent;
      rawContentToCopy = parsedResult.rawContent;
    }

    return (
      <>
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2 font-semibold text-neutral-200">
            {t('toolMessage.result')}
            {parsedResult.isError === true && (
              <span className="flex items-center gap-1 text-red-500 text-xs font-normal">
                <VscError /> {t('toolMessage.error')}
              </span>
            )}
          </div>
          <CopyMessageButton content={rawContentToCopy} className="text-neutral-600 hover:text-neutral-300" />
        </div>
        <pre
          className={`whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 bg-neutral-900 p-2 rounded text-[11px] ${
            parsedResult.isError ? 'text-red-400' : 'text-neutral-300'
          }`}
        >
          {displayContent}
        </pre>
      </>
    );
  };

  return (
    <div className="border border-neutral-700 rounded-md mb-2">
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 p-2 px-3 bg-neutral-800 cursor-pointer hover:bg-neutral-750 select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`text-neutral-400 ${isExecuting ? 'animate-pulse' : ''}`}>
            <RiToolsFill className="w-4 h-4" />
          </div>
          <div className={`font-medium text-xs text-neutral-300 ${isExecuting ? 'animate-pulse' : ''}`}>
            {t('toolMessage.toolLabel', { server: message.serverName, tool: message.toolName })}
          </div>
          {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-neutral-400" />}
          {!isExecuting && parsedResult?.isError === true && <VscError className="text-red-500" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-neutral-400">{isExpanded ? <MdKeyboardArrowDown size={16} /> : <MdKeyboardArrowRight size={16} />}</div>
        </div>
      </div>

      {/* Content */}
      <div className={clsx('overflow-hidden transition-all duration-300 ease-in-out', isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0')}>
        {isExpanded && (
          <div className="p-3 text-xs whitespace-pre-wrap text-neutral-300 bg-neutral-850">
            {Object.keys(message.args).length > 0 && (
              <div className="mb-3">
                <div className="font-semibold mb-1 text-neutral-200">{t('toolMessage.arguments')}</div>
                <pre className="whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 bg-neutral-900 p-2 rounded text-neutral-300 text-[11px]">
                  {JSON.stringify(message.args, null, 2)}
                </pre>
              </div>
            )}
            {isExecuting ? <div className="text-xs italic text-neutral-400">{t('toolMessage.executing')}</div> : getResultContent()}
          </div>
        )}
      </div>
    </div>
  );
};
