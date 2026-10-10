import { forwardRef, useImperativeHandle, useRef, UIEventHandler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Message } from '@common/types';

import { Messages } from '../Messages';
import { VirtualizedMessages } from '../VirtualizedMessages';

const { settings, getListState } = vi.hoisted(() => ({
  settings: { showMessageMap: true, messageViewMode: 'normal' },
  getListState: vi.fn(() => ({ start: 0, end: 9 })),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: { settings: typeof settings }) => unknown) => selector({ settings }),
}));

vi.mock('../MessageBlockWrapper', () => ({
  MessageBlockWrapper: ({ message }: { message: Message }) => <div data-message-index={message.id} />,
}));

vi.mock('../MessageMap', () => ({
  MessageMap: ({ visibleIndex }: { visibleIndex: number }) => <div data-testid="visible-index">{visibleIndex}</div>,
}));

vi.mock('@/hooks/useUserMessageNavigation', () => ({
  useUserMessageNavigation: () => ({
    hasPreviousUserMessage: false,
    hasNextUserMessage: false,
  }),
}));

vi.mock('@/hooks/useScrollingPaused', () => ({
  useScrollingPaused: () => ({ scrollingPaused: true, eventHandlers: {} }),
}));

vi.mock('@legendapp/list/react', () => ({
  LegendList: forwardRef(function LegendList({ onScroll }: { onScroll: UIEventHandler<HTMLDivElement> }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ({ getScrollableNode: () => containerRef.current, getState: getListState }), []);
    return <div ref={containerRef} onScroll={onScroll} data-testid="legend-list" />;
  }),
}));

const messages: Message[] = Array.from({ length: 1024 }, (_, index) => ({ id: String(index), type: 'user', content: 'Question' }));

const advanceFrame = () => act(() => vi.advanceTimersByTime(20));

const renderMessages = (items = messages) => {
  let container: HTMLDivElement | null = null;
  const onContainerRef = (element: HTMLDivElement | null) => {
    container = element;
  };
  const result = render(<Messages baseDir="/project" taskId="task" inProgress messages={items} renderMarkdown onContainerRef={onContainerRef} />);
  if (!container) {
    throw new Error('Missing messages container');
  }
  return { ...result, container };
};

describe('Messages map visibility tracking', () => {
  let scrollOffset = 0;
  let geometryReads = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    settings.showMessageMap = true;
    scrollOffset = 0;
    geometryReads = 0;
    getListState.mockReset();
    getListState.mockReturnValue({ start: 0, end: 9 });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const index = this.getAttribute('data-message-index');
      if (index !== null) {
        geometryReads++;
        return new DOMRect(0, Number(index) * 10 - scrollOffset, 100, 10);
      }
      return new DOMRect(0, 0, 100, 100);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('finds the last message that has entered the viewport, excluding an exact bottom boundary', () => {
    const { container } = renderMessages();
    advanceFrame();
    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^9$/);

    scrollOffset = 505;
    fireEvent.scroll(container);
    advanceFrame();
    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^60$/);
  });

  it('uses logarithmic geometry reads near the end of a long conversation', () => {
    const { container } = renderMessages();
    advanceFrame();
    geometryReads = 0;
    scrollOffset = 10240;

    fireEvent.scroll(container);
    advanceFrame();

    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^1023$/);
    expect(geometryReads).toBeLessThanOrEqual(11);
  });

  it('does not measure message geometry when the map is disabled', () => {
    settings.showMessageMap = false;
    const { container } = renderMessages();
    advanceFrame();
    fireEvent.scroll(container);
    advanceFrame();

    expect(screen.queryByTestId('visible-index')).not.toBeInTheDocument();
    expect(geometryReads).toBe(0);
  });

  it('stops visibility tracking when the map is turned off', () => {
    const { container, rerender } = renderMessages();
    advanceFrame();
    settings.showMessageMap = false;
    rerender(<Messages baseDir="/project" taskId="task" inProgress messages={messages} renderMarkdown />);
    geometryReads = 0;

    fireEvent.scroll(container);
    advanceFrame();

    expect(geometryReads).toBe(0);
  });

  it('tracks the current viewport when the map is enabled again', () => {
    settings.showMessageMap = false;
    const { rerender } = renderMessages();
    advanceFrame();
    scrollOffset = 505;
    settings.showMessageMap = true;

    rerender(<Messages baseDir="/project" taskId="task" inProgress messages={messages} renderMarkdown />);
    advanceFrame();

    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^60$/);
  });

  it('does not read the virtualized visible range for a disabled map', () => {
    settings.showMessageMap = false;
    render(<VirtualizedMessages baseDir="/project" taskId="task" inProgress messages={messages} renderMarkdown />);

    fireEvent.scroll(screen.getByTestId('legend-list'));

    expect(getListState).not.toHaveBeenCalled();
    expect(screen.queryByTestId('visible-index')).not.toBeInTheDocument();
  });

  it('refreshes the virtualized visible range when the map is enabled again', () => {
    settings.showMessageMap = false;
    const { rerender } = render(<VirtualizedMessages baseDir="/project" taskId="task" inProgress messages={messages} renderMarkdown />);
    getListState.mockReturnValue({ start: 50, end: 60 });
    settings.showMessageMap = true;

    rerender(<VirtualizedMessages baseDir="/project" taskId="task" inProgress messages={[...messages]} renderMarkdown />);
    advanceFrame();

    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^60$/);
    getListState.mockReturnValue({ start: 70, end: 80 });
    fireEvent.scroll(screen.getByTestId('legend-list'));
    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^80$/);
  });

  it('handles an empty conversation without measuring the end sentinel', () => {
    renderMessages([]);
    advanceFrame();

    expect(screen.getByTestId('visible-index')).toHaveTextContent(/^0$/);
    expect(geometryReads).toBe(0);
  });
});
