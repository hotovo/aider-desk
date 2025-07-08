import { CustomCommand } from '@common/types';
import { useEffect, useState } from 'react';

export const useCustomCommands = (baseDir: string) => {
  const [customCommands, setCustomCommands] = useState<CustomCommand[]>([]);

  useEffect(() => {
    // Load initial commands
    window.api.getCustomCommands(baseDir).then(setCustomCommands);

    // Listen for commands updates
    const listenerId = window.api.addCustomCommandsUpdatedListener(baseDir, (_, data) => {
      setCustomCommands(data.commands);
    });

    return () => {
      window.api.removeCustomCommandsUpdatedListener(listenerId);
    };
  }, [baseDir]);

  return customCommands;
};
