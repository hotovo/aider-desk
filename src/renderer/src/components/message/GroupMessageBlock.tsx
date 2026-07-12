import { AnimatePresence, motion } from 'framer-motion';
import { memo, useMemo, useState, useCallback, MouseEvent } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  LocalizedString,
  UsageReportData,
  GroupMessage,
  isResponseMessage,
  isToolMessage,
  isUserMessage,
  Message,
  ResponseMessage,
  ToolMessage,
} from '@common/types';

import { MessageBlock } from './MessageBlock';
import { MessageBar } from './MessageBar';
import { areMessagesEqual } from './utils';

import { Accordion } from '@/components/common/Accordion';
import { Button } from '@/components/common/Button';

type Props = {
  baseDir: string;
  taskId: string;
  message: GroupMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  remove?: (message: Message) => void;
  removeGroup?: (group: GroupMessage) => void;
  redo?: () => void;
  editUserMessage?: (messageId: string, content: string, images?: string[]) => void;
  onInterrupt?: (interruptId?: string) => void;
  onFork?: (message: Message) => void;
  onRemoveUpTo?: (message: Message) => void;
};

const GroupMessageBlockComponent = ({
  baseDir,
  taskId,
  message,
  allFiles,
  renderMarkdown,
  remove,
  removeGroup,
  redo,
  editUserMessage,
  onInterrupt,
  onFork,
  onRemoveUpTo,
}: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const previewMessage = useMemo(() => {
    const messages = message.children.filter((msg) => isResponseMessage(msg) || isToolMessage(msg) || isUserMessage(msg)).reverse();
    return messages[0];
  }, [message.children]);

  const aggregateUsage = (messages: Message[]): UsageReportData | undefined => {
    const messagesWithUsage: (ResponseMessage | ToolMessage)[] = [];
    let lastMessageWithUsage: ResponseMessage | ToolMessage | undefined;

    // Find all messages with usageReport and the last one
    for (const msg of messages) {
      if ((isResponseMessage(msg) || isToolMessage(msg)) && msg.usageReport) {
        messagesWithUsage.push(msg);
        lastMessageWithUsage = msg;
      }
    }

    if (messagesWithUsage.length === 0) {
      return undefined;
    }

    // Use tokens from the last message with usage
    const lastUsage = lastMessageWithUsage!.usageReport!;

    // Sum costs from all messages with usage
    const totalCost = messagesWithUsage.reduce((sum, msg) => {
      if (isResponseMessage(msg) || isToolMessage(msg)) {
        return sum + (msg.usageReport?.messageCost || 0);
      }
      return sum;
    }, 0);

    return {
      model: lastUsage.model,
      sentTokens: lastUsage.sentTokens,
      receivedTokens: lastUsage.receivedTokens,
      messageCost: totalCost,
      cacheWriteTokens: lastUsage.cacheWriteTokens,
      cacheReadTokens: lastUsage.cacheReadTokens,
    };
  };

  const aggregatedUsage = aggregateUsage(message.children);

  const copyContent = useMemo(() => {
    const responseMessages = message.children.filter(isResponseMessage);
    const lastResponse = responseMessages[responseMessages.length - 1];
    return lastResponse?.content;
  }, [message.children]);

  const getGroupDisplayName = (name?: string | LocalizedString) => {
    if (!name) {
      return t('messages.group');
    }

    if (typeof name === 'string') {
      return t(name || 'messages.group');
    }

    // name is LocalizedString
    return t(name.key, name.params || {});
  };

  const handleInterrupt = (e: MouseEvent<HTMLButtonElement>) => {
    if (onInterrupt && message.group.interruptId) {
      e.stopPropagation();
      onInterrupt(message.group.interruptId);
    }
  };

  const handleRemove = useCallback(() => {
    if (!removeGroup) {
      return;
    }
    removeGroup(message);
  }, [removeGroup, message]);

  const handleRemoveUpTo = useCallback(() => {
    if (!onRemoveUpTo) {
      return;
    }
    // Target the first child (the subagent tool call message whose id === toolCallId), not the last child.
    // Subagent group children are frontend-only streaming messages that are not persisted to the backend's
    // ContextManager.messages — only the tool call message (first child) exists there. Using the last child
    // would cause a "Message with id X not found" error in removeMessagesAfter.
    const target = message.children[0];
    if (target) {
      onRemoveUpTo(target);
    }
  }, [onRemoveUpTo, message.children]);

  const handleFork = useCallback(() => {
    if (!onFork) {
      return;
    }
    // Target the first child (the subagent tool call message whose id === toolCallId). This is the only
    // child message that exists in the backend's ContextManager.messages, since subagent streaming messages
    // are frontend-only and never persisted. See handleRemoveUpTo for the same reasoning.
    const target = message.children[0];
    if (target) {
      onFork(target);
    }
  }, [onFork, message.children]);

  const header = (
    <div className={clsx('w-full px-3 py-1 group flex items-center justify-between', !message.group.finished && 'animate-pulse')}>
      <div className="text-xs text-left">{getGroupDisplayName(message.group.name)}</div>
      {!message.group.finished && message.group.interruptId && (
        <Button onClick={handleInterrupt} size="xs" variant="outline" color="danger">
          {t('common.cancel')}
        </Button>
      )}
    </div>
  );

  return (
    <div className={clsx('bg-bg-secondary border border-border-dark-light rounded-md relative')}>
      {/* Color Bar */}
      <div
        className={clsx('absolute left-0 top-0 h-full w-1 rounded-tl-md rounded-bl-md z-10', !message.group.finished && 'animate-pulse')}
        style={{
          backgroundColor: message.group.color,
        }}
      />
      {/* Content */}
      <Accordion
        buttonClassName="rounded-b-none"
        title={header}
        chevronPosition="right"
        noMaxHeight={true}
        showCollapseButton={true}
        isOpen={isOpen}
        scrollToVisibleWhenExpanded={true}
        onOpenChange={setIsOpen}
      >
        <div className="p-2 pl-3 bg-bg-primary-light space-y-2">
          {message.children.map((child, index) => (
            <MessageBlock
              key={child.id || index}
              baseDir={baseDir}
              taskId={taskId}
              message={child}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              remove={remove ? () => remove(child) : undefined}
              redo={redo}
              edit={editUserMessage && isUserMessage(child) ? (content: string, images?: string[]) => editUserMessage(child.id, content, images) : undefined}
              onInterrupt={onInterrupt}
            />
          ))}
        </div>
      </Accordion>
      <AnimatePresence>
        {!message.group.finished && !isOpen && previewMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 32 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="relative overflow-hidden"
          >
            <motion.div
              key={previewMessage.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute top-0.5 left-6 right-6"
            >
              <MessageBlock
                baseDir={baseDir}
                taskId={taskId}
                message={previewMessage}
                allFiles={allFiles}
                renderMarkdown={renderMarkdown}
                compact={true}
                hideMessageBar={true}
                showThinking={false}
              />
            </motion.div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-bg-secondary via-bg-secondary to-transparent pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="px-3 pb-3">
        <MessageBar
          className="mt-0"
          message={message}
          content={copyContent}
          usageReport={aggregatedUsage}
          remove={removeGroup ? handleRemove : undefined}
          onFork={onFork ? handleFork : undefined}
          onRemoveUpTo={onRemoveUpTo ? handleRemoveUpTo : undefined}
        />
      </div>
    </div>
  );
};

const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    prevProps.baseDir !== nextProps.baseDir ||
    prevProps.allFiles.length !== nextProps.allFiles.length ||
    prevProps.renderMarkdown !== nextProps.renderMarkdown ||
    (prevProps.removeGroup !== nextProps.removeGroup && (prevProps.removeGroup === undefined) !== (nextProps.removeGroup === undefined)) ||
    (prevProps.redo !== nextProps.redo && (prevProps.redo === undefined) !== (nextProps.redo === undefined)) ||
    (prevProps.editUserMessage !== nextProps.editUserMessage && (prevProps.editUserMessage === undefined) !== (nextProps.editUserMessage === undefined)) ||
    (prevProps.onInterrupt !== nextProps.onInterrupt && (prevProps.onInterrupt === undefined) !== (nextProps.onInterrupt === undefined)) ||
    (prevProps.onFork !== nextProps.onFork && (prevProps.onFork === undefined) !== (nextProps.onFork === undefined)) ||
    (prevProps.onRemoveUpTo !== nextProps.onRemoveUpTo && (prevProps.onRemoveUpTo === undefined) !== (nextProps.onRemoveUpTo === undefined))
  ) {
    return false;
  }

  return areMessagesEqual(prevProps.message, nextProps.message);
};

export const GroupMessageBlock = memo(GroupMessageBlockComponent, arePropsEqual);
