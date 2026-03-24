import { forwardRef, memo, ReactNode, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { DefaultTaskState, isAssistantGroupMessage, isGroupMessage, isUserMessage, Message, MessageViewMode, TaskData } from '@common/types';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';
import { AssistantMessageBlock } from './AssistantMessageBlock';

import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext, includeMessageProperty } from '@/components/message/utils';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettings } from '@/contexts/SettingsContext';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';

export type MessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  task: TaskData;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: (content: string) => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

const MessagesComponent = forwardRef<MessagesRef, Props>(
  (
    {
      baseDir,
      taskId,
      task,
      messages,
      allFiles = [],
      renderMarkdown,
      removeMessage,
      redoLastUserPrompt,
      editLastUserMessage,
      onInterrupt,
      onForkFromMessage,
      onRemoveUpToMessage,
    },
    ref,
  ) => {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isCompactMode = settings?.messageViewMode === MessageViewMode.Compact;

    // Group messages by promptContext.group.id, then optionally group assistant messages for compact mode
    const processedMessages = useMemo(() => {
      const grouped = groupMessagesByPromptContext(messages);
      return isCompactMode ? groupAssistantMessages(grouped) : grouped;
    }, [messages, isCompactMode]);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);
    const inProgress = task.state === DefaultTaskState.InProgress;

    const { scrollingPaused, setScrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => messagesEndRef.current?.scrollIntoView(),
    });

    useEffect(() => {
      if (!scrollingPaused) {
        messagesEndRef.current?.scrollIntoView();
      }
    }, [processedMessages, scrollingPaused]);

    // Get all user message IDs
    const userMessageIds = useMemo(() => {
      return processedMessages.filter(isUserMessage).map((message) => message.id);
    }, [processedMessages]);

    const { hasPreviousUserMessage, hasNextUserMessage, renderGoToPrevious, renderGoToNext } = useUserMessageNavigation({
      containerRef: messagesContainerRef,
      userMessageIds,
      scrollToMessageByElement: (element: HTMLElement) => {
        setScrollingPaused(true);
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      buttonClassName: 'hidden group-hover:block',
    });

    const exportToImage = async () => {
      const messagesContainer = messagesContainerRef.current;
      if (messagesContainer === null) {
        return;
      }

      try {
        const dataUrl = await toPng(messagesContainer, {
          cacheBust: true,
          height: messagesContainer.scrollHeight,
        });
        const link = document.createElement('a');
        link.download = `session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.png`;
        link.href = dataUrl;
        link.click();
        link.remove();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to export chat as PNG', err);
      }
    };

    useImperativeHandle(ref, () => ({
      exportToImage,
      container: messagesContainerRef.current,
      scrollToBottom,
    }));

    return (
      <div className="relative flex flex-col h-full">
        <div
          ref={messagesContainerRef}
          className="flex flex-col flex-grow overflow-y-auto max-h-full p-4 pb-2 scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth space-y-2"
          {...eventHandlers}
        >
          {processedMessages.map((message, index) => {
            let messageBlock: ReactNode;
            if (isGroupMessage(message)) {
              messageBlock = (
                <GroupMessageBlock
                  baseDir={baseDir}
                  taskId={taskId}
                  message={message}
                  allFiles={allFiles}
                  renderMarkdown={renderMarkdown}
                  remove={inProgress ? undefined : removeMessage}
                  redo={inProgress ? undefined : redoLastUserPrompt}
                  edit={editLastUserMessage}
                  onInterrupt={onInterrupt}
                />
              );
            } else if (isAssistantGroupMessage(message)) {
              messageBlock = (
                <AssistantMessageBlock
                  baseDir={baseDir}
                  taskId={taskId}
                  message={message}
                  allFiles={allFiles}
                  renderMarkdown={renderMarkdown}
                  remove={inProgress ? undefined : () => removeMessage(message)}
                  onFork={onForkFromMessage ? () => onForkFromMessage(message) : undefined}
                  onRemoveUpTo={onRemoveUpToMessage ? () => onRemoveUpToMessage(message) : undefined}
                />
              );
            } else {
              messageBlock = (
                <MessageBlock
                  baseDir={baseDir}
                  taskId={taskId}
                  message={message}
                  allFiles={allFiles}
                  renderMarkdown={renderMarkdown}
                  remove={inProgress ? undefined : () => removeMessage(message)}
                  redo={index === lastUserMessageIndex && !inProgress ? redoLastUserPrompt : undefined}
                  edit={index === lastUserMessageIndex ? editLastUserMessage : undefined}
                  onInterrupt={onInterrupt}
                  onFork={onForkFromMessage ? () => onForkFromMessage(message) : undefined}
                  onRemoveUpTo={onRemoveUpToMessage ? () => onRemoveUpToMessage(message) : undefined}
                />
              );
            }

            const additionalProps = {
              message: includeMessageProperty(message) ? message : null,
            };
            return (
              <div key={message.id}>
                <ExtensionComponentWrapper placement="task-message-above" additionalProps={additionalProps} />
                {messageBlock}
                <ExtensionComponentWrapper placement="task-message-below" additionalProps={additionalProps} />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="relative">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[140px] z-10 flex justify-center gap-1 pt-6 pb-1 group">
            {(hasPreviousUserMessage || hasNextUserMessage) && renderGoToPrevious()}
            {scrollingPaused && (
              <IconButton
                icon={<MdKeyboardDoubleArrowDown className="h-6 w-6" />}
                onClick={scrollToBottom}
                tooltip={t('messages.scrollToBottom')}
                className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
                aria-label={t('messages.scrollToBottom')}
              />
            )}
            {(hasPreviousUserMessage || hasNextUserMessage) && renderGoToNext()}
          </div>
        </div>
      </div>
    );
  },
);

MessagesComponent.displayName = 'Messages';

export const Messages = memo(MessagesComponent);
