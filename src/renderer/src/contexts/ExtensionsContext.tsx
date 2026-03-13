import { createContext, ReactNode, useContext, useMemo } from 'react';
import { UIComponentProps } from '@common/extensions';
import { AgentProfile, TaskData } from '@common/types';

type ExtensionsContextValue = {
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
};

const ExtensionsContext = createContext<ExtensionsContextValue | undefined>(undefined);

type Props = ExtensionsContextValue & {
  children: ReactNode;
};

export const ExtensionsProvider = ({ projectDir, task, agentProfile, children }: Props) => {
  const value = useMemo(
    () => ({
      projectDir,
      task,
      agentProfile,
    }),
    [agentProfile, projectDir, task],
  );

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

export const useExtensions = (): ExtensionsHookResult => {
  const { projectDir, task, agentProfile } = useExtensionsContext();

  const componentProps = useMemo<UIComponentProps>(
    () => ({
      projectDir,
      task,
      agentProfile,
    }),
    [projectDir, task, agentProfile],
  );

  return { componentProps };
};
