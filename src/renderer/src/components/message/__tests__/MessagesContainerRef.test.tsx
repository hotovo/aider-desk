import { forwardRef, type ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Message } from '@common/types';

import { Messages } from '../Messages';
import { VirtualizedMessages } from '../VirtualizedMessages';

import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
  useIsReadonlyView: vi.fn(() => false),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => selector({ settings: { messageViewMode: 'normal' } }),
}));

vi.mock('../MessageBlockWrapper', () => ({
  MessageBlockWrapper: ({ message }: { message: Message }) => <div data-testid={`message-${message.id}`} />,
}));

vi.mock('@legendapp/list/react', () => ({
  // Minimal stand-in that exposes a scrollable node like the real LegendList ref does,
  // including the null -> element transition on the first commit.
  LegendList: forwardRef(function LegendList(props: Record<string, unknown>, ref: unknown) {
    const {
      renderItem: _renderItem,
      keyExtractor: _keyExtractor,
      extraData: _extraData,
      estimatedItemSize: _estimatedItemSize,
      initialScrollAtEnd: _initialScrollAtEnd,
      drawDistance: _drawDistance,
      ...domProps
    } = props;
    const attachRef = (node: HTMLDivElement | null) => {
      const handle =
        node === null
          ? null
          : {
              getScrollableNode: () => node,
              scrollToEnd: () => undefined,
              scrollToIndex: () => undefined,
              getState: () => null,
            };
      if (typeof ref === 'function') {
        ref(handle as never);
      } else if (ref && typeof ref === 'object') {
        (ref as { current: unknown }).current = handle;
      }
    };

    return <div data-testid="legend-list" ref={attachRef as never} {...domProps} />;
  }),
}));

describe('Messages container ref reporting', () => {
  const mockApi = createMockApi();

  const createMessage = (id: string): Message =>
    ({
      id,
      type: 'user',
      content: `message ${id}`,
      timestamp: Date.now(),
      inProgress: false,
    }) as Message;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi);

    if (!('ResizeObserver' in globalThis)) {
      class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    }
  });

  const runStreamingLoop = async (onContainerRef: (container: HTMLDivElement | null) => void, renderList: (messageCount: number) => ReactElement) => {
    const consoleError = vi.spyOn(console, 'error');
    const { rerender, unmount } = render(renderList(1));

    for (let i = 1; i <= 80; i++) {
      rerender(renderList(i));
    }

    unmount();

    expect(consoleError.mock.calls.some((call) => String(call[0]).includes('Maximum update depth'))).toBe(false);
    expect(onContainerRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));

    return { consoleError };
  };

  it('reports the container once per render through onContainerRef without update-depth errors', async () => {
    const onContainerRef = vi.fn();
    const { consoleError } = await runStreamingLoop(onContainerRef, (count) => (
      <Messages
        baseDir="/project"
        taskId="task-1"
        inProgress
        messages={Array.from({ length: count }, (_, i) => createMessage(`msg-${i}`))}
        renderMarkdown={true}
        onContainerRef={onContainerRef}
      />
    ));

    consoleError.mockRestore();
  });

  it('reports the container for VirtualizedMessages without update-depth errors', async () => {
    const onContainerRef = vi.fn();
    const { consoleError } = await runStreamingLoop(onContainerRef, (count) => (
      <VirtualizedMessages
        key="task-1"
        baseDir="/project"
        taskId="task-1"
        inProgress
        messages={Array.from({ length: count }, (_, i) => createMessage(`msg-${i}`))}
        renderMarkdown={true}
        onContainerRef={onContainerRef}
      />
    ));

    consoleError.mockRestore();
  });

  it('Messages stays stable across rapid re-renders (streaming regression scenario)', async () => {
    const onContainerRef = vi.fn();
    let lastContainer: unknown = null;
    const trackContainer = (container: HTMLDivElement | null) => {
      onContainerRef(container);
      if (container) {
        lastContainer = container;
      }
    };

    const renderWith = (count: number) => (
      <Messages
        baseDir="/project"
        taskId="task-1"
        inProgress
        messages={Array.from({ length: count }, (_, i) => createMessage(`msg-${i}`))}
        renderMarkdown={true}
        onContainerRef={trackContainer}
      />
    );

    const { rerender } = render(renderWith(0), {});
    for (let i = 1; i <= 80; i++) {
      rerender(renderWith(i));
    }

    expect(lastContainer).toBeInstanceOf(HTMLDivElement);
    expect(lastContainer).toBe(onContainerRef.mock.calls.at(-1)?.[0]);
  });

  it('VirtualizedMessages stays stable across rapid re-renders (streaming regression scenario)', async () => {
    const onContainerRef = vi.fn();
    let lastContainer: unknown = null;
    const trackContainer = (container: HTMLDivElement | null) => {
      onContainerRef(container);
      if (container) {
        lastContainer = container;
      }
    };

    const renderWith = (count: number) => (
      <VirtualizedMessages
        baseDir="/project"
        taskId="task-1"
        inProgress
        messages={Array.from({ length: count }, (_, i) => createMessage(`msg-${i}`))}
        renderMarkdown={true}
        onContainerRef={trackContainer}
      />
    );

    const { rerender } = render(renderWith(0), {});
    for (let i = 1; i <= 80; i++) {
      rerender(renderWith(i));
    }

    expect(lastContainer).toBeInstanceOf(HTMLDivElement);
    expect(lastContainer).toBe(onContainerRef.mock.calls.at(-1)?.[0]);
  });
});
