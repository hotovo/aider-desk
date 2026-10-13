import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mode } from '@common/types';

import { useModes } from '@/hooks/useModes';
import { PaletteItem, PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';

export const MODE_SWITCH_PALETTE_SCOPE = 'mode-switch';

type UseModeSwitchCommandsOptions = {
  baseDir: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export const useModeSwitchCommands = ({ baseDir, mode, onModeChange }: UseModeSwitchCommandsOptions) => {
  const { t } = useTranslation();
  const modeItems = useModes(baseDir);
  const replaceItems = useCommandPaletteStore((state) => state.replaceItems);
  const clearItems = useCommandPaletteStore((state) => state.clearItems);

  const items = useMemo<PaletteItem[]>(
    () =>
      modeItems
        .filter((item) => item.value !== mode)
        .map(
          (item): PaletteItem => ({
            id: `mode-switch.${item.value}`,
            label: t('commandPalette.switchToMode', { mode: t(item.labelKey) }),
            description: item.tooltipKey ? t(item.tooltipKey) : undefined,
            type: PaletteItemType.Action,
            action: () => onModeChange(item.value),
          }),
        ),
    [modeItems, mode, onModeChange, t],
  );

  useEffect(() => {
    replaceItems(MODE_SWITCH_PALETTE_SCOPE, items);
    return () => clearItems(MODE_SWITCH_PALETTE_SCOPE);
  }, [items, replaceItems, clearItems]);
};
