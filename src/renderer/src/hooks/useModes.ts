import { ElementType, useMemo } from 'react';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { FiLayers } from 'react-icons/fi';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';
import { TbTargetArrow } from 'react-icons/tb';
import { Mode } from '@common/types';

import { useCustomModes } from '@/hooks/useCustomModes';
import { ItemConfig } from '@/components/common/ItemSelector';

export const MODE_ICONS: Record<string, ElementType> = {
  RiRobot2Line,
  FiLayers,
  CgTerminal,
  FaRegQuestionCircle,
  GoProjectRoadmap,
  AiOutlineFileSearch,
  TbTargetArrow,
};

export const BUILT_IN_MODES: ItemConfig<Mode>[] = [
  {
    value: 'agent',
    icon: RiRobot2Line,
    labelKey: 'mode.agent',
    tooltipKey: 'modeTooltip.agent',
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

const getIconComponent = (iconName?: string): ElementType => MODE_ICONS[iconName || ''] || TbTargetArrow;

export const useModes = (baseDir?: string): ItemConfig<Mode>[] => {
  const customModes = useCustomModes(baseDir);

  return useMemo(() => {
    const customModeItems = customModes.map((mode) => ({
      value: mode.name,
      icon: getIconComponent(mode.icon),
      labelKey: mode.label,
      tooltipKey: mode.description,
    }));
    return [...BUILT_IN_MODES, ...customModeItems] as ItemConfig<Mode>[];
  }, [customModes]);
};
