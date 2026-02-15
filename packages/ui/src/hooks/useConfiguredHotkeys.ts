import { useMemo } from 'react';

import { useSettings } from '@/contexts/SettingsContext';
import { getHotkeys } from '@/utils/hotkeys';

export const useConfiguredHotkeys = () => {
  const { settings } = useSettings();

  return useMemo(() => {
    return getHotkeys(settings?.hotkeyConfig);
  }, [settings?.hotkeyConfig]);
};
