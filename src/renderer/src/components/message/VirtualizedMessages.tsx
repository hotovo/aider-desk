import { forwardRef, memo, RefObject, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { LegendList, type LegendListRef } from '@legendapp/list/react';
import { isUserMessage, Message, MessageViewMode } from '@common/types';
import { twMerge } from 'tailwind-merge';

import { MessageBlockWrapper } from './MessageBlockWrapper';

import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext } from '@/components/message/utils';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettingsStore } from '@/stores/settingsStore';

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
  editUserMessage: (messageId: string, content: string, images?: string[]) => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

const VirtualizedMessagesComponent = forwardRef<VirtualizedMessagesRef, Props>(
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
      editUserMessage,
      onInterrupt,
      onForkFromMessage,
      onRemoveUpToMessage,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const messageViewMode = useSettingsStore((state) => state.settings?.messageViewMode);
    const listRef = useRef<LegendListRef>(null);
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
    const isCompactMode = messageViewMode === MessageViewMode.Compact;

    const processedMessages = useMemo(() => {
      const grouped = groupMessagesByPromptContext(messages);
      return isCompactMode ? groupAssistantMessages(grouped) : grouped;
    }, [messages, isCompactMode]);

    const [messagesLength, setMessagesLength] = useState(processedMessages.length);
    if (messagesLength !== processedMessages.length) {
      setMessagesLength(processedMessages.length);
    }

    const [scrollingPaused, setScrollingPaused] = useState(false);
    const isProgrammaticScrollRef = useRef(false);

    const handleListRef = useCallback((node: LegendListRef | null) => {
      listRef.current = node;
      const element = node?.getScrollableNode();
      setScrollContainer(element ? (element as HTMLDivElement) : null);
    }, []);

    const scrollContainerRef = useMemo(() => ({ current: scrollContainer }) as RefObject<HTMLDivElement | null>, [scrollContainer]);

    useEffect(() => {
      const element = scrollContainer;
      if (!element) {
        return;
      }

      const handleWheel = (e: WheelEvent) => {
        e.stopPropagation();
        if (e.deltaY < 0) {
          setScrollingPaused(true);
        }
      };

      const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        (element as HTMLElement & { dataset: DOMStringMap }).dataset.touchStartY = touch.clientY.toString();
      };

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const touchStartY = (element as HTMLElement & { dataset: DOMStringMap }).dataset.touchStartY
          ? parseFloat((element as HTMLElement & { dataset: DOMStringMap }).dataset.touchStartY!)
          : touch.clientY;
        if (touch.clientY < touchStartY - 10) {
          setScrollingPaused(true);
        }
      };

      element.addEventListener('wheel', handleWheel);
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });

      return () => {
        element.removeEventListener('wheel', handleWheel);
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
      };
    }, [scrollContainer]);

    const handleScrollState = useCallback(() => {
      const state = listRef.current?.getState();
      if (state?.isAtEnd) {
        if (isProgrammaticScrollRef.current) {
          return;
        }
        setScrollingPaused(false);
      } else {
        isProgrammaticScrollRef.current = false;
      }
    }, []);

    const scrollToBottom = useCallback(() => {
      setScrollingPaused(false);
      listRef.current?.scrollToEnd({ animated: false });
    }, []);

    const userMessageIds = useMemo(() => {
      return processedMessages.filter(isUserMessage).map((message) => message.id);
    }, [processedMessages]);

    const { hasPreviousUserMessage, hasNextUserMessage, renderGoToPrevious, renderGoToNext } = useUserMessageNavigation({
      containerRef: scrollContainerRef,
      userMessageIds,
      scrollToMessageById: (id: string) => {
        const index = processedMessages.findIndex((msg) => msg.id === id);
        if (index !== -1) {
          isProgrammaticScrollRef.current = true;
          setScrollingPaused(true);
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
        }
      },
      buttonClassName: 'hidden group-hover:block',
    });

    const exportToImage = async () => {
      const scrollNode = listRef.current?.getScrollableNode();
      if (!scrollNode) {
        return;
      }

      try {
        const dataUrl = await toPng(scrollNode, {
          cacheBust: true,
          height: scrollNode.scrollHeight,
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
      container: scrollContainer,
      scrollToBottom,
    }));

    const extraData = useMemo(
      () => ({
        inProgress,
        allFiles,
        renderMarkdown,
        removeMessage,
        redoUserPrompt,
        editUserMessage,
        onInterrupt,
        onForkFromMessage,
        onRemoveUpToMessage,
        messagesLength,
      }),
      [
        inProgress,
        allFiles,
        renderMarkdown,
        removeMessage,
        redoUserPrompt,
        editUserMessage,
        onInterrupt,
        onForkFromMessage,
        onRemoveUpToMessage,
        messagesLength,
      ],
    );

    const renderItem = useCallback(
      ({ item, index }) => (
        <div className={twMerge('py-1', index === messagesLength - 1 && 'pb-4', index === 0 && 'pt-4')}>
          <MessageBlockWrapper
            baseDir={baseDir}
            taskId={taskId}
            message={item}
            allFiles={allFiles}
            renderMarkdown={renderMarkdown}
            inProgress={inProgress}
            removeMessage={removeMessage}
            redoUserPrompt={redoUserPrompt}
            editUserMessage={editUserMessage}
            onInterrupt={onInterrupt}
            onForkFromMessage={onForkFromMessage}
            onRemoveUpToMessage={onRemoveUpToMessage}
          />
        </div>
      ),
      [
        baseDir,
        taskId,
        allFiles,
        renderMarkdown,
        inProgress,
        removeMessage,
        redoUserPrompt,
        editUserMessage,
        onInterrupt,
        onForkFromMessage,
        onRemoveUpToMessage,
        messagesLength,
      ],
    );

    return (
      <div className="relative h-full">
        <LegendList
          key={taskId}
          ref={handleListRef}
          data={processedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={extraData}
          estimatedItemSize={100}
          maintainScrollAtEnd={!scrollingPaused}
          maintainScrollAtEndThreshold={100}
          onScroll={handleScrollState}
          initialScrollAtEnd
          alwaysRender={{ keys: userMessageIds }}
          drawDistance={250}
          className="absolute inset-0 scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth px-4"
        />
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
    );
  },
);

VirtualizedMessagesComponent.displayName = 'VirtualizedMessages';

export const VirtualizedMessages = memo(VirtualizedMessagesComponent);
