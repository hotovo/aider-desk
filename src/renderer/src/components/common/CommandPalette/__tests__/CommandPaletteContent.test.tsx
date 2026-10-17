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
      providersByScope: new Map([['test', () => Array.from(items.values())]]),
      recentlyUsed: [],
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
    scrollIntoView.mockClear();
    fireEvent.scroll(list!);

    expect(screen.getByRole('button', { name: 'Item 21' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Item 40' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Item 41' })).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('remembers the last selected tab when the palette is reopened', () => {
    const { items } = createItems();
    useCommandPaletteStore.setState({
      isOpen: true,
      providersByScope: new Map([['test', () => Array.from(items.values())]]),
      recentlyUsed: [],
    });
    const { unmount } = render(<CommandPaletteContent />);

    fireEvent.click(screen.getByRole('button', { name: 'commandPalette.tabs.action' }));
    expect(localStorage.getItem('command-palette-active-tab')).toBe('action');

    unmount();
    useCommandPaletteStore.setState({ isOpen: true });
    render(<CommandPaletteContent />);

    expect(screen.getByRole('button', { name: 'commandPalette.tabs.action' })).toHaveClass('bg-bg-tertiary');
  });

  it('shows archived tasks only when no active task matches the search', () => {
    const items = new Map<string, PaletteItem>([
      ['task.active', { id: 'task.active', label: 'Active matching task', type: PaletteItemType.Task, action: vi.fn() }],
      ['task.archived', { id: 'task.archived', label: 'Archived matching task', archived: true, type: PaletteItemType.Task, action: vi.fn() }],
    ]);
    useCommandPaletteStore.setState({
      isOpen: true,
      providersByScope: new Map([['test', () => Array.from(items.values())]]),
      recentlyUsed: [],
    });
    render(<CommandPaletteContent />);

    const input = screen.getByPlaceholderText('commandPalette.placeholder');
    expect(screen.getByRole('button', { name: 'Active matching task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archived matching task' })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Archived' } });

    expect(screen.getByText('Archived matching task')).toBeInTheDocument();
  });

  it('preserves selection by ID when live updates reorder items and executes the fresh callback', () => {
    const { actions, input } = renderPalette();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const latestAction = vi.fn();
    const { items } = createItems();
    const reorderedItems = Array.from(items.values())
      .reverse()
      .map((item) => (item.id === 'item-2' ? { ...item, action: latestAction } : item));

    act(() => useCommandPaletteStore.getState().setItemsProvider('test', () => reorderedItems));

    expect(screen.getByRole('button', { name: 'Item 2' })).toHaveAttribute('data-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(latestAction).toHaveBeenCalledOnce();
    actions.forEach((action) => expect(action).not.toHaveBeenCalled());
  });

  it('preserves the initial selection when a live update inserts an item before it', () => {
    const { input } = renderPalette();
    const { items } = createItems();
    const newItem: PaletteItem = { id: 'new', label: 'New item', type: PaletteItemType.Action, action: vi.fn() };

    act(() => useCommandPaletteStore.getState().setItemsProvider('test', () => [newItem, ...items.values()]));

    expect(screen.getByRole('button', { name: 'Item 1' })).toHaveAttribute('data-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(items.get('item-1')?.action).toHaveBeenCalledOnce();
    expect(newItem.action).not.toHaveBeenCalled();
  });

  it('falls back to the first item when the selected item disappears and handles an empty list', () => {
    const { input } = renderPalette();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const { items } = createItems();
    const remaining = Array.from(items.values()).slice(0, 2);

    act(() => useCommandPaletteStore.getState().setItemsProvider('test', () => remaining));
    expect(screen.getByRole('button', { name: 'Item 1' })).toHaveAttribute('data-selected', 'true');

    act(() => useCommandPaletteStore.getState().clearItems('test'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useCommandPaletteStore.getState().isOpen).toBe(true);
    remaining.forEach((item) => expect(item.action).not.toHaveBeenCalled());
  });

  it('does not recollect providers when only the search or selected tab changes', () => {
    const { items } = createItems();
    const provider = vi.fn(() => Array.from(items.values()));
    useCommandPaletteStore.setState({ providersByScope: new Map([['test', provider]]), recentlyUsed: [], isOpen: true });
    render(<CommandPaletteContent />);
    provider.mockClear();

    fireEvent.change(screen.getByPlaceholderText('commandPalette.placeholder'), { target: { value: 'Item' } });
    fireEvent.click(screen.getByRole('button', { name: 'commandPalette.tabs.action' }));

    expect(provider).not.toHaveBeenCalled();
  });
});
