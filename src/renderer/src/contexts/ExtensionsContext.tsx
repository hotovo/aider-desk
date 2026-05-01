import { createContext, ReactNode, useContext, useMemo } from 'react';
import { UIComponentProps, UIComponents } from '@common/extensions';
import { AgentProfile, TaskData, Message } from '@common/types';
import * as FiIcons from 'react-icons/fi';
import * as FaIcons from 'react-icons/fa';
import * as MdIcons from 'react-icons/md';
import * as AiIcons from 'react-icons/ai';
import * as BiIcons from 'react-icons/bi';
import * as BsIcons from 'react-icons/bs';
import * as CgIcons from 'react-icons/cg';
import * as DiIcons from 'react-icons/di';
import * as FcIcons from 'react-icons/fc';
import * as GiIcons from 'react-icons/gi';
import * as GoIcons from 'react-icons/go';
import * as GrIcons from 'react-icons/gr';
import * as HiIcons from 'react-icons/hi';
import * as ImIcons from 'react-icons/im';
import * as IoIcons from 'react-icons/io';
import * as Io5Icons from 'react-icons/io5';
import * as RiIcons from 'react-icons/ri';
import * as SiIcons from 'react-icons/si';
import * as TbIcons from 'react-icons/tb';
import * as TiIcons from 'react-icons/ti';
import * as VscIcons from 'react-icons/vsc';
import * as WiIcons from 'react-icons/wi';

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
  Tooltip,
  ModelSelector: ModelSelectorWrapper,
  LoadingOverlay,
  ConfirmDialog,
};

const reactIcons = {
  Fi: FiIcons,
  Fa: FaIcons,
  Md: MdIcons,
  Ai: AiIcons,
  Bi: BiIcons,
  Bs: BsIcons,
  Cg: CgIcons,
  Di: DiIcons,
  Fc: FcIcons,
  Gi: GiIcons,
  Go: GoIcons,
  Gr: GrIcons,
  Hi: HiIcons,
  Im: ImIcons,
  Io: IoIcons,
  Io5: Io5Icons,
  Ri: RiIcons,
  Si: SiIcons,
  Tb: TbIcons,
  Ti: TiIcons,
  Vsc: VscIcons,
  Wi: WiIcons,
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
      icons: reactIcons,
    }),
    [projectDir, task, agentProfile, models, providers],
  );

  return { componentProps };
};
