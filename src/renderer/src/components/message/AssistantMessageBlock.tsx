import { memo, useRef } from 'react';
import { clsx } from 'clsx';
import { RiRobot2Line } from 'react-icons/ri';
import { UsageReportData } from '@common/types';

import { MessageBar } from './MessageBar';
import { MessageBlock } from './MessageBlock';
import { areMessagesEqual } from './utils';

import { useParsedContent } from '@/hooks/useParsedContent';
import { AssistantGroupMessage, isResponseMessage, isToolMessage, ToolMessage } from '@/types/message';

type Props = {
  baseDir: string;
  taskId: string;
  message: AssistantGroupMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  remove?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
};

const AssistantMessageBlockComponent = ({ baseDir, taskId, message, allFiles, renderMarkdown, remove, onFork, onRemoveUpTo }: Props) => {
  const { responseMessage, toolMessages } = message;
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedContent = useParsedContent(baseDir, responseMessage.content, allFiles, renderMarkdown, true);

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

  const allContent = [responseMessage.content, ...toolMessages.map((t) => t.content)].filter(Boolean).join('\n\n');

  return (
    <div
      ref={containerRef}
      className={clsx(
        'rounded-md max-w-full text-xs bg-bg-secondary text-text-primary',
        'relative flex flex-col group',
        !renderMarkdown && 'break-words whitespace-pre-wrap',
        'p-3 mb-2 border border-border-dark-light',
      )}
    >
      {/* Response content */}
      {hasContent && (
        <div className="flex items-start gap-2">
          <div className="mt-[1px] relative">
            <RiRobot2Line className="text-text-muted w-4 h-4" />
          </div>
          <div className="flex-grow-1 w-full overflow-hidden">{parsedContent}</div>
        </div>
      )}

      {/* Tool messages - using MessageBlock with hideMessageBar to avoid duplicate MessageBars */}
      {toolMessages.length > 0 && (
        <div className={clsx(hasContent && 'mt-3 ml-6')}>
          {toolMessages.map((toolMessage) => (
            <MessageBlock
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
      <MessageBar content={allContent} usageReport={aggregatedUsage} remove={remove} onFork={onFork} onRemoveUpTo={onRemoveUpTo} />
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

  const prevMessage = prevProps.message;
  const nextMessage = nextProps.message;

  if (prevMessage.id !== nextMessage.id) {
    return false;
  }

  if (!areMessagesEqual(prevMessage.responseMessage, nextMessage.responseMessage)) {
    return false;
  }

  if (prevMessage.toolMessages.length !== nextMessage.toolMessages.length) {
    return false;
  }

  for (let i = 0; i < prevMessage.toolMessages.length; i++) {
    if (!areMessagesEqual(prevMessage.toolMessages[i] as ToolMessage, nextMessage.toolMessages[i] as ToolMessage)) {
      return false;
    }
  }

  return true;
};

export const AssistantMessageBlock = memo(AssistantMessageBlockComponent, arePropsEqual);
