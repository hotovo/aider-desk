import { createContext, ReactNode, useContext, useMemo } from 'react';
import { UIComponentProps, UIComponents } from '@common/extensions';
import { AgentProfile, TaskData, Message } from '@common/types';

import { Button } from '@/components/common/Button';
import { Checkbox } from '@/components/common/Checkbox';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { TextArea } from '@/components/common/TextArea';
import { IconButton } from '@/components/common/IconButton';
import { RadioButton } from '@/components/common/RadioButton';
import { MultiSelect } from '@/components/common/MultiSelect';
import { Slider } from '@/components/common/Slider';
import { DatePicker } from '@/components/common/DatePicker';
import { Chip } from '@/components/common/Chip';
import { ModelSelectorWrapper } from '@/components/common/ModelSelectorWrapper';
import { useModelProviders } from '@/contexts/ModelProviderContext';

type ExtensionsContextValue = {
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  messages?: Message[];
  message?: Message;
};

const ExtensionsContext = createContext<ExtensionsContextValue | undefined>(undefined);

type Props = ExtensionsContextValue & {
  children: ReactNode;
};

export const ExtensionsProvider = ({ projectDir, task, agentProfile, messages, message, children }: Props) => {
  const value = useMemo(
    () => ({
      projectDir,
      task,
      agentProfile,
      messages,
      message,
    }),
    [agentProfile, message, messages, projectDir, task],
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

const uiComponents: UIComponents = {
  Button,
  Checkbox,
  Input,
  Select,
  TextArea,
  IconButton,
  RadioButton,
  MultiSelect,
  Slider,
  DatePicker,
  Chip,
  ModelSelector: ModelSelectorWrapper,
};

type ExtensionsHookResult = {
  componentProps: UIComponentProps;
};

export const useExtensions = (): ExtensionsHookResult => {
  const { projectDir, task, agentProfile } = useExtensionsContext();
  const { models, providers } = useModelProviders();

  const componentProps = useMemo<UIComponentProps>(
    () => ({
      projectDir,
      task,
      agentProfile,
      models,
      providers,
      ui: uiComponents,
    }),
    [projectDir, task, agentProfile, models, providers],
  );

  return { componentProps };
};
