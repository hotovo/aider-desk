import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { MessageViewMode, isUserMessage, Message } from '@common/types';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';

import { MessageBlockWrapper } from './MessageBlockWrapper';

import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext } from '@/components/message/utils';
import { showInfoNotification } from '@/utils/notifications';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettings } from '@/contexts/SettingsContext';

export type VirtualizedMessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  inProgress: boolean;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  redoUserPrompt: (messageId: string) => void;
  editLastUserMessage: (content: string, images?: string[]) => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

export const VirtualizedMessages = forwardRef<VirtualizedMessagesRef, Props>(
  (
    {
      baseDir,
      taskId,
      inProgress,
      messages,
      allFiles = [],
      renderMarkdown,
      removeMessage,
      redoUserPrompt,
      editLastUserMessage,
      onInterrupt,
      onForkFromMessage,
      onRemoveUpToMessage,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isCompactMode = settings?.messageViewMode === MessageViewMode.Compact;

    // Group messages by promptContext.group.id, then optionally group assistant messages for compact mode
    const processedMessages = useMemo(() => {
      const grouped = groupMessagesByPromptContext(messages);
      return isCompactMode ? groupAssistantMessages(grouped) : grouped;
    }, [messages, isCompactMode]);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);

    // Get all user message IDs
    const userMessageIds = useMemo(() => {
      return processedMessages.filter(isUserMessage).map((message) => message.id);
    }, [processedMessages]);

    // Create virtualizer for dynamic sized items
    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
      count: processedMessages.length,
      getScrollElement: () => messagesContainerRef.current,
      estimateSize: () => 44, // Initial estimate, will be measured
      rangeExtractor: (range) => {
        const indices = defaultRangeExtractor(range);

        processedMessages.forEach((message, index) => {
          if (isUserMessage(message) && !indices.includes(index)) {
            indices.push(index);
          }
        });

        return indices.sort((a, b) => a - b);
      },
      paddingStart: 16,
      gap: 8,
      overscan: 5,
    });

    const { scrollingPaused, setScrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => {
        if (processedMessages.length > 0) {
          virtualizer.scrollToIndex(processedMessages.length - 1, {
            align: 'end',
          });
        }
      },
    });

    const { hasPreviousUserMessage, hasNextUserMessage, renderGoToPrevious, renderGoToNext } = useUserMessageNavigation({
      containerRef: messagesContainerRef,
      userMessageIds,
      scrollToMessageById: (id: string) => {
        const index = processedMessages.findIndex((msg) => msg.id === id);
        if (index !== -1) {
          setScrollingPaused(true);
          virtualizer.scrollToIndex(index, {
            align: 'start',
            behavior: 'smooth',
          });
        }
      },
      buttonClassName: 'hidden group-hover:block',
    });

    useLayoutEffect(() => {
      if (!scrollingPaused && processedMessages.length > 0) {
        // Scroll to last item when new messages arrive
        virtualizer.scrollToIndex(processedMessages.length - 1, {
          align: 'end',
        });
      }
    }, [processedMessages, scrollingPaused, virtualizer, inProgress]);

    const exportToImage = async () => {
      // Show notification that export is not available with virtualized rendering
      showInfoNotification(t('messages.exportNotAvailableWithVirtualized'));
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
          className={clsx(
            'flex flex-col flex-grow overflow-y-auto max-h-full px-4 scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth',
            virtualizer.isScrolling ? 'cursor-progress' : '',
          )}
          {...eventHandlers}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const message = processedMessages[virtualRow.index];

              return (
                <div
                  key={message.id || virtualRow.index}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={virtualRow.index === processedMessages.length - 1 ? 'pb-2' : ''}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageBlockWrapper
                    baseDir={baseDir}
                    taskId={taskId}
                    message={message}
                    allFiles={allFiles}
                    renderMarkdown={renderMarkdown}
                    index={virtualRow.index}
                    lastUserMessageIndex={lastUserMessageIndex}
                    inProgress={inProgress}
                    removeMessage={removeMessage}
                    redoUserPrompt={redoUserPrompt}
                    editLastUserMessage={editLastUserMessage}
                    onInterrupt={onInterrupt}
                    onForkFromMessage={onForkFromMessage}
                    onRemoveUpToMessage={onRemoveUpToMessage}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 w-[50%] bottom-0 z-10 flex justify-center gap-1 pt-10 pb-2 group">
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
    );
  },
);

VirtualizedMessages.displayName = 'VirtualizedMessages';
