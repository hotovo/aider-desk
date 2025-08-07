import { useEffect, useState } from 'react';

import { Message } from '@/types/message';

type Props = {
  message: Message;
};

export const LoadingMessageBlock = ({ message }: Props) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-bg-secondary border border-border-darkLight text-text-primary';

  useEffect(() => {
    // Reset animation when message content changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [message.content]);

  useEffect(() => {
    const typingTimer = setTimeout(() => {
      if (currentIndex >= message.content.length) {
        // When we reach the end, wait a bit longer before restarting
        setTimeout(() => {
          setDisplayedText('');
          setCurrentIndex(0);
        }, 3000); // 1 second pause before restarting
        return;
      }

      // Letter-by-letter typing animation
      setDisplayedText((prev) => prev + message.content[currentIndex]);
      setCurrentIndex((prev) => prev + 1);
    }, 60); // Adjust speed as needed

    return () => clearTimeout(typingTimer);
  }, [currentIndex, message.content]);

  return (
    <div className={`${baseClasses} text-text-secondary relative group flex items-center`}>
      <span className="flex-grow">{displayedText || ' '}</span>
    </div>
  );
};
