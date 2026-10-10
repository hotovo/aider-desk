import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { GroupMessage, isUserMessage, Message, MessageViewMode } from '@common/types';

import { MessageBlockWrapper } from './MessageBlockWrapper';
import { MessageMap } from './MessageMap';

import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext } from '@/components/message/utils';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettingsStore } from '@/stores/settingsStore';

export type MessagesRef = {
  exportToImage: () => void;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  inProgress: boolean;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  onContainerRef?: (container: HTMLDivElement | null) => void;
  removeMessage?: (message: Message) => void;
  removeGroup?: (group: GroupMessage) => void;
  redoUserPrompt?: (messageId: string) => void;
  editUserMessage?: (messageId: string, content: string, images?: string[]) => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

const MessagesComponent = forwardRef<MessagesRef, Props>(
  (
    {
      baseDir,
      taskId,
      inProgress,
      messages,
      allFiles = [],
      renderMarkdown,
      onContainerRef,
      removeMessage,
      removeGroup,
      redoUserPrompt,
      editUserMessage,
      onInterrupt,
      onForkFromMessage,
      onRemoveUpToMessage,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const messageViewMode = useSettingsStore((state) => state.settings?.messageViewMode);
    const showMessageMap = useSettingsStore((state) => state.settings?.showMessageMap ?? true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [visibleIndex, setVisibleIndex] = useState(0);
    const isCompactMode = messageViewMode === MessageViewMode.Compact;

    // Group messages by promptContext.group.id, then optionally group assistant messages for compact mode
    const processedMessages = useMemo(() => {
      const grouped = groupMessagesByPromptContext(messages);
      return isCompactMode ? groupAssistantMessages(grouped) : grouped;
    }, [messages, isCompactMode]);

    const { scrollingPaused, setScrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => messagesEndRef.current?.scrollIntoView(),
    });

    useEffect(() => {
      if (!scrollingPaused) {
        const frame = requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({
            block: 'end',
            inline: 'end',
            behavior: 'instant',
          });
        });
        return () => cancelAnimationFrame(frame);
      }
      return undefined;
    }, [processedMessages, scrollingPaused]);

    // Get all user message IDs
    const userMessageIds = useMemo(() => {
      return processedMessages.filter(isUserMessage).map((message) => message.id);
    }, [processedMessages]);

    const {
      hasPreviousUserMessage,
      hasNextUserMessage,
      handleNavigateToPreviousUserMessage,
      handleNavigateToNextUserMessage,
      renderGoToPrevious,
      renderGoToNext,
    } = useUserMessageNavigation({
      containerRef: messagesContainerRef,
      userMessageIds,
      scrollToMessageByElement: (element: HTMLElement) => {
        setScrollingPaused(true);
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      buttonClassName: 'hidden group-hover:block',
    });

    const scrollToMessageIndex = useCallback(
      (index: number, animated = true) => {
        const element = messagesContainerRef.current?.children.item(index);
        if (element) {
          setScrollingPaused(true);
          element.scrollIntoView({ behavior: animated ? 'smooth' : 'instant', block: 'start' });
        }
      },
      [setScrollingPaused],
    );

    const getVisibleIndex = useCallback(() => {
      const container = messagesContainerRef.current;
      if (!container || processedMessages.length === 0) {
        return 0;
      }
      // Anchor to the last item whose top has entered the viewport. Children are in vertical order.
      const bottom = container.getBoundingClientRect().bottom;
      let start = 0;
      let end = Math.min(processedMessages.length, container.children.length);
      while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (container.children[middle].getBoundingClientRect().top < bottom) {
          start = middle + 1;
        } else {
          end = middle;
        }
      }
      return Math.max(0, start - 1);
    }, [processedMessages.length]);

    useEffect(() => {
      const container = messagesContainerRef.current;
      if (!showMessageMap || !container) {
        return undefined;
      }
      let frame: number | null = null;
      const handleScroll = () => {
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
        frame = requestAnimationFrame(() => {
          setVisibleIndex(getVisibleIndex());
          frame = null;
        });
      };
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
      };
    }, [getVisibleIndex, showMessageMap]);

    useEffect(() => {
      onContainerRef?.(messagesContainerRef.current);
    }, [onContainerRef]);

    const exportToImage = useCallback(async () => {
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
    }, []);

    useImperativeHandle(ref, () => ({ exportToImage, scrollToBottom }), [exportToImage, scrollToBottom]);

    return (
      <div className="relative flex flex-col h-full">
        <div
          ref={messagesContainerRef}
          className="flex flex-col flex-grow overflow-y-auto max-h-full p-4 pb-2 scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth space-y-2"
          {...eventHandlers}
        >
          {processedMessages.map((message) => (
            <MessageBlockWrapper
              key={message.id}
              baseDir={baseDir}
              taskId={taskId}
              message={message}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              inProgress={inProgress}
              removeMessage={removeMessage}
              removeGroup={removeGroup}
              redoUserPrompt={redoUserPrompt}
              editUserMessage={editUserMessage}
              onInterrupt={onInterrupt}
              onForkFromMessage={onForkFromMessage}
              onRemoveUpToMessage={onRemoveUpToMessage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
        {showMessageMap && (
          <MessageMap
            key={taskId}
            messages={processedMessages}
            visibleIndex={visibleIndex}
            onNavigate={scrollToMessageIndex}
            onPreviousUserMessage={handleNavigateToPreviousUserMessage}
            onNextUserMessage={handleNavigateToNextUserMessage}
            hasPreviousUserMessage={hasPreviousUserMessage}
            hasNextUserMessage={hasNextUserMessage}
            onScrollToBottom={scrollToBottom}
          />
        )}
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
