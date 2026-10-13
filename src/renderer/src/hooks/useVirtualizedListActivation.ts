import { RefObject, useLayoutEffect, useRef } from 'react';
import { LegendListRef } from '@legendapp/list/react';

import { getVirtualizedListBottomOffset } from '../utils/virtualizedList';

type Props = {
  isActive: boolean;
  listRef: RefObject<LegendListRef | null>;
  itemKeys: string[];
  scrollingPausedRef: RefObject<boolean>;
  onRestored?: () => void;
};

export const useVirtualizedListActivation = ({ isActive, listRef, itemKeys, scrollingPausedRef, onRestored }: Props) => {
  const itemKeysRef = useRef(itemKeys);
  const wasActiveRef = useRef(isActive);
  const anchorRef = useRef<{ key: string; offset: number } | null>(null);
  const scrollOffsetRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);
  const onRestoredRef = useRef(onRestored);

  useLayoutEffect(() => {
    onRestoredRef.current = onRestored;
  }, [onRestored]);

  useLayoutEffect(() => {
    itemKeysRef.current = itemKeys;
  }, [itemKeys]);

  useLayoutEffect(() => {
    if (!isActive) {
      if (wasActiveRef.current) {
        const state = listRef.current?.getState();
        scrollOffsetRef.current = state?.scroll ?? null;
        const key = state && itemKeysRef.current[state.start];
        anchorRef.current = state && key ? { key, offset: state.scroll - state.positionAtIndex(state.start) } : null;
      }
      wasActiveRef.current = false;
      return;
    }
    if (wasActiveRef.current) {
      return;
    }
    wasActiveRef.current = true;
    isRestoringRef.current = true;

    let cancelled = false;
    let frame = 0;
    const waitForNextFrame = () =>
      new Promise<void>((resolve) => {
        frame = requestAnimationFrame(() => resolve());
      });

    const restore = async () => {
      if (cancelled) {
        return;
      }
      const list = listRef.current;
      const element = list?.getScrollableNode();
      if (!list || !element || !element.clientWidth || !element.clientHeight) {
        frame = requestAnimationFrame(() => void restore());
        return;
      }
      isRestoringRef.current = true;
      await waitForNextFrame();
      if (cancelled) {
        return;
      }
      const state = list.getState();
      const scroll = scrollOffsetRef.current ?? state.scroll;
      const anchor = anchorRef.current;
      const index = anchor ? itemKeysRef.current.indexOf(anchor.key) : -1;
      try {
        if (!scrollingPausedRef.current) {
          const bottomOffset = getVirtualizedListBottomOffset(element);
          if (Math.abs(element.scrollTop - bottomOffset) > 1 || Math.abs(state.scroll - bottomOffset) > 1) {
            await list.scrollToEnd({ animated: false });
          }
        } else if (anchor && index >= 0) {
          const targetOffset = state.positionAtIndex(index) + anchor.offset;
          if (Math.abs(state.scroll - targetOffset) > 1 || Math.abs(element.scrollTop - targetOffset) > 1) {
            await list.scrollToIndex({ index, viewPosition: 0, viewOffset: -anchor.offset, animated: false });
          }
        } else if (Math.abs(state.scroll - scroll) > 1 || Math.abs(element.scrollTop - scroll) > 1) {
          await list.scrollToOffset({ offset: scroll, animated: false });
        }
      } finally {
        if (!cancelled) {
          frame = requestAnimationFrame(() => {
            if (cancelled) {
              return;
            }
            isRestoringRef.current = false;
            if (!scrollingPausedRef.current) {
              onRestoredRef.current?.();
            }
          });
        }
      }
    };
    frame = requestAnimationFrame(() => void restore());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      isRestoringRef.current = false;
    };
  }, [isActive, listRef, scrollingPausedRef]);

  return isRestoringRef;
};
