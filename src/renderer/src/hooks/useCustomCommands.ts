import { CustomCommand } from '@common/types';
import { useEffect, useState } from 'react';

import { useApi } from '@/contexts/ApiContext';

export const useCustomCommands = (baseDir: string) => {
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);
  const api = useApi();

  useEffect(() => {
    // Load initial commands
    api.getCustomCommands(baseDir).then(setCustomCommands);

    // Listen for commands updates
    const removeListener = api.addCustomCommandsUpdatedListener(baseDir, (data) => {
      setCustomCommands(data.commands);
    });

    return () => {
      removeListener();
    };
  }, [baseDir, api]);

  return customCommands;
};
