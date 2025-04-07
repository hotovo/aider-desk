import { useEffect, useRef, useState } from 'react';

import { MessageBlock } from './MessageBlock';

import { isLoadingMessage, Message } from '@/types/message';

type Props = {
  baseDir: string;
  messages: Message[];
  allFiles?: string[];
};

export const Messages = ({ baseDir, messages, allFiles = [] }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [scrollingPaused, setScrollingPaused] = useState(false);

  const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
    setScrollingPaused(!isAtBottom);
  };

  useEffect(() => {
    console.log('Loading messages: ', messages.filter(isLoadingMessage).length);

    const hasLoadingMessage = messages.some((msg) => msg.type === 'loading');
    if (hasLoadingMessage) {
      setScrollingPaused(false);
    }

    if (hasLoadingMessage || !scrollingPaused) {
      messagesEndRef.current?.scrollIntoView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <div
      className="flex flex-col overflow-y-auto max-h-full p-4
      scrollbar-thin
      scrollbar-track-neutral-900
      scrollbar-thumb-neutral-700
      hover:scrollbar-thumb-neutral-600"
      onWheel={handleScroll}
    >
      {messages.map((message, index) => (
        <MessageBlock key={index} baseDir={baseDir} message={message} allFiles={allFiles} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
