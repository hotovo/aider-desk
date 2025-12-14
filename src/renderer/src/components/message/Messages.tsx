import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoPlay } from 'react-icons/io5';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';

import { isGroupMessage, isUserMessage, Message } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { groupMessagesByPromptContext } from '@/components/message/utils';
import { Button } from '@/components/common/Button';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';

export type MessagesRef = {
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

export const Messages = forwardRef<MessagesRef, Props>(
  ({ baseDir, taskId, messages, allFiles = [], renderMarkdown, removeMessage, redoLastUserPrompt, editLastUserMessage, processing }, ref) => {
    const { t } = useTranslation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Group messages by promptContext.group.id
    const processedMessages = groupMessagesByPromptContext(messages);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);

    const { scrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => messagesEndRef.current?.scrollIntoView(),
    });

    useEffect(() => {
      if (!scrollingPaused) {
        messagesEndRef.current?.scrollIntoView();
      }
    }, [processedMessages, scrollingPaused]);

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
      <div
        ref={messagesContainerRef}
        className="flex flex-col overflow-y-auto max-h-full p-4
      scrollbar-thin
      scrollbar-track-bg-primary-light
      scrollbar-thumb-bg-tertiary
      hover:scrollbar-thumb-bg-fourth"
        {...eventHandlers}
      >
        <StyledTooltip id="usage-info-tooltip" />

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
        {processedMessages.map((message, index) => {
          if (isGroupMessage(message)) {
            return (
              <GroupMessageBlock
                key={message.id || index}
                baseDir={baseDir}
                taskId={taskId}
                message={message}
                allFiles={allFiles}
                renderMarkdown={renderMarkdown}
                remove={(msg: Message) => removeMessage(msg)}
                redo={redoLastUserPrompt}
                edit={editLastUserMessage}
              />
            );
          }
          return (
            <MessageBlock
              key={message.id || index}
              baseDir={baseDir}
              taskId={taskId}
              message={message}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              remove={index === messages.length - 1 ? () => removeMessage(message) : undefined}
              redo={index === lastUserMessageIndex ? redoLastUserPrompt : undefined}
              edit={index === lastUserMessageIndex ? editLastUserMessage : undefined}
            />
          );
        })}
        <div ref={messagesEndRef} />
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

Messages.displayName = 'Messages';
