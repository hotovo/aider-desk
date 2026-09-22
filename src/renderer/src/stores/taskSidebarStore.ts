import { devtools } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

type TaskSidebarStore = {
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
};

export const useTaskSidebarStore = createWithEqualityFn<TaskSidebarStore>()(
  devtools(
    (set) => ({
      showArchived: false,
      setShowArchived: (show) => set({ showArchived: show }),
    }),
    { name: 'TaskSidebarStore', enabled: import.meta.env.DEV },
  ),
);
