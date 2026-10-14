import { useEffect, useState } from 'react';

import type { ModeDefinition } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

export const useCustomModes = (baseDir?: string) => {
  const [customModes, setCustomModes] = useState<ModeDefinition[]>([]);
  const api = useApi();

  useEffect(() => {
    let cancelled = false;
    api.getCustomModes(baseDir).then((modes) => {
      if (!cancelled) {
        setCustomModes((prev) => (prev.length === 0 && modes.length === 0 ? prev : modes));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [baseDir, api]);

  return customModes;
};
