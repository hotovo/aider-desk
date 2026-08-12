import { useHotkeys } from 'react-hotkeys-hook';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

export const useCommandPaletteHotkeys = () => {
  const { DIALOG_HOTKEYS } = useConfiguredHotkeys();
  const togglePalette = useCommandPaletteStore((state) => state.togglePalette);

  useHotkeys(
    DIALOG_HOTKEYS.COMMAND_PALETTE,
    (event) => {
      event.preventDefault();
      togglePalette();
    },
    { scopes: 'home', enableOnFormTags: true, enableOnContentEditable: true },
    [DIALOG_HOTKEYS.COMMAND_PALETTE, togglePalette],
  );
};
