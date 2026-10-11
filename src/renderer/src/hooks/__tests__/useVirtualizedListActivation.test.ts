import { act, renderHook } from '@testing-library/react';
import { LegendListRef } from '@legendapp/list/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVirtualizedListActivation } from '../useVirtualizedListActivation';

import { getVirtualizedListBottomOffset } from '@/utils/virtualizedList';

const createList = () => {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 600 },
  });
  const state = { start: 1, scroll: 240, positionAtIndex: () => 200 };
  const list = {
    getState: vi.fn(() => state),
    getScrollableNode: vi.fn(() => element),
    clearCaches: vi.fn(),
    scrollToEnd: vi.fn().mockResolvedValue(undefined),
    scrollToIndex: vi.fn().mockResolvedValue(undefined),
    scrollToOffset: vi.fn().mockResolvedValue(undefined),
  };
  return { list, listRef: { current: list as unknown as LegendListRef }, element };
};

describe('useVirtualizedListActivation', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flushFrame = async () => {
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => {
      pending.forEach((callback) => callback(0));
    });
  };

  it('does not invalidate measurements on initial active mount or ordinary content updates', () => {
    const { list, listRef } = createList();
    const scrollingPausedRef = { current: false };
    const { rerender } = renderHook(({ itemKeys }) => useVirtualizedListActivation({ isActive: true, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { itemKeys: ['first', 'second'] },
    });
    rerender({ itemKeys: ['first', 'second', 'third'] });
    expect(frames.size).toBe(0);
    expect(list.clearCaches).not.toHaveBeenCalled();
  });

  it('remeasures on activation and follows the finished task to its new end', async () => {
    const { list, listRef } = createList();
    const scrollingPausedRef = { current: false };
    const itemKeys = ['first', 'second'];
    const { result, rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { isActive: true },
    });
    rerender({ isActive: false });
    rerender({ isActive: true });
    expect(result.current.current).toBe(true);
    await flushFrame();
    expect(list.clearCaches).toHaveBeenCalledWith({ mode: 'sizes' });
    expect(list.scrollToEnd).toHaveBeenCalledWith({ animated: false });
    expect(scrollingPausedRef.current).toBe(false);
    expect(result.current.current).toBe(true);
    await flushFrame();
    expect(result.current.current).toBe(false);
  });

  it('aligns to the settled DOM bottom after restoration finishes, excluding temporary padding', async () => {
    const { list, listRef, element } = createList();
    const content = document.createElement('div');
    content.className = 'legend-list-content-container';
    content.style.paddingBottom = '100px';
    element.append(content);
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1200 });
    element.scrollTop = 400;
    let finishRestore: (() => void) | undefined;
    list.scrollToEnd.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishRestore = resolve;
        }),
    );
    const onRestored = vi.fn(() => {
      element.scrollTop = getVirtualizedListBottomOffset(element);
    });
    const scrollingPausedRef = { current: false };
    const itemKeys = ['first', 'second'];
    const { result, rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef, onRestored }), {
      initialProps: { isActive: false },
    });
    rerender({ isActive: true });
    await flushFrame();
    Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1600 });
    expect(result.current.current).toBe(true);
    await act(async () => finishRestore?.());
    expect(onRestored).not.toHaveBeenCalled();
    await flushFrame();
    expect(result.current.current).toBe(false);
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(element.scrollTop).toBe(900);
  });

  it('does not realign a paused conversation after restoring its anchor', async () => {
    const { listRef } = createList();
    const scrollingPausedRef = { current: true };
    const itemKeys = ['first', 'second'];
    const onRestored = vi.fn();
    const { rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef, onRestored }), {
      initialProps: { isActive: true },
    });
    rerender({ isActive: false });
    rerender({ isActive: true });
    await flushFrame();
    await flushFrame();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('cancels final alignment if the task is hidden before the final frame', async () => {
    const { listRef } = createList();
    const scrollingPausedRef = { current: false };
    const itemKeys = ['first', 'second'];
    const onRestored = vi.fn();
    const { result, rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef, onRestored }), {
      initialProps: { isActive: false },
    });
    rerender({ isActive: true });
    await flushFrame();
    rerender({ isActive: false });
    await flushFrame();
    expect(onRestored).not.toHaveBeenCalled();
    expect(result.current.current).toBe(false);
  });

  it('preserves the paused message anchor and offset when messages change while hidden', async () => {
    const { list, listRef } = createList();
    const scrollingPausedRef = { current: true };
    const { rerender } = renderHook(({ isActive, itemKeys }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { isActive: true, itemKeys: ['first', 'second'] },
    });
    rerender({ isActive: false, itemKeys: ['first', 'second'] });
    rerender({ isActive: false, itemKeys: ['inserted', 'first', 'second'] });
    rerender({ isActive: true, itemKeys: ['inserted', 'first', 'second'] });
    await flushFrame();
    expect(list.scrollToIndex).toHaveBeenCalledWith({ index: 2, viewPosition: 0, viewOffset: -40, animated: false });
    expect(list.scrollToEnd).not.toHaveBeenCalled();
    expect(scrollingPausedRef.current).toBe(true);
  });

  it('uses the saved scroll offset when the paused anchor was removed while hidden', async () => {
    const { list, listRef } = createList();
    const scrollingPausedRef = { current: true };
    const { rerender } = renderHook(({ isActive, itemKeys }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { isActive: true, itemKeys: ['first', 'second'] },
    });
    rerender({ isActive: false, itemKeys: ['first', 'second'] });
    list.getState().scroll = 0;
    rerender({ isActive: true, itemKeys: ['first'] });
    await flushFrame();
    expect(list.scrollToOffset).toHaveBeenCalledWith({ offset: 240, animated: false });
    expect(list.scrollToIndex).not.toHaveBeenCalled();
  });

  it('waits for a measurable scroll container before clearing sizes', async () => {
    const { list, listRef, element } = createList();
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 0 });
    const scrollingPausedRef = { current: false };
    const itemKeys = ['first', 'second'];
    const { rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { isActive: false },
    });
    rerender({ isActive: true });
    await flushFrame();
    expect(list.clearCaches).not.toHaveBeenCalled();
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: 1000 });
    await flushFrame();
    expect(list.clearCaches).toHaveBeenCalledTimes(1);
  });

  it('cancels queued restoration if the task is hidden again', async () => {
    const { list, listRef } = createList();
    const scrollingPausedRef = { current: false };
    const itemKeys = ['first', 'second'];
    const { result, rerender } = renderHook(({ isActive }) => useVirtualizedListActivation({ isActive, listRef, itemKeys, scrollingPausedRef }), {
      initialProps: { isActive: false },
    });
    rerender({ isActive: true });
    rerender({ isActive: false });
    await flushFrame();
    expect(list.clearCaches).not.toHaveBeenCalled();
    expect(result.current.current).toBe(false);
  });
});
