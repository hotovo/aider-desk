import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';

import { isGroupMessage, isUserMessage, Message } from '@/types/message';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { groupMessagesByPromptContext } from '@/components/message/utils';

export type MessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: (content: string) => void;
};

export const Messages = forwardRef<MessagesRef, Props>(
  ({ baseDir, messages, allFiles = [], renderMarkdown, removeMessage, redoLastUserPrompt, editLastUserMessage }, ref) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [scrollingPaused, setScrollingPaused] = useState(false);

    // Group messages by promptContext.group.id
    const processedMessages = groupMessagesByPromptContext(messages);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      const isAtBottom = element.scrollHeight - element.scrollTop < element.clientHeight + 20;
      setScrollingPaused(!isAtBottom);
    };

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

    const scrollToBottom = () => {
      setScrollingPaused(false);
      messagesEndRef.current?.scrollIntoView();
    };

    useImperativeHandle(ref, () => ({
      exportToImage,
      container: messagesContainerRef.current,
      scrollToBottom,
    }));

    return (
      <div
        ref={messagesContainerRef}
        className="relative flex flex-col overflow-y-auto max-h-full p-4
      scrollbar-thin
      scrollbar-track-bg-primaryLight
      scrollbar-thumb-bg-tertiary
      hover:scrollbar-thumb-bg-fourth"
        onScroll={handleScroll}
      >
        <StyledTooltip id="usage-info-tooltip" />
        {processedMessages.map((message, index) => {
          if (isGroupMessage(message)) {
            return (
              <GroupMessageBlock
                key={message.id || index}
                baseDir={baseDir}
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
      </div>
    );
  },
);

Messages.displayName = 'Messages';
