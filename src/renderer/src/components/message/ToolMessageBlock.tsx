import { ReactNode } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { RiToolsFill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { VscError } from 'react-icons/vsc';
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
import { ExpandableMessageBlock } from './ExpandableMessageBlock';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ToolMessageBlock = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar = false }: Props) => {
  const { t } = useTranslation();
  const isExecuting = message.content === '';
  const parsedResult = !isExecuting ? parseToolContent(message.content) : null;

  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);

  const getToolLabel = (message: ToolMessage): ReactNode => {
    const defaultLabel = () => t('toolMessage.toolLabel', { server: formatName(message.serverName), tool: formatName(message.toolName) });

    switch (message.serverName) {
      case AIDER_TOOL_GROUP_NAME:
        switch (message.toolName) {
          case AIDER_TOOL_ADD_CONTEXT_FILES: {
            // Handles message.args.paths (array) or fallback to message.args.path (string)
            const addPaths =
              message.args.paths && Array.isArray(message.args.paths)
                ? (message.args.paths as string[]).map((path) => `• ${path}`).join('\\n')
                : (message.args.path as string) || '...';
            return t('toolMessage.aider.addContextFiles', { paths: addPaths });
          }
          case AIDER_TOOL_DROP_CONTEXT_FILES: {
            // Handles message.args.paths (array) or fallback to message.args.path (string)
            const dropPaths =
              message.args.paths && Array.isArray(message.args.paths)
                ? (message.args.paths as string[]).map((path) => `• ${path}`).join('\\n')
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
                <span>{t('toolMessage.power.fileRead.title')}</span>
                <span>
                  <CodeInline className="bg-bg-primary-light">{(message.args.filePath as string).split(/[/\\\\]/).pop()}</CodeInline>
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
                  <CodeInline className="bg-bg-primary-light">{message.args.command as string}</CodeInline>
                </span>
              </div>
            );
          case POWER_TOOL_SEMANTIC_SEARCH:
            return t('toolMessage.power.semanticSearch', { query: message.args.searchQuery as string, path: (message.args.path as string) || '' });
          case POWER_TOOL_FETCH:
            return t('toolMessage.power.fetch', { url: message.args.url as string });
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
        <div className="text-xs text-text-tertiary pt-2 px-1">
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-2 rounded text-text-tertiary text-2xs my-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
            {promptText}
          </pre>
          {parsedResult?.json && 'deniedReason' in parsedResult.json && typeof parsedResult.json.deniedReason === 'string' && (
            <div className="flex items-start gap-1 text-text-primary text-2xs font-normal mt-2 whitespace-pre-wrap px-1">
              {t('toolMessage.deniedByReason', { reason: parsedResult.json.deniedReason })}
            </div>
          )}
        </div>
      );
    }
    return null;
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
          className={`whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-[11px] ${
            parsedResult.isError ? 'text-error-light' : 'text-text-secondary'
          }`}
        >
          {displayContent}
        </pre>
      </>
    );
  };

  const content = (
    <div className="text-2xs whitespace-pre-wrap text-text-tertiary bg-bg-secondary relative p-3">
      {Object.keys(message.args).length > 0 && (
        <div className="mb-3">
          <div className="font-semibold mb-1 text-text-secondary">{t('toolMessage.arguments')}</div>
          <pre className="whitespace-pre-wrap max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth bg-bg-primary-light p-2 rounded text-text-secondary text-2xs">
            {JSON.stringify(message.args, null, 2)}
          </pre>
        </div>
      )}
      {isExecuting ? <div className="text-xs italic text-text-muted-light">{t('toolMessage.executing')}</div> : getResultContent()}
    </div>
  );

  const title = (
    <div className="w-full text-left">
      <div className="flex items-center justify-between gap-2 select-none w-full px-1 py-0.5">
        <div className="flex items-center gap-2">
          <div className={`text-text-muted ${isExecuting ? 'animate-pulse' : ''}`}>
            <RiToolsFill className="w-4 h-4" />
          </div>
          <div className={`text-xs text-text-primary whitespace-pre ${isExecuting ? 'animate-pulse' : ''} flex items-center gap-1`}>
            {getToolLabel(message)}
          </div>
          {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
          {!isExecuting && parsedResult?.isError === true && <VscError className="text-error" />}
        </div>
      </div>
      {/* Tool Specific Content */}
      {renderToolSpecificContent()}
    </div>
  );

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      title={title}
      content={content}
      copyContent={copyContent}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
