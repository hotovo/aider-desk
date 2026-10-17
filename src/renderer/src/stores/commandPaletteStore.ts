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
  providersByScope: Map<string, () => PaletteItem[]>;
  recentlyUsed: string[];

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setItemsProvider: (scope: string, provider: () => PaletteItem[]) => void;
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

export const collectPaletteItems = (providersByScope: ReadonlyMap<string, () => PaletteItem[]>): Map<string, PaletteItem> => {
  const items = new Map<string, PaletteItem>();
  for (const provider of providersByScope.values()) {
    for (const item of provider()) {
      items.set(item.id, item);
    }
  }
  return items;
};

export const useCommandPaletteStore = createWithEqualityFn<CommandPaletteStore>()(
  devtools(
    (set, get) => ({
      isOpen: false,
      providersByScope: new Map(),
      recentlyUsed: loadRecentlyUsed(),

      openPalette: () => set({ isOpen: true }),
      closePalette: () => set({ isOpen: false }),
      togglePalette: () => set((state) => ({ isOpen: !state.isOpen })),

      setItemsProvider: (scope, provider) => {
        const providersByScope = new Map(get().providersByScope);
        providersByScope.delete(scope);
        providersByScope.set(scope, provider);
        set({ providersByScope });
      },

      clearItems: (scope) => {
        if (!get().providersByScope.has(scope)) {
          return;
        }
        const providersByScope = new Map(get().providersByScope);
        providersByScope.delete(scope);
        set({ providersByScope });
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
