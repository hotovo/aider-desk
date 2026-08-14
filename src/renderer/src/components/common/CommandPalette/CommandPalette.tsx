import { CommandPaletteContent } from './CommandPaletteContent';

import { useOverlayRegistration } from '@/hooks/useOverlayFocusRestore';
import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

export const CommandPalette = () => {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);

  useOverlayRegistration('command-palette', isOpen);

  return isOpen ? <CommandPaletteContent /> : null;
};
