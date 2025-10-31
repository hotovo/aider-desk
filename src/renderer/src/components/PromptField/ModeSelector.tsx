import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';
import { Mode } from '@common/types';

import { ItemSelector, ItemConfig } from '@/components/common/ItemSelector';

const MODE_ITEMS: ItemConfig<Mode>[] = [
  {
    value: 'code',
    icon: CgTerminal,
    labelKey: 'mode.code',
    tooltipKey: 'modeTooltip.code',
  },
  {
    value: 'agent',
    icon: RiRobot2Line,
    labelKey: 'mode.agent',
    tooltipKey: 'modeTooltip.agent',
  },
  {
    value: 'ask',
    icon: FaRegQuestionCircle,
    labelKey: 'mode.ask',
    tooltipKey: 'modeTooltip.ask',
  },
  {
    value: 'architect',
    icon: GoProjectRoadmap,
    labelKey: 'mode.architect',
    tooltipKey: 'modeTooltip.architect',
  },
  {
    value: 'context',
    icon: AiOutlineFileSearch,
    labelKey: 'mode.context',
    tooltipKey: 'modeTooltip.context',
  },
];

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export const ModeSelector = ({ mode, onModeChange }: Props) => {
  return <ItemSelector items={MODE_ITEMS} selectedValue={mode} onChange={onModeChange} />;
};
