import { useShallow } from 'zustand/react/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { devtools } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type TerminalTab = {
  id: string;
  ptyId: string | null;
};

const EMPTY_TABS: TerminalTab[] = [];

export const getSessionKey = (baseDir: string, taskId: string): string => `${baseDir}:${taskId}`;

interface TerminalState {
  tabsMap: Map<string, TerminalTab[]>;
  activeTabMap: Map<string, string | null>;
  visibleMap: Map<string, boolean>;
}

interface TerminalActions {
  addTab: (sessionKey: string) => string;
  removeTab: (sessionKey: string, tabId: string) => void;
  setActiveTab: (sessionKey: string, tabId: string) => void;
  setVisible: (sessionKey: string, visible: boolean) => void;
  setTabPtyId: (sessionKey: string, tabId: string, ptyId: string | null) => void;
  handlePtyExit: (ptyId: string) => void;
}

type TerminalStore = TerminalState & TerminalActions;

const DEVTOOLS_OPTIONS = {
  name: 'TerminalStore',
  enabled: import.meta.env.DEV,
  serialize: {
    options: {
      map: true,
      set: true,
    },
  },
};

export const useTerminalStore = createWithEqualityFn<TerminalStore>()(
  devtools(
    (set, get) => ({
      tabsMap: new Map(),
      activeTabMap: new Map(),
      visibleMap: new Map(),

      addTab: (sessionKey) => {
        const tabId = uuidv4();

        set((state) => {
          const newTabsMap = new Map(state.tabsMap);
          newTabsMap.set(sessionKey, [...(state.tabsMap.get(sessionKey) ?? []), { id: tabId, ptyId: null }]);
          const newActiveTabMap = new Map(state.activeTabMap);
          newActiveTabMap.set(sessionKey, tabId);
          return { tabsMap: newTabsMap, activeTabMap: newActiveTabMap };
        });

        return tabId;
      },

      removeTab: (sessionKey, tabId) => {
        set((state) => {
          const tabs = state.tabsMap.get(sessionKey) ?? [];
          const newTabs = tabs.filter((tab) => tab.id !== tabId);

          const newTabsMap = new Map(state.tabsMap);
          newTabsMap.set(sessionKey, newTabs);

          const newActiveTabMap = new Map(state.activeTabMap);
          if (state.activeTabMap.get(sessionKey) === tabId) {
            newActiveTabMap.set(sessionKey, newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
          }

          return { tabsMap: newTabsMap, activeTabMap: newActiveTabMap };
        });
      },

      setActiveTab: (sessionKey, tabId) => {
        set((state) => {
          const newActiveTabMap = new Map(state.activeTabMap);
          newActiveTabMap.set(sessionKey, tabId);
          return { activeTabMap: newActiveTabMap };
        });
      },

      setVisible: (sessionKey, visible) => {
        set((state) => {
          const newVisibleMap = new Map(state.visibleMap);
          newVisibleMap.set(sessionKey, visible);
          return { visibleMap: newVisibleMap };
        });
      },

      setTabPtyId: (sessionKey, tabId, ptyId) => {
        set((state) => {
          const tabs = state.tabsMap.get(sessionKey);
          if (!tabs) {
            return state;
          }

          const newTabs = tabs.map((tab) => (tab.id === tabId ? { ...tab, ptyId } : tab));
          const newTabsMap = new Map(state.tabsMap);
          newTabsMap.set(sessionKey, newTabs);
          return { tabsMap: newTabsMap };
        });
      },

      handlePtyExit: (ptyId) => {
        const state = get();

        for (const [sessionKey, tabs] of state.tabsMap.entries()) {
          const tab = tabs.find((candidate) => candidate.ptyId === ptyId);
          if (tab) {
            get().setTabPtyId(sessionKey, tab.id, null);
          }
        }
      },
    }),
    DEVTOOLS_OPTIONS,
  ),
  shallow,
);

// Module-level action functions (no hook subscription required)
export const addTerminalTab = (sessionKey: string) => useTerminalStore.getState().addTab(sessionKey);

export const removeTerminalTab = (sessionKey: string, tabId: string) => useTerminalStore.getState().removeTab(sessionKey, tabId);

export const setActiveTerminalTab = (sessionKey: string, tabId: string) => useTerminalStore.getState().setActiveTab(sessionKey, tabId);

export const setTerminalVisible = (sessionKey: string, visible: boolean) => useTerminalStore.getState().setVisible(sessionKey, visible);

export const toggleTerminalVisible = (sessionKey: string) =>
  useTerminalStore.getState().setVisible(sessionKey, !useTerminalStore.getState().visibleMap.get(sessionKey));

export const setTabPtyId = (sessionKey: string, tabId: string, ptyId: string | null) => useTerminalStore.getState().setTabPtyId(sessionKey, tabId, ptyId);

export const handlePtyExit = (ptyId: string) => useTerminalStore.getState().handlePtyExit(ptyId);

// Selector hooks for optimized re-renders
export const useTerminalTabs = (sessionKey: string): TerminalTab[] => useTerminalStore(useShallow((state) => state.tabsMap.get(sessionKey) ?? EMPTY_TABS));

export const useActiveTerminalTabId = (sessionKey: string): string | null => useTerminalStore((state) => state.activeTabMap.get(sessionKey) ?? null);

export const useTerminalVisible = (sessionKey: string): boolean => useTerminalStore((state) => state.visibleMap.get(sessionKey) ?? false);
