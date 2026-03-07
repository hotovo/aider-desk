import { Command } from '@common/types';
import { useEffect, useState } from 'react';

import { useApi } from '@/contexts/ApiContext';

export const useCommands = (baseDir: string) => {
  const [customCommands, setCustomCommands] = useState<Command[]>([]);
  const [extensionCommands, setExtensionCommands] = useState<Command[]>([]);
  const api = useApi();

  useEffect(() => {
    // Load initial commands
    api.getCommands(baseDir).then((data) => {
      setCustomCommands(data.customCommands);
      setExtensionCommands(data.extensionCommands);
    });

    // Listen for commands updates
    const removeListener = api.addCommandsUpdatedListener(baseDir, (data) => {
      setCustomCommands(data.customCommands);
      setExtensionCommands(data.extensionCommands);
    });

    return () => {
      removeListener();
    };
  }, [baseDir, api]);

  return [customCommands, extensionCommands] as const;
};
