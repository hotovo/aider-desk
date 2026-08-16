import { devtools } from 'zustand/middleware';
import { create } from 'zustand';

export type SettingsPageInfo = {
  pageId: string;
  options?: Record<string, unknown>;
};

type SettingsNavigationStore = {
  settingsPage: SettingsPageInfo | null;
  openSettingsPage: (pageId: string, options?: Record<string, unknown>) => void;
  closeSettings: () => void;
};

export const useSettingsNavigationStore = create<SettingsNavigationStore>()(
  devtools(
    (set) => ({
      settingsPage: null,
      openSettingsPage: (pageId, options) => set({ settingsPage: options ? { pageId, options } : { pageId } }),
      closeSettings: () => set({ settingsPage: null }),
    }),
    { name: 'SettingsNavigationStore', enabled: import.meta.env.DEV },
  ),
);

export const openSettingsPage = (pageId: string, options?: Record<string, unknown>) => {
  useSettingsNavigationStore.getState().openSettingsPage(pageId, options);
};

export const closeSettings = () => {
  useSettingsNavigationStore.getState().closeSettings();
};
