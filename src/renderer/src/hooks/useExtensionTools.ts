import { useEffect } from 'react';
import { ExtensionToolInfo } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useExtensionToolsInfo, useExtensionToolsStore } from '@/stores/extensionToolsStore';

export const useExtensionTools = (projectDir?: string): ExtensionToolInfo[] => {
  const api = useApi();
  const toolsInfo = useExtensionToolsInfo(projectDir);
  const loadToolsInfo = useExtensionToolsStore((state) => state.loadToolsInfo);
  const refreshAllToolsInfo = useExtensionToolsStore((state) => state.refreshAllToolsInfo);

  useEffect(() => {
    void loadToolsInfo(api, projectDir);
  }, [loadToolsInfo, api, projectDir]);

  useEffect(
    () =>
      api.addExtensionsUpdatedListener(() => {
        void refreshAllToolsInfo(api);
      }),
    [api, refreshAllToolsInfo],
  );

  return toolsInfo;
};
