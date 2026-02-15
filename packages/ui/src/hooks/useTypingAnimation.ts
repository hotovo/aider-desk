import { useEffect, useState } from 'react';

export const useTypingAnimation = (text: string, typingSpeed: number = 60, pauseDuration: number = 3000) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const typingTimer = setTimeout(() => {
      if (currentIndex >= text.length) {
        // When we reach end, wait before restarting
        setTimeout(() => {
          setDisplayedText('');
          setCurrentIndex(0);
        }, pauseDuration);
        return;
      }

      // Letter-by-letter typing animation
      setDisplayedText((prev) => prev + text[currentIndex]);
      setCurrentIndex((prev) => prev + 1);
    }, typingSpeed);

    return () => clearTimeout(typingTimer);
  }, [currentIndex, text, typingSpeed, pauseDuration]);

  return displayedText;
};
