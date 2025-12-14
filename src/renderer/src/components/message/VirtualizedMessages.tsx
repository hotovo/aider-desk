import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { IoPlay } from 'react-icons/io5';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';

import { isGroupMessage, isUserMessage, Message } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { groupMessagesByPromptContext } from '@/components/message/utils';
import { showInfoNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';

export type VirtualizedMessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: (content: string) => void;
  processing: boolean;
};

export const VirtualizedMessages = forwardRef<VirtualizedMessagesRef, Props>(
  ({ baseDir, taskId, messages, allFiles = [], renderMarkdown, removeMessage, redoLastUserPrompt, editLastUserMessage, processing }, ref) => {
    const { t } = useTranslation();
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Group messages by promptContext.group.id
    const processedMessages = useMemo(() => groupMessagesByPromptContext(messages), [messages]);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);

    // Create virtualizer for dynamic sized items
    const virtualizer = useVirtualizer({
      count: processedMessages.length,
      getScrollElement: () => messagesContainerRef.current,
      estimateSize: () => 44, // Initial estimate, will be measured
      overscan: 5,
      scrollToFn: (offset, { behavior }) => {
        messagesContainerRef.current?.scrollTo({
          top: offset + 32,
          behavior,
        });
      },
    });

    const { scrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => {
        if (processedMessages.length > 0) {
          virtualizer.scrollToOffset(virtualizer.getTotalSize() + 100);
        }
      },
    });

    useLayoutEffect(() => {
      if (!scrollingPaused && processedMessages.length > 0) {
        // Scroll to the last item when new messages arrive
        virtualizer.scrollToOffset(virtualizer.getTotalSize() + 100);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [processedMessages]);

    const exportToImage = async () => {
      // Show notification that export is not available with virtualized rendering
      showInfoNotification(t('messages.exportNotAvailableWithVirtualized'));
    };

    useImperativeHandle(ref, () => ({
      exportToImage,
      container: messagesContainerRef.current,
      scrollToBottom,
    }));

    const items = virtualizer.getVirtualItems();

    return (
      <div className="relative flex flex-col h-full">
        <StyledTooltip id="usage-info-tooltip" />

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4
            scrollbar-thin
            scrollbar-track-bg-primary-light
            scrollbar-thumb-bg-tertiary
            hover:scrollbar-thumb-bg-fourth"
          {...eventHandlers}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {items.map((virtualRow) => {
              const message = processedMessages[virtualRow.index];

              return (
                <div
                  key={message.id || virtualRow.index}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {isGroupMessage(message) ? (
                    <GroupMessageBlock
                      baseDir={baseDir}
                      taskId={taskId}
                      message={message}
                      allFiles={allFiles}
                      renderMarkdown={renderMarkdown}
                      remove={(msg: Message) => removeMessage(msg)}
                      redo={redoLastUserPrompt}
                      edit={editLastUserMessage}
                    />
                  ) : (
                    <MessageBlock
                      baseDir={baseDir}
                      taskId={taskId}
                      message={message}
                      allFiles={allFiles}
                      renderMarkdown={renderMarkdown}
                      remove={virtualRow.index === messages.length - 1 ? () => removeMessage(message) : undefined}
                      redo={virtualRow.index === lastUserMessageIndex ? redoLastUserPrompt : undefined}
                      edit={virtualRow.index === lastUserMessageIndex ? editLastUserMessage : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {scrollingPaused && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <IconButton
              icon={<MdKeyboardArrowDown className="h-6 w-6" />}
              onClick={scrollToBottom}
              tooltip={t('messages.scrollToBottom')}
              className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
              aria-label={t('messages.scrollToBottom')}
            />
          </div>
        )}
        {!processing && lastUserMessageIndex === processedMessages.length - 1 && (
          <div className="flex justify-center align-center py-4 px-6">
            <Button variant="outline" color="primary" size="xs" onClick={redoLastUserPrompt}>
              <IoPlay className="mr-1 w-3 h-3" />
              {t('messages.execute')}
            </Button>
          </div>
        )}
      </div>
    );
  },
);

VirtualizedMessages.displayName = 'VirtualizedMessages';
