import { ReactNode, memo } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { RiToolsFill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { VscError } from 'react-icons/vsc';
import { IoChevronDown, IoChevronForward } from 'react-icons/io5';
import { clsx } from 'clsx';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FETCH,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
} from '@common/tools';

import { CopyMessageButton } from './CopyMessageButton';
import { parseToolContent } from './utils';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';

type Props = {
  message: ToolMessage;
  isExpanded: boolean;
  onToggle: () => void;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const CompactToolMessageComponent = ({ message, isExpanded, onToggle }: Props) => {
  const { t } = useTranslation();
  const isExecuting = message.content === '';
  const parsedResult = !isExecuting ? parseToolContent(message.content) : null;

  const getToolLabel = (toolMessage: ToolMessage): ReactNode => {
    const defaultLabel = () => t('toolMessage.toolLabel', { server: formatName(toolMessage.serverName), tool: formatName(toolMessage.toolName) });

    switch (toolMessage.serverName) {
      case AIDER_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case AIDER_TOOL_ADD_CONTEXT_FILES: {
            const addPaths =
              toolMessage.args.paths && Array.isArray(toolMessage.args.paths)
                ? (toolMessage.args.paths as string[]).map((path) => `• ${path}`).join('\\n')
                : (toolMessage.args.path as string) || '...';
            return t('toolMessage.aider.addContextFiles', { paths: addPaths });
          }
          case AIDER_TOOL_DROP_CONTEXT_FILES: {
            const dropPaths =
              toolMessage.args.paths && Array.isArray(toolMessage.args.paths)
                ? (toolMessage.args.paths as string[]).map((path) => `• ${path}`).join('\\n')
                : (toolMessage.args.path as string) || '...';
            return t('toolMessage.aider.dropContextFiles', { paths: dropPaths });
          }
          case AIDER_TOOL_RUN_PROMPT:
            return t('toolMessage.aider.runPrompt');
          default:
            return defaultLabel();
        }
      case POWER_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case POWER_TOOL_FILE_READ:
            return (
              <div className="flex flex-wrap gap-1">
                <span>{t('toolMessage.power.fileRead.title')}</span>
                <span>
                  <CodeInline className="bg-bg-primary-light">{(toolMessage.args.filePath as string).split(/[/\\\\]/).pop()}</CodeInline>
                </span>
              </div>
            );
          case POWER_TOOL_GLOB:
            return t('toolMessage.power.glob', { pattern: toolMessage.args.pattern as string });
          case POWER_TOOL_GREP:
            return t('toolMessage.power.grep', { filePattern: toolMessage.args.filePattern as string, searchTerm: toolMessage.args.searchTerm as string });
          case POWER_TOOL_BASH:
            return (
              <div className="flex flex-wrap gap-1">
                <span>{t('toolMessage.power.bash')}</span>
                <span>
                  <CodeInline className="bg-bg-primary-light">{toolMessage.args.command as string}</CodeInline>
                </span>
              </div>
            );
          case POWER_TOOL_SEMANTIC_SEARCH:
            return t('toolMessage.power.semanticSearch', { query: toolMessage.args.searchQuery as string, path: (toolMessage.args.path as string) || '' });
          case POWER_TOOL_FETCH:
            return t('toolMessage.power.fetch', { url: toolMessage.args.url as string });
          default:
            return defaultLabel();
        }
      default:
        return defaultLabel();
    }
  };

  const getResultContent = () => {
    if (!parsedResult) {
      return null;
    }

    let displayContent: string;
    let rawContentToCopy: string;

    if (parsedResult.json) {
      displayContent = JSON.stringify(parsedResult.json, null, 2);
      rawContentToCopy = JSON.stringify(parsedResult.json);
    } else if (parsedResult.extractedText) {
      displayContent = parsedResult.extractedText;
      rawContentToCopy = parsedResult.extractedText;
    } else {
      displayContent = parsedResult.rawContent;
      rawContentToCopy = parsedResult.rawContent;
    }

    return (
      <>
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2 font-semibold text-text-secondary">
            {t('toolMessage.result')}
            {parsedResult.isError === true && (
              <span className="flex items-center gap-1 text-error text-xs font-normal">
                <VscError /> {t('toolMessage.error')}
              </span>
            )}
          </div>
          <CopyMessageButton content={rawContentToCopy} className="text-text-muted-dark hover:text-text-tertiary" />
        </div>
        <pre
          className={clsx(
            'whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-[11px]',
            parsedResult.isError ? 'text-error-light' : 'text-text-secondary',
          )}
        >
          {displayContent}
        </pre>
      </>
    );
  };

  return (
    <div className="border border-border-dark-light rounded-md bg-bg-secondary overflow-hidden">
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-2 hover:bg-bg-primary-light transition-colors duration-150 flex items-center gap-2"
      >
        <div className="text-text-muted text-xs">{isExpanded ? <IoChevronDown className="w-3 h-3" /> : <IoChevronForward className="w-3 h-3" />}</div>
        <div className={clsx('text-text-muted', isExecuting && 'animate-pulse')}>
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className={clsx('text-xs text-text-primary whitespace-pre flex items-center gap-1 flex-1', isExecuting && 'animate-pulse')}>
          {getToolLabel(message)}
        </div>
        {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
        {!isExecuting && parsedResult?.isError === true && <VscError className="text-error flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="text-2xs whitespace-pre-wrap text-text-tertiary bg-bg-secondary border-t border-border-dark-light p-3">
          {Object.keys(message.args).length > 0 && (
            <div className="mb-3">
              <div className="font-semibold mb-1 text-text-secondary">{t('toolMessage.arguments')}</div>
              <pre className="whitespace-pre-wrap max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-text-secondary text-2xs">
                {JSON.stringify(message.args, null, 2)}
              </pre>
            </div>
          )}
          {isExecuting ? <div className="text-xs italic text-text-muted-light">{t('toolMessage.executing')}</div> : getResultContent()}
        </div>
      )}
    </div>
  );
};

export const CompactToolMessage = memo(CompactToolMessageComponent);
