import { devtools } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

export enum PaletteItemType {
  Action = 'action',
  File = 'file',
  Task = 'task',
  Project = 'project',
}

export type PaletteItem = {
  id: string;
  label: string;
  description?: string;
  state?: string;
  archived?: boolean;
  type: PaletteItemType;
  shortcut?: string;
  action: () => void;
};

type CommandPaletteStore = {
  isOpen: boolean;
  items: Map<string, PaletteItem>;
  recentlyUsed: string[];
  itemIdsByScope: Map<string, Set<string>>;
  itemsByScope: Map<string, Map<string, PaletteItem>>;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  replaceItems: (scope: string, items: PaletteItem[]) => void;
  clearItems: (scope: string) => void;
  addRecentlyUsed: (itemId: string) => void;
};

const RECENTLY_USED_KEY = 'command-palette-recently-used';
const MAX_RECENTLY_USED = 10;

const loadRecentlyUsed = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENTLY_USED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentlyUsed = (ids: string[]) => {
  try {
    localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors.
  }
};

const hasSameMetadata = (first: PaletteItem, second: PaletteItem) =>
  first.label === second.label &&
  first.description === second.description &&
  first.state === second.state &&
  first.archived === second.archived &&
  first.type === second.type &&
  first.shortcut === second.shortcut;

export const useCommandPaletteStore = createWithEqualityFn<CommandPaletteStore>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      items: new Map(),
      recentlyUsed: loadRecentlyUsed(),
      itemIdsByScope: new Map(),
      itemsByScope: new Map(),

      openPalette: () => set({ isOpen: true }),
      closePalette: () => set({ isOpen: false }),
      togglePalette: () => set((state) => ({ isOpen: !state.isOpen })),

      replaceItems: (scope, nextItems) => {
        const state = get();
        const nextItemIds = new Set(nextItems.map((item) => item.id));
        const previousItemIds = state.itemIdsByScope.get(scope) ?? new Set<string>();
        const itemIdsByScope = new Map(state.itemIdsByScope);
        itemIdsByScope.set(scope, nextItemIds);
        const itemsByScope = new Map(state.itemsByScope);
        itemsByScope.delete(scope);
        itemsByScope.set(scope, new Map(nextItems.map((item) => [item.id, item])));
        const items = new Map(state.items);
        let hasChanges = false;

        const affectedItemIds = new Set([...previousItemIds, ...nextItemIds]);
        affectedItemIds.forEach((itemId) => {
          const replacement = Array.from(itemsByScope.values())
            .reverse()
            .find((scopeItems) => scopeItems.has(itemId))
            ?.get(itemId);
          const existing = items.get(itemId);
          if (!replacement) {
            items.delete(itemId);
            hasChanges = true;
          } else if (existing && hasSameMetadata(existing, replacement)) {
            existing.action = replacement.action;
          } else {
            items.set(itemId, { ...replacement });
            hasChanges = true;
          }
        });

        set({ items: hasChanges ? items : state.items, itemIdsByScope, itemsByScope });
      },

      clearItems: (scope) => {
        const state = get();
        const itemIds = state.itemIdsByScope.get(scope);
        if (!itemIds) {
          return;
        }

        const itemIdsByScope = new Map(state.itemIdsByScope);
        itemIdsByScope.delete(scope);
        const itemsByScope = new Map(state.itemsByScope);
        itemsByScope.delete(scope);
        const items = new Map(state.items);
        let hasChanges = false;

        itemIds.forEach((itemId) => {
          const replacement = Array.from(itemsByScope.values())
            .reverse()
            .find((scopeItems) => scopeItems.has(itemId))
            ?.get(itemId);
          const existing = items.get(itemId);
          if (!replacement) {
            items.delete(itemId);
            hasChanges = true;
          } else if (existing && hasSameMetadata(existing, replacement)) {
            existing.action = replacement.action;
          } else {
            items.set(itemId, { ...replacement });
            hasChanges = true;
          }
        });
        set({ items: hasChanges ? items : state.items, itemIdsByScope, itemsByScope });
      },

      addRecentlyUsed: (itemId) => {
        const recentlyUsed = [itemId, ...get().recentlyUsed.filter((id) => id !== itemId)].slice(0, MAX_RECENTLY_USED);
        saveRecentlyUsed(recentlyUsed);
        set({ recentlyUsed });
      },
    }),
    { name: 'CommandPaletteStore', enabled: import.meta.env.DEV },
  ),
);
