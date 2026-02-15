import { TouchEvent, UIEvent, useCallback, useState, WheelEvent } from 'react';

interface UseScrollingPausedOptions {
  onAutoScroll: () => void;
  threshold?: number;
  bottomThreshold?: number;
}

interface UseScrollingPausedReturn {
  scrollingPaused: boolean;
  setScrollingPaused: (paused: boolean) => void;
  scrollToBottom: () => void;
  eventHandlers: {
    onScroll: (e: UIEvent<HTMLDivElement>) => void;
    onWheel: (e: WheelEvent<HTMLDivElement>) => void;
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
    onTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  };
}

export const useScrollingPaused = ({ onAutoScroll, threshold = 10, bottomThreshold = 20 }: UseScrollingPausedOptions): UseScrollingPausedReturn => {
  const [scrollingPaused, setScrollingPaused] = useState(false);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;

    // Check if content is smaller than scroll area (no scrollbar needed)
    const contentSmallerThanArea = element.scrollHeight <= element.clientHeight;

    // If content is smaller than area, never pause scrolling
    if (contentSmallerThanArea) {
      setScrollingPaused(false);
    }
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      e.stopPropagation();
      // Only pause when scrolling up (negative deltaY)
      if (e.deltaY < 0) {
        setScrollingPaused(true);
      } else if (e.deltaY > 0) {
        const element = e.currentTarget;
        const isAtBottom = element.scrollHeight - element.scrollTop < element.clientHeight + e.deltaY + bottomThreshold;

        if (isAtBottom) {
          setScrollingPaused(false);
        }
      }
    },
    [bottomThreshold],
  );

  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const element = e.currentTarget;
    element.dataset.touchStartY = touch.clientY.toString();
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      const element = e.currentTarget;
      const touchStartY = element.dataset.touchStartY ? parseFloat(element.dataset.touchStartY) : touch.clientY;

      // Detect swipe up (touch moving up, so current Y is less than start Y)
      if (touch.clientY < touchStartY - threshold) {
        // threshold to avoid accidental triggers
        setScrollingPaused(true);
      }
    },
    [threshold],
  );

  const scrollToBottom = useCallback(() => {
    setScrollingPaused(false);
    onAutoScroll();
  }, [onAutoScroll]);

  return {
    scrollingPaused,
    setScrollingPaused,
    scrollToBottom,
    eventHandlers: {
      onScroll: handleScroll,
      onWheel: handleWheel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
    },
  };
};
