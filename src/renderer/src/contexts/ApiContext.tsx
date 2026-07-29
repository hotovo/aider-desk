import { createContext, useMemo, ReactNode, useContext } from 'react';
import { ApplicationAPI } from '@common/api';
import { HotkeysProvider } from 'react-hotkeys-hook';

import { BrowserApi } from '@/api/browser-api';

export const ApiContext = createContext<ApplicationAPI | undefined>(undefined);
export const ReadonlyViewContext = createContext(false);

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const api = useMemo<ApplicationAPI>(() => {
    if (window.api) {
      return window.api;
    }
    return new BrowserApi();
  }, []);

  return (
    <ApiContext.Provider value={api}>
      <HotkeysProvider initiallyActiveScopes={['home', 'task', 'dialog', 'modal']}>{children}</HotkeysProvider>
    </ApiContext.Provider>
  );
};

export const useOptionalApi = (): ApplicationAPI | undefined => useContext(ApiContext);
export const useIsReadonlyView = (): boolean => useContext(ReadonlyViewContext);

export const useApi = (): ApplicationAPI => {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return api;
};
