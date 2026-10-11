import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LegendList, LegendListRef } from '@legendapp/list/react';

import { useVirtualizedListActivation } from '../../src/renderer/src/hooks/useVirtualizedListActivation';
import { getVirtualizedListBottomOffset } from '../../src/renderer/src/utils/virtualizedList';

declare global {
  interface Window {
    legendListRepro: {
      updates: number;
      hiddenMeasurements?: number;
      isRestoring?: () => boolean;
      holdNextRestore?: () => void;
      preAlignmentGap?: number;
      scrollToAnchor?: () => Promise<void>;
      anchorOffset?: () => number | undefined;
      scrollMetrics?: () => { top: number; maximum: number } | undefined;
      setHidden?: (hidden: boolean) => void;
      refresh?: () => void;
      remount?: () => void;
      snapshot?: {
        known: number | undefined;
        applied: number | undefined;
        totalSize: number;
      };
    };
  }
}

window.legendListRepro = { updates: 0 };

const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'feedback';
const data = scenario === 'anchor' ? Array.from({ length: 20 }, (_, index) => ({ id: 'message-' + (index + 1) })) : [{ id: 'message-1' }];
const keyExtractor = (item: (typeof data)[number]) => item.id;

const LegendListRepro = () => {
  const [updates, setUpdates] = useState(0);
  const listRef = useRef<LegendListRef>(null);
  const scrollingPausedRef = useRef(scenario === 'anchor');
  const [hidden, setHidden] = useState(false);
  const [instance, setInstance] = useState(0);
  const itemKeys = useMemo(() => data.map((item) => item.id), []);
  const alignToBottom = useCallback(() => {
    const element = listRef.current?.getScrollableNode();
    if (element && !scrollingPausedRef.current) {
      element.scrollTop = getVirtualizedListBottomOffset(element);
    }
  }, []);
  const isRestoringRef = useVirtualizedListActivation({
    isActive: ['/patched', '/restoration-control'].includes(window.location.pathname) ? !hidden : true,
    listRef,
    itemKeys,
    scrollingPausedRef,
    onRestored: window.location.pathname === '/patched' ? alignToBottom : undefined,
  });
  const scrollToAnchor = useCallback(async () => {
    await listRef.current?.scrollToIndex({ index: 6, viewPosition: 0, viewOffset: -30, animated: false });
  }, []);
  const anchorOffset = useCallback(() => {
    const row = document.querySelector('[data-repro-item="message-7"]');
    const container = listRef.current?.getScrollableNode();
    return row && container ? row.getBoundingClientRect().top - container.getBoundingClientRect().top : undefined;
  }, []);
  const handleSizeChanged = useCallback(() => {
    if (scenario === 'feedback') {
      setUpdates((previous) => Math.min(previous + 1, 80));
    }
  }, []);
  const refresh = useCallback(() => setUpdates((previous) => previous + 1), []);
  const remount = useCallback(() => setInstance((previous) => previous + 1), []);
  const renderItem = useCallback(
    ({ item }: { item: (typeof data)[number] }) => (
      <div
        data-repro-item={item.id}
        style={{
          height:
            scenario === 'anchor'
              ? 120 + updates * 20
              : scenario === 'finished-hidden'
                ? 800 + updates * 200
                : scenario === 'feedback'
                  ? 800 + (updates % 2)
                  : 800,
          background: '#ddd',
        }}
      >
        Measurement feedback fixture
      </div>
    ),
    [updates],
  );

  useLayoutEffect(() => {
    window.legendListRepro.updates = updates;
    window.legendListRepro.setHidden = setHidden;
    window.legendListRepro.holdNextRestore = () => {
      const list = listRef.current;
      if (!list) {
        throw new Error('Missing list instance');
      }
      const originalScrollToEnd = list.scrollToEnd.bind(list);
      list.scrollToEnd = async (options) => {
        await originalScrollToEnd(options);
        const row = document.querySelector<HTMLElement>('[data-repro-item]');
        if (!row) {
          throw new Error('Missing restoration row');
        }
        row.style.height = '1100px';
        for (let frame = 0; frame < 4; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        const element = list.getScrollableNode();
        if (!element) {
          throw new Error('Missing restoration scroll container');
        }
        window.legendListRepro.preAlignmentGap = getVirtualizedListBottomOffset(element) - element.scrollTop;
      };
    };
    window.legendListRepro.refresh = refresh;
    window.legendListRepro.remount = remount;
    window.legendListRepro.isRestoring = () => isRestoringRef.current;
    window.legendListRepro.scrollToAnchor = scrollToAnchor;
    window.legendListRepro.anchorOffset = anchorOffset;
    window.legendListRepro.scrollMetrics = () => {
      const element = listRef.current?.getScrollableNode();
      return element ? { top: element.scrollTop, maximum: element.scrollHeight - element.clientHeight } : undefined;
    };
  }, [updates, refresh, remount, isRestoringRef, scrollToAnchor, anchorOffset]);

  return (
    <div style={{ display: hidden ? 'none' : 'block' }}>
      <LegendList
        key={instance}
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        extraData={updates}
        estimatedItemSize={490}
        onItemSizeChanged={handleSizeChanged}
        style={{ height: 600, width: 1000 }}
      />
    </div>
  );
};

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing reproduction root');
}
createRoot(container).render(<LegendListRepro />);
