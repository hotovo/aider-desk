import { useEffect, useState } from 'react';

import type { ModeDefinition } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

export const useCustomModes = (baseDir: string) => {
  const [customModes, setCustomModes] = useState<ModeDefinition[]>([]);
  const api = useApi();

  useEffect(() => {
    api.getCustomModes(baseDir).then((modes) => {
      setCustomModes(modes);
    });
  }, [baseDir, api]);

  return customModes;
};
