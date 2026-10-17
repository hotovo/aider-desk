import { beforeEach, describe, expect, it, vi } from 'vitest';

import { collectPaletteItems, PaletteItem, PaletteItemType, useCommandPaletteStore } from '../commandPaletteStore';

const createItem = (id: string): PaletteItem => ({
  id,
  label: id,
  type: PaletteItemType.Action,
  action: vi.fn(),
});

describe('commandPaletteStore', () => {
  beforeEach(() => {
    useCommandPaletteStore.setState({
      providersByScope: new Map(),
      isOpen: false,
      recentlyUsed: [],
    });
  });

  it('keeps commands registered by the newly active project when the previous project clears afterward', () => {
    const firstProjectCommands = [createItem('task.new'), createItem('task.close'), createItem('task.focusPrompt')];
    const secondProjectCommands = [createItem('task.new'), createItem('task.close'), createItem('task.focusPrompt')];
    const { setItemsProvider, clearItems } = useCommandPaletteStore.getState();

    setItemsProvider('project:first', () => firstProjectCommands);
    setItemsProvider('project:second', () => secondProjectCommands);
    clearItems('project:first');

    const state = useCommandPaletteStore.getState();
    expect(Array.from(collectPaletteItems(state.providersByScope).keys())).toEqual(['task.new', 'task.close', 'task.focusPrompt']);
    expect(collectPaletteItems(state.providersByScope).get('task.new')?.action).toBe(secondProjectCommands[0].action);
    expect(state.providersByScope.has('project:first')).toBe(false);
    expect(state.providersByScope.has('project:second')).toBe(true);
  });

  it('restores the remaining owner when a newer scope stops owning a shared command', () => {
    const firstProjectCommand = createItem('task.new');
    const secondProjectCommand = createItem('task.new');
    const { setItemsProvider } = useCommandPaletteStore.getState();

    setItemsProvider('project:first', () => [firstProjectCommand]);
    setItemsProvider('project:second', () => [secondProjectCommand]);
    setItemsProvider('project:second', () => []);

    expect(collectPaletteItems(useCommandPaletteStore.getState().providersByScope).get('task.new')?.action).toBe(firstProjectCommand.action);
  });

  it('restores the remaining owner when the newer scope clears', () => {
    const firstProjectCommand = createItem('task.new');
    const secondProjectCommand = createItem('task.new');
    const { setItemsProvider, clearItems } = useCommandPaletteStore.getState();

    setItemsProvider('project:first', () => [firstProjectCommand]);
    setItemsProvider('project:second', () => [secondProjectCommand]);
    clearItems('project:second');

    expect(collectPaletteItems(useCommandPaletteStore.getState().providersByScope).get('task.new')?.action).toBe(firstProjectCommand.action);
  });

  it('removes an empty stale scope', () => {
    const { setItemsProvider, clearItems } = useCommandPaletteStore.getState();

    setItemsProvider('project:first', () => []);
    clearItems('project:first');

    const state = useCommandPaletteStore.getState();
    expect(state.providersByScope.has('project:first')).toBe(false);
    expect(collectPaletteItems(state.providersByScope).size).toBe(0);
  });

  it('removes stale scope items only after their final owner clears', () => {
    const { setItemsProvider, clearItems } = useCommandPaletteStore.getState();

    setItemsProvider('project:first', () => [createItem('task.new'), createItem('task.switch.first')]);
    setItemsProvider('project:second', () => [createItem('task.new'), createItem('task.switch.second')]);
    clearItems('project:first');

    expect(Array.from(collectPaletteItems(useCommandPaletteStore.getState().providersByScope).keys())).toEqual(['task.new', 'task.switch.second']);

    clearItems('project:second');

    const state = useCommandPaletteStore.getState();
    expect(collectPaletteItems(state.providersByScope).size).toBe(0);
    expect(state.providersByScope.size).toBe(0);
  });

  it('gives a re-registered scope precedence without mutating the previous registry', () => {
    const first = createItem('shared');
    const second = createItem('shared');
    const { setItemsProvider } = useCommandPaletteStore.getState();
    setItemsProvider('first', () => [first]);
    setItemsProvider('second', () => [second]);
    const previous = useCommandPaletteStore.getState().providersByScope;

    setItemsProvider('first', () => [first]);

    expect(collectPaletteItems(previous).get('shared')).toBe(second);
    expect(collectPaletteItems(useCommandPaletteStore.getState().providersByScope).get('shared')).toBe(first);
  });

  it('does not invoke providers when registering or clearing scopes', () => {
    const provider = vi.fn(() => [createItem('task.new')]);
    const { setItemsProvider, clearItems } = useCommandPaletteStore.getState();
    setItemsProvider('first', provider);
    setItemsProvider('second', provider);
    clearItems('first');
    clearItems('missing');

    expect(provider).not.toHaveBeenCalled();
  });
});
