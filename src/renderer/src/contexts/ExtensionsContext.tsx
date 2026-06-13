import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { UIComponentProps, UIComponents } from '@common/extensions';
import { AgentProfile, TaskData, Message } from '@common/types';

import { iconPackStubs, useReactIcons } from '@/utils/extension-icons';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ModelSelectorWrapper } from '@/components/common/ModelSelectorWrapper';
import { Tooltip } from '@/components/ui/Tooltip';
import { Chip } from '@/components/common/Chip';
import { DatePicker } from '@/components/common/DatePicker';
import { Slider } from '@/components/common/Slider';
import { MultiSelect } from '@/components/common/MultiSelect';
import { RadioButton } from '@/components/common/RadioButton';
import { IconButton } from '@/components/common/IconButton';
import { TextArea } from '@/components/common/TextArea';
import { Select } from '@/components/common/Select';
import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { Button } from '@/components/common/Button';
import { initExtensionLibraryLoader } from '@/utils/extension-library-loader';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';

type ExtensionsContextValue = {
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  messages?: Message[];
  message?: Message;
  activateTask?: (taskId: string) => void;
};

const EMPTY_LIBRARIES: Record<string, Record<string, unknown>> = {};

const ExtensionsContext = createContext<ExtensionsContextValue | undefined>(undefined);

type Props = ExtensionsContextValue & {
  children: ReactNode;
  activateTask?: (taskId: string) => void;
};

export const ExtensionsProvider = ({ projectDir, task, agentProfile, messages, message, activateTask, children }: Props) => {
  useEffect(() => {
    initExtensionLibraryLoader().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Error initializing extension library loader:', error);
    });
  }, []);

  const value = useMemo(
    () => ({
      projectDir,
      task,
      agentProfile,
      messages,
      message,
      activateTask,
    }),
    [agentProfile, message, messages, projectDir, task, activateTask],
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

export const uiComponents: UIComponents = {
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
  Tooltip,
  ModelSelector: ModelSelectorWrapper,
  LoadingOverlay,
  ConfirmDialog,
  ModalOverlayLayout,
};

export const reactIcons = iconPackStubs;

type ExtensionsHookResult = {
  componentProps: UIComponentProps;
};

export const useExtensions = (): ExtensionsHookResult => {
  const { projectDir, task, agentProfile, activateTask } = useExtensionsContext();
  const { models, providers } = useModelProviders();
  const icons = useReactIcons();
  const componentProps = useMemo<UIComponentProps>(
    () => ({
      projectDir,
      task,
      agentProfile,
      models,
      providers,
      ui: uiComponents,
      icons: icons ?? reactIcons,
      libraries: EMPTY_LIBRARIES,
      activateTask,
    }),
    [projectDir, task, agentProfile, models, providers, icons, activateTask],
  );

  return { componentProps };
};
