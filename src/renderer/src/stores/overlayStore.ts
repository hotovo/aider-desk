import { devtools } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

type OverlayStore = {
  openOverlays: Set<string>;
  focusRequest: number;

  openOverlay: (id: string) => void;
  closeOverlay: (id: string) => void;
};

export const useOverlayStore = createWithEqualityFn<OverlayStore>()(
  devtools(
    (set, get) => ({
      openOverlays: new Set<string>(),
      focusRequest: 0,

      openOverlay: (id) => {
        const openOverlays = new Set(get().openOverlays);
        openOverlays.add(id);
        set({ openOverlays });
      },

      closeOverlay: (id) => {
        const openOverlays = new Set(get().openOverlays);
        if (!openOverlays.delete(id)) {
          return;
        }
        if (openOverlays.size === 0) {
          set({ openOverlays, focusRequest: get().focusRequest + 1 });
        } else {
          set({ openOverlays });
        }
      },
    }),
    { name: 'OverlayStore', enabled: import.meta.env.DEV },
  ),
);
