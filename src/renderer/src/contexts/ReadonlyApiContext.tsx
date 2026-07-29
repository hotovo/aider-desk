import { ApplicationAPI } from '@common/api';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';

import { ReadonlyBrowserApi } from '@/api/readonly-browser-api';
import { ExtensionApiProvider } from '@/contexts/ExtensionApiContext';
import { ApiContext, ReadonlyViewContext } from '@/contexts/ApiContext';

const ReadonlyApiContext = createContext<ReadonlyBrowserApi | undefined>(undefined);

type Props = {
  projectDir: string;
  children: ReactNode;
};

export const ReadonlyApiProvider = ({ projectDir, children }: Props) => {
  const api = useMemo(() => new ReadonlyBrowserApi(projectDir), [projectDir]);
  const applicationApi = useMemo(
    () =>
      new Proxy(api, {
        get: (target, property) => {
          if (property === 'writeToClipboard') {
            return (text: string) => navigator.clipboard.writeText(text);
          }
          const value: unknown = Reflect.get(target, property, target);
          if (typeof value === 'function') {
            return value.bind(target);
          }
          if (value !== undefined) {
            return value;
          }
          return async () => {
            throw new Error('READ_ONLY_MODE');
          };
        },
      }) as unknown as ApplicationAPI,
    [api],
  );

  useEffect(() => {
    return () => api.destroy();
  }, [api]);

  return (
    <ReadonlyApiContext.Provider value={api}>
      <ApiContext.Provider value={applicationApi}>
        <ReadonlyViewContext.Provider value={true}>
          <ExtensionApiProvider api={api}>{children}</ExtensionApiProvider>
        </ReadonlyViewContext.Provider>
      </ApiContext.Provider>
    </ReadonlyApiContext.Provider>
  );
};

export const useReadonlyApi = (): ReadonlyBrowserApi => {
  const api = useContext(ReadonlyApiContext);
  if (!api) {
    throw new Error('useReadonlyApi must be used within a ReadonlyApiProvider');
  }
  return api;
};
