import { useCallback, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LegendList } from '@legendapp/list/react';

declare global {
  interface Window {
    legendListRepro: {
      updates: number;
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

const data = [{ id: 'message-1' }];
const keyExtractor = (item: (typeof data)[number]) => item.id;

const scenario = new URLSearchParams(window.location.search).get('scenario') ?? 'feedback';

const LegendListRepro = () => {
  const [updates, setUpdates] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [instance, setInstance] = useState(0);
  const handleSizeChanged = useCallback(() => {
    if (scenario === 'feedback') {
      setUpdates((previous) => Math.min(previous + 1, 80));
    }
  }, []);
  const refresh = useCallback(() => setUpdates((previous) => previous + 1), []);
  const remount = useCallback(() => setInstance((previous) => previous + 1), []);
  const renderItem = useCallback(
    () => (
      <div
        data-repro-item
        style={{
          height: scenario === 'feedback' ? 800 + (updates % 2) : 800,
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
    window.legendListRepro.refresh = refresh;
    window.legendListRepro.remount = remount;
  }, [updates, refresh, remount]);

  return (
    <div style={{ display: hidden ? 'none' : 'block' }}>
      <LegendList
        key={instance}
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
