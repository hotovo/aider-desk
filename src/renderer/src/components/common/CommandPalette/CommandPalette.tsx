import { CommandPaletteContent } from './CommandPaletteContent';

import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

export const CommandPalette = () => {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);

  return isOpen ? <CommandPaletteContent /> : null;
};
