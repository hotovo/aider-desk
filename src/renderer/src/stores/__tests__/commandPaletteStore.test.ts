import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaletteItem, PaletteItemType, useCommandPaletteStore } from '../commandPaletteStore';

const createItem = (id: string): PaletteItem => ({
  id,
  label: id,
  type: PaletteItemType.Action,
  action: vi.fn(),
});

describe('commandPaletteStore', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({
      items: new Map(),
      itemIdsByScope: new Map(),
      itemsByScope: new Map(),
      recentlyUsed: [],
    });
  });

  it('keeps commands registered by the newly active project when the previous project clears afterward', () => {
    const firstProjectCommands = [createItem('task.new'), createItem('task.close'), createItem('task.focusPrompt')];
    const secondProjectCommands = [createItem('task.new'), createItem('task.close'), createItem('task.focusPrompt')];
    const { replaceItems, clearItems } = useCommandPaletteStore.getState();

    replaceItems('project:first', firstProjectCommands);
    replaceItems('project:second', secondProjectCommands);
    clearItems('project:first');

    const state = useCommandPaletteStore.getState();
    expect(Array.from(state.items.keys())).toEqual(['task.new', 'task.close', 'task.focusPrompt']);
    expect(state.items.get('task.new')?.action).toBe(secondProjectCommands[0].action);
    expect(state.itemIdsByScope.has('project:first')).toBe(false);
    expect(state.itemIdsByScope.get('project:second')).toEqual(new Set(['task.new', 'task.close', 'task.focusPrompt']));
  });

  it('restores the remaining owner when a newer scope stops owning a shared command', () => {
    const firstProjectCommand = createItem('task.new');
    const secondProjectCommand = createItem('task.new');
    const { replaceItems } = useCommandPaletteStore.getState();

    replaceItems('project:first', [firstProjectCommand]);
    replaceItems('project:second', [secondProjectCommand]);
    replaceItems('project:second', []);

    expect(useCommandPaletteStore.getState().items.get('task.new')?.action).toBe(firstProjectCommand.action);
  });

  it('restores the remaining owner when the newer scope clears', () => {
    const firstProjectCommand = createItem('task.new');
    const secondProjectCommand = createItem('task.new');
    const { replaceItems, clearItems } = useCommandPaletteStore.getState();

    replaceItems('project:first', [firstProjectCommand]);
    replaceItems('project:second', [secondProjectCommand]);
    clearItems('project:second');

    expect(useCommandPaletteStore.getState().items.get('task.new')?.action).toBe(firstProjectCommand.action);
  });

  it('removes an empty stale scope', () => {
    const { replaceItems, clearItems } = useCommandPaletteStore.getState();

    replaceItems('project:first', []);
    clearItems('project:first');

    const state = useCommandPaletteStore.getState();
    expect(state.itemIdsByScope.has('project:first')).toBe(false);
    expect(state.itemsByScope.has('project:first')).toBe(false);
  });

  it('removes stale scope items only after their final owner clears', () => {
    const { replaceItems, clearItems } = useCommandPaletteStore.getState();

    replaceItems('project:first', [createItem('task.new'), createItem('task.switch.first')]);
    replaceItems('project:second', [createItem('task.new'), createItem('task.switch.second')]);
    clearItems('project:first');

    expect(Array.from(useCommandPaletteStore.getState().items.keys())).toEqual(['task.new', 'task.switch.second']);

    clearItems('project:second');

    const state = useCommandPaletteStore.getState();
    expect(state.items.size).toBe(0);
    expect(state.itemIdsByScope.size).toBe(0);
  });
});
