import { ReactNode, useEffect, useRef, useState } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { CgSpinner } from 'react-icons/cg';
import { RiToolsFill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { VscError } from 'react-icons/vsc';
import clsx from 'clsx';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
} from '@common/tools';

import { CopyMessageButton } from './CopyMessageButton';
import { parseToolContent } from './utils';

import { ToolMessage } from '@/types/message';
import { MessageBar } from '@/components/message/MessageBar';
import { CodeInline } from '@/components/message/CodeInline';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ToolMessageBlock = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true); // Controls visibility
  const [isInitialAutoExpand, setIsInitialAutoExpand] = useState(true); // Tracks the initial phase
  const isExecuting = message.content === '';
  const parsedResult = !isExecuting ? parseToolContent(message.content) : null;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);

  useEffect(() => {
    // Auto-collapse only during the initial phase
    if (isInitialAutoExpand) {
      timerRef.current = setTimeout(() => {
        // Check again inside timeout in case user clicked during the delay
        if (isInitialAutoExpand) {
          setIsExpanded(false);
          setIsInitialAutoExpand(false); // End the initial phase
        }
      }, 2000);
    }

    // Cleanup function to clear the timeout
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isInitialAutoExpand]); // Depend only on isInitialAutoExpand

  const getToolLabel = (message: ToolMessage): ReactNode => {
    const defaultLabel = () => t('toolMessage.toolLabel', { server: formatName(message.serverName), tool: formatName(message.toolName) });

    switch (message.serverName) {
      case AIDER_TOOL_GROUP_NAME:
        switch (message.toolName) {
          case AIDER_TOOL_ADD_CONTEXT_FILES: {
            // Handles message.args.paths (array) or fallback to message.args.path (string)
            const addPaths =
              message.args.paths && Array.isArray(message.args.paths)
                ? (message.args.paths as string[]).map((path) => `• ${path}`).join('\n')
                : (message.args.path as string) || '...';
            return t('toolMessage.aider.addContextFiles', { paths: addPaths });
          }
          case AIDER_TOOL_DROP_CONTEXT_FILES: {
            // Handles message.args.paths (array) or fallback to message.args.path (string)
            const dropPaths =
              message.args.paths && Array.isArray(message.args.paths)
                ? (message.args.paths as string[]).map((path) => `• ${path}`).join('\n')
                : (message.args.path as string) || '...';
            return t('toolMessage.aider.dropContextFiles', { paths: dropPaths });
          }
          case AIDER_TOOL_RUN_PROMPT:
            return t('toolMessage.aider.runPrompt');
          default:
            return defaultLabel();
        }
      case POWER_TOOL_GROUP_NAME:
        switch (message.toolName) {
          case POWER_TOOL_FILE_READ:
            return (
              <div className="flex flex-wrap gap-1">
                <span>{t('toolMessage.power.fileRead')}</span>
                <span>
                  <CodeInline className="bg-neutral-900">{(message.args.filePath as string).split(/[/\\]/).pop()}</CodeInline>
                </span>
              </div>
            );
          case POWER_TOOL_GLOB:
            return t('toolMessage.power.glob', { pattern: message.args.pattern as string });
          case POWER_TOOL_GREP:
            return t('toolMessage.power.grep', { filePattern: message.args.filePattern as string, searchTerm: message.args.searchTerm as string });
          case POWER_TOOL_BASH:
            return (
              <div className="flex flex-wrap gap-1">
                <span>{t('toolMessage.power.bash')}</span>
                <span>
                  <CodeInline className="bg-neutral-900">{message.args.command as string}</CodeInline>
                </span>
              </div>
            );
          case POWER_TOOL_SEMANTIC_SEARCH:
            return t('toolMessage.power.semanticSearch', { query: message.args.searchQuery as string, path: (message.args.path as string) || '' });
          default:
            return defaultLabel();
        }
      default:
        return defaultLabel();
    }
  };

  const renderToolSpecificContent = () => {
    if (message.serverName === AIDER_TOOL_GROUP_NAME && message.toolName === AIDER_TOOL_RUN_PROMPT) {
      const promptText = message.args.prompt as string;

      return (
        <div className="text-xs text-neutral-300 pt-2 px-3">
          <pre className="whitespace-pre-wrap bg-neutral-900 p-2 rounded text-neutral-300 text-2xs my-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-600">
            {promptText}
          </pre>
          {parsedResult?.json && 'deniedReason' in parsedResult.json && typeof parsedResult.json.deniedReason === 'string' && (
            <div className="flex items-start gap-1 text-neutral-100 text-2xs font-normal mt-2 whitespace-pre-wrap px-1">
              {t('toolMessage.deniedByReason', { reason: parsedResult.json.deniedReason })}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const handleHeaderClick = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Always end the initial phase on click
    if (isInitialAutoExpand) {
      setIsInitialAutoExpand(false);
    }
    // Toggle expansion state
    setIsExpanded((prev) => !prev);
  };

  const getResultContent = () => {
    if (!parsedResult) {
      return null;
    }

    let displayContent: string;
    let rawContentToCopy: string;

    if (parsedResult.json) {
      // Display pretty-printed JSON
      displayContent = JSON.stringify(parsedResult.json, null, 2);
      rawContentToCopy = JSON.stringify(parsedResult.json); // Copy raw JSON
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
          className={`whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-600 bg-neutral-900 p-2 rounded text-[11px] ${
            parsedResult.isError ? 'text-red-400' : 'text-neutral-200'
          }`}
        >
          {displayContent}
        </pre>
      </>
    );
  };

  return (
    <div className="border border-neutral-800 rounded-md mb-2 group p-3 bg-neutral-850">
      {/* Header */}
      <div className="flex items-center justify-between gap-2  cursor-pointer hover:bg-neutral-750 select-none rounded-t-md" onClick={handleHeaderClick}>
        <div className="flex items-center gap-2">
          <div className={`text-neutral-500 ${isExecuting ? 'animate-pulse' : ''}`}>
            <RiToolsFill className="w-4 h-4" />
          </div>
          <div className={`text-xs text-neutral-100 whitespace-pre ${isExecuting ? 'animate-pulse' : ''} flex items-center gap-1`}>{getToolLabel(message)}</div>
          {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-neutral-400" />}
          {!isExecuting && parsedResult?.isError === true && <VscError className="text-red-500" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-neutral-300">{isExpanded ? <MdKeyboardArrowDown size={16} /> : <MdKeyboardArrowRight size={16} />}</div>
        </div>
      </div>

      {/* Tool Specific Content */}
      {renderToolSpecificContent()}

      {/* Content */}
      <div
        className={clsx('overflow-hidden transition-all duration-300 ease-in-out relative', {
          'max-h-0 opacity-0': !isExpanded,
          'max-h-[150px] opacity-100': isExpanded && isInitialAutoExpand, // Initial limited height
          'max-h-[1000px] opacity-100': isExpanded && !isInitialAutoExpand, // Full height after click or initial phase ends
        })}
      >
        {/* Add relative positioning for the gradient overlay */}
        <div className={clsx('p-3 text-xs whitespace-pre-wrap text-neutral-300 bg-neutral-850')}>
          {Object.keys(message.args).length > 0 && (
            <div className="mb-3">
              <div className="font-semibold mb-1 text-neutral-200">{t('toolMessage.arguments')}</div>
              <pre className="whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 bg-neutral-900 p-2 rounded text-neutral-200 text-2xs">
                {JSON.stringify(message.args, null, 2)}
              </pre>
            </div>
          )}
          {isExecuting ? (
            <div className="text-xs italic text-neutral-400">{t('toolMessage.executing')}</div>
          ) : isExpanded && !isInitialAutoExpand ? (
            getResultContent()
          ) : null}
          {/* Gradient overlay for initial auto-expand */}
          {isExpanded && isInitialAutoExpand && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-neutral-850 via-neutral-850 to-transparent pointer-events-none"></div>
          )}
        </div>
      </div>
      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
