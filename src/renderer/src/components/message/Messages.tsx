import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { DefaultTaskState, isUserMessage, Message, MessageViewMode, TaskData } from '@common/types';

import { MessageBlockWrapper } from './MessageBlockWrapper';

import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext } from '@/components/message/utils';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettings } from '@/contexts/SettingsContext';

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
          {processedMessages.map((message, index) => (
            <MessageBlockWrapper
              key={message.id}
              baseDir={baseDir}
              taskId={taskId}
              message={message}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              index={index}
              lastUserMessageIndex={lastUserMessageIndex}
              inProgress={inProgress}
              removeMessage={removeMessage}
              redoLastUserPrompt={redoLastUserPrompt}
              editLastUserMessage={editLastUserMessage}
              onInterrupt={onInterrupt}
              onForkFromMessage={onForkFromMessage}
              onRemoveUpToMessage={onRemoveUpToMessage}
            />
          ))}
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
