import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';

import { CommandPaletteContent } from '../CommandPaletteContent';

import { PaletteItem, PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';

const ITEM_COUNT = 45;

const createItems = () => {
  const actions = Array.from({ length: ITEM_COUNT }, () => vi.fn());
  const items = new Map<string, PaletteItem>(
    actions.map((action, index) => {
      const itemNumber = index + 1;
      return [
        `item-${itemNumber}`,
        {
          id: `item-${itemNumber}`,
          label: `Item ${itemNumber}`,
          type: PaletteItemType.Action,
          action,
        },
      ];
    }),
  );

  return { actions, items };
};

describe('CommandPaletteContent keyboard pagination', () => {
  let scrollIntoView: ReturnType<typeof vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>>;

  beforeEach(() => {
    localStorage.clear();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPalette = () => {
    const { actions, items } = createItems();
    useCommandPaletteStore.setState({
      isOpen: true,
      items,
      recentlyUsed: [],
      itemIdsByScope: new Map(),
    });
    render(<CommandPaletteContent />);

    return {
      actions,
      input: screen.getByPlaceholderText('commandPalette.placeholder'),
    };
  };

  it('loads, renders, and scrolls to an item selected across a page boundary before Enter executes it', () => {
    const { actions, input } = renderPalette();

    expect(screen.queryByRole('button', { name: 'Item 21' })).not.toBeInTheDocument();
    scrollIntoView.mockClear();

    act(() => {
      for (let index = 0; index < 20; index++) {
        flushSync(() => fireEvent.keyDown(input, { key: 'ArrowDown' }));
      }
    });

    const selectedItem = screen.getByRole('button', { name: 'Item 21' });
    expect(selectedItem).toHaveAttribute('data-selected', 'true');
    expect(scrollIntoView.mock.contexts).toContain(selectedItem);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(actions[20]).toHaveBeenCalledOnce();
    actions.slice(0, 20).forEach((action) => expect(action).not.toHaveBeenCalled());
    expect(useCommandPaletteStore.getState().isOpen).toBe(false);
  });

  it('loads and scrolls to the last item when ArrowUp wraps from the first item', () => {
    const { actions, input } = renderPalette();

    expect(screen.queryByRole('button', { name: 'Item 45' })).not.toBeInTheDocument();
    scrollIntoView.mockClear();

    act(() => flushSync(() => fireEvent.keyDown(input, { key: 'ArrowUp' })));

    const selectedItem = screen.getByRole('button', { name: 'Item 45' });
    expect(selectedItem).toHaveAttribute('data-selected', 'true');
    expect(scrollIntoView.mock.contexts).toContain(selectedItem);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(actions[44]).toHaveBeenCalledOnce();
  });

  it('continues to load the next page when the list is scrolled to the bottom', () => {
    renderPalette();

    const firstItem = screen.getByRole('button', { name: 'Item 1' });
    const list = firstItem.parentElement;
    expect(list).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Item 21' })).not.toBeInTheDocument();

    Object.defineProperties(list, {
      scrollTop: { configurable: true, value: 100 },
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
    });
    fireEvent.scroll(list!);

    expect(screen.getByRole('button', { name: 'Item 21' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Item 40' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Item 41' })).not.toBeInTheDocument();
  });

  it('shows archived tasks only when no active task matches the search', () => {
    const items = new Map<string, PaletteItem>([
      ['task.active', { id: 'task.active', label: 'Active matching task', type: PaletteItemType.Task, action: vi.fn() }],
      ['task.archived', { id: 'task.archived', label: 'Archived matching task', archived: true, type: PaletteItemType.Task, action: vi.fn() }],
    ]);
    useCommandPaletteStore.setState({
      isOpen: true,
      items,
      recentlyUsed: [],
      itemIdsByScope: new Map(),
    });
    render(<CommandPaletteContent />);

    const input = screen.getByPlaceholderText('commandPalette.placeholder');
    expect(screen.getByRole('button', { name: 'Active matching task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archived matching task' })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Archived' } });

    expect(screen.getByText('Archived matching task')).toBeInTheDocument();
  });
});
