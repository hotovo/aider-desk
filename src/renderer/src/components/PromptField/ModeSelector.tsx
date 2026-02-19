import { memo } from 'react';
import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';
import { FiLayers } from 'react-icons/fi';
import { Mode } from '@common/types';

import { ItemSelector, ItemConfig } from '@/components/common/ItemSelector';

const MODE_ITEMS: ItemConfig<Mode>[] = [
  {
    value: 'agent',
    icon: RiRobot2Line,
    labelKey: 'mode.agent',
    tooltipKey: 'modeTooltip.agent',
  },
  {
    value: 'bmad',
    icon: FiLayers,
    labelKey: 'mode.bmad',
    tooltipKey: 'modeTooltip.bmad',
  },
  {
    value: 'code',
    icon: CgTerminal,
    labelKey: 'mode.code',
    tooltipKey: 'modeTooltip.code',
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

export const ModeSelector = memo(({ mode, onModeChange }: Props) => {
  return <ItemSelector items={MODE_ITEMS} selectedValue={mode} onChange={onModeChange} />;
});

ModeSelector.displayName = 'ModeSelector';
