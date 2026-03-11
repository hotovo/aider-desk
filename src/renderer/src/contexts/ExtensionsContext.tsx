import { createContext, ReactNode, useContext, useMemo } from 'react';
import { UIComponentProps } from '@common/extensions';
import { TaskData } from '@common/types';

import { useActiveAgentProfile } from '@/utils/agents';

type ExtensionsContextValue = {
  projectDir: string;
};

const ExtensionsContext = createContext<ExtensionsContextValue | undefined>(undefined);

type Props = {
  projectDir: string;
  children: ReactNode;
};

export const ExtensionsProvider = ({ projectDir, children }: Props) => {
  const value = useMemo(() => ({ projectDir }), [projectDir]);

  return <ExtensionsContext.Provider value={value}>{children}</ExtensionsContext.Provider>;
};

const useExtensionsContext = (): ExtensionsContextValue => {
  const context = useContext(ExtensionsContext);
  if (!context) {
    throw new Error('useExtensions must be used within an ExtensionsProvider');
  }
  return context;
};

type ExtensionsHookResult = {
  componentProps: UIComponentProps;
};

export const useExtensions = (task: TaskData): ExtensionsHookResult => {
  const { projectDir } = useExtensionsContext();
  const agentProfile = useActiveAgentProfile(task, projectDir);
  const mode = task.currentMode || 'agent';

  const componentProps = useMemo<UIComponentProps>(
    () => ({
      projectDir,
      task,
      agentProfile,
      mode,
    }),
    [projectDir, task, agentProfile, mode],
  );

  return { componentProps };
};
