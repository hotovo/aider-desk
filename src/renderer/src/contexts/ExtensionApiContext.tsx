import { ExtensionDisplayAPI } from '@common/api';
import { createContext, ReactNode, useContext } from 'react';

import { useApi } from '@/contexts/ApiContext';

const ExtensionApiContext = createContext<ExtensionDisplayAPI | undefined>(undefined);

type Props = {
  api: ExtensionDisplayAPI;
  children: ReactNode;
};

export const ExtensionApiProvider = ({ api, children }: Props) => {
  return <ExtensionApiContext.Provider value={api}>{children}</ExtensionApiContext.Provider>;
};

export const useExtensionApi = (): ExtensionDisplayAPI => {
  const extensionApi = useContext(ExtensionApiContext);
  const applicationApi = useApi();
  const api = extensionApi ?? applicationApi;
  if (!api) {
    throw new Error('useExtensionApi must be used within an ExtensionApiProvider or ApiProvider');
  }
  return api;
};
