import { ElementType, memo, useMemo } from 'react';
import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';
import { FiLayers } from 'react-icons/fi';
import { TbTargetArrow } from 'react-icons/tb';
import { Mode, ModeDefinition } from '@common/types';

import { ItemSelector, ItemConfig } from '@/components/common/ItemSelector';
import { useCustomModes } from '@/hooks/useCustomModes';

const ICON_MAP: Record<string, ElementType> = {
  RiRobot2Line,
  FiLayers,
  CgTerminal,
  FaRegQuestionCircle,
  GoProjectRoadmap,
  AiOutlineFileSearch,
  TbTargetArrow,
};

const BUILT_IN_MODES: ItemConfig<Mode>[] = [
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
  baseDir: string;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

const getIconComponent = (iconName?: string): ElementType => {
  if (!iconName) {
    return TbTargetArrow;
  }
  return ICON_MAP[iconName] || TbTargetArrow;
};

const customModeToItemConfig = (mode: ModeDefinition): ItemConfig<Mode> => ({
  value: mode.name,
  icon: getIconComponent(mode.icon),
  labelKey: mode.label,
  tooltipKey: mode.description,
});

export const ModeSelector = memo(({ baseDir, mode, onModeChange }: Props) => {
  const customModes = useCustomModes(baseDir);

  const modeItems = useMemo(() => {
    const customModeItems = customModes.map(customModeToItemConfig);
    return [...BUILT_IN_MODES, ...customModeItems];
  }, [customModes]);

  return <ItemSelector items={modeItems} selectedValue={mode} onChange={onModeChange} />;
});

ModeSelector.displayName = 'ModeSelector';
