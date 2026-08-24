import { createContext, useContext } from 'react';

import { File } from '@/components/common/DiffViewer/utils';

type DiffContextValue = {
  language: string;
  fileStatus: File['type'];
};

const DiffContext = createContext<DiffContextValue | null>(null);

export const useDiffContext = () => {
  const context = useContext(DiffContext);
  if (!context) {
    throw new Error('useDiffContext must be used within a Diff component');
  }
  return context;
};

export const DiffContextProvider = DiffContext.Provider;
