import { memo, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { Message, UsageReportData, AssistantGroupMessage, isResponseMessage, isToolMessage } from '@common/types';

import { MessageBar } from './MessageBar';
import { MessageBlockWrapper } from './MessageBlockWrapper';
import { areMessagesEqual } from './utils';

import { useParsedContent } from '@/hooks/useParsedContent';

type Props = {
  baseDir: string;
  taskId: string;
  message: AssistantGroupMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  remove?: (message: Message) => void;
  onFork?: (message: Message) => void;
  onRemoveUpTo?: (message: Message) => void;
};

const AssistantMessageBlockComponent = ({ baseDir, taskId, message, allFiles, renderMarkdown, remove, onFork, onRemoveUpTo }: Props) => {
  const { responseMessage, toolMessages } = message;
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedContent = useParsedContent(baseDir, responseMessage.content, allFiles, renderMarkdown, true, responseMessage.reasoning);

  const hasContent = parsedContent && (!Array.isArray(parsedContent) || parsedContent.length > 0);

  const aggregateUsage = (): UsageReportData | undefined => {
    const allMessages = [responseMessage, ...toolMessages];
    const messagesWithUsage = allMessages.filter(
      (msg): msg is typeof msg & { usageReport: UsageReportData } => (isResponseMessage(msg) || isToolMessage(msg)) && !!msg.usageReport,
    );

    if (messagesWithUsage.length === 0) {
      return undefined;
    }

    const lastUsage = messagesWithUsage[messagesWithUsage.length - 1].usageReport;
    const totalCost = messagesWithUsage.reduce((sum, msg) => sum + (msg.usageReport?.messageCost || 0), 0);

    return {
      model: lastUsage.model,
      sentTokens: lastUsage.sentTokens,
      receivedTokens: lastUsage.receivedTokens,
      messageCost: totalCost,
      cacheWriteTokens: lastUsage.cacheWriteTokens,
      cacheReadTokens: lastUsage.cacheReadTokens,
    };
  };

  const aggregatedUsage = aggregateUsage();

  const allContent = [responseMessage.reasoning, responseMessage.content, ...toolMessages.map((t) => t.content)].filter(Boolean).join('\n\n');

  const handleRemove = useCallback(() => {
    if (!remove) {
      return;
    }
    remove(responseMessage);
    toolMessages.forEach((toolMessage) => remove(toolMessage));
  }, [remove, responseMessage, toolMessages]);

  const handleRemoveUpTo = useCallback(() => {
    if (!onRemoveUpTo) {
      return;
    }
    const target = toolMessages.length > 0 ? toolMessages[toolMessages.length - 1] : responseMessage;
    onRemoveUpTo(target);
  }, [onRemoveUpTo, toolMessages, responseMessage]);

  const handleFork = useCallback(() => {
    if (!onFork) {
      return;
    }
    onFork(responseMessage);
  }, [onFork, responseMessage]);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'rounded-md max-w-full text-xs bg-bg-secondary text-text-primary',
        'relative flex flex-col group',
        !renderMarkdown && 'break-words whitespace-pre-wrap',
        'p-3 border border-border-dark-light',
      )}
    >
      {/* Response content */}
      {hasContent && (
        <MessageBlockWrapper
          key={responseMessage.id}
          baseDir={baseDir}
          taskId={taskId}
          message={responseMessage}
          allFiles={allFiles}
          renderMarkdown={renderMarkdown}
          compact={true}
          hideMessageBar={true}
        />
      )}

      {/* Tool messages */}
      {toolMessages.length > 0 && (
        <div className={clsx(hasContent && 'mt-1 ml-6 space-y-1')}>
          {toolMessages.map((toolMessage) => (
            <MessageBlockWrapper
              key={toolMessage.id}
              baseDir={baseDir}
              taskId={taskId}
              message={toolMessage}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              hideMessageBar={true}
            />
          ))}
        </div>
      )}

      {/* Single MessageBar for the entire group */}
      <MessageBar
        message={message}
        content={allContent}
        usageReport={aggregatedUsage}
        remove={remove ? handleRemove : undefined}
        onFork={onFork ? handleFork : undefined}
        onRemoveUpTo={onRemoveUpTo ? handleRemoveUpTo : undefined}
      />
    </div>
  );
};

const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    prevProps.baseDir !== nextProps.baseDir ||
    prevProps.taskId !== nextProps.taskId ||
    prevProps.allFiles.length !== nextProps.allFiles.length ||
    prevProps.renderMarkdown !== nextProps.renderMarkdown ||
    (prevProps.remove !== nextProps.remove && (prevProps.remove === undefined) !== (nextProps.remove === undefined)) ||
    (prevProps.onFork !== nextProps.onFork && (prevProps.onFork === undefined) !== (nextProps.onFork === undefined)) ||
    (prevProps.onRemoveUpTo !== nextProps.onRemoveUpTo && (prevProps.onRemoveUpTo === undefined) !== (nextProps.onRemoveUpTo === undefined))
  ) {
    return false;
  }

  return areMessagesEqual(prevProps.message, nextProps.message);
};

export const AssistantMessageBlock = memo(AssistantMessageBlockComponent, arePropsEqual);
