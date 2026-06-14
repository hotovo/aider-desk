import { useMemo } from 'react';

import { useSettingsStore } from '@/stores/settingsStore';
import { getHotkeys } from '@/utils/hotkeys';

export const useConfiguredHotkeys = () => {
  const hotkeyConfig = useSettingsStore((state) => state.settings?.hotkeyConfig);

  return useMemo(() => {
    return getHotkeys(hotkeyConfig);
  }, [hotkeyConfig]);
};
