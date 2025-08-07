import { ElementType, useRef, useState } from 'react';
import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { Mode } from '@common/types';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';

type ModeConfig = {
  icon: ElementType;
  labelKey: string;
  tooltipKey: string;
};

const MODE_CONFIG: Record<Mode, ModeConfig> = {
  code: {
    icon: CgTerminal,
    labelKey: 'mode.code',
    tooltipKey: 'modeTooltip.code',
  },
  agent: {
    icon: RiRobot2Line,
    labelKey: 'mode.agent',
    tooltipKey: 'modeTooltip.agent',
  },
  ask: {
    icon: FaRegQuestionCircle,
    labelKey: 'mode.ask',
    tooltipKey: 'modeTooltip.ask',
  },
  architect: {
    icon: GoProjectRoadmap,
    labelKey: 'mode.architect',
    tooltipKey: 'modeTooltip.architect',
  },
  context: {
    icon: AiOutlineFileSearch,
    labelKey: 'mode.context',
    tooltipKey: 'modeTooltip.context',
  },
};

const MODES_ORDER: Mode[] = ['code', 'agent', 'ask', 'architect', 'context'];

type Props = {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
};

export const ModeSelector = ({ mode, onModeChange }: Props) => {
  const { t } = useTranslation();
  const [modeSelectorVisible, setModeSelectorVisible] = useState(false);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  useClickOutside(modeSelectorRef, () => setModeSelectorVisible(false));

  const toggleModeSelectorVisible = () => setModeSelectorVisible((prev) => !prev);

  const handleModeChange = (newMode: Mode) => {
    onModeChange(newMode);
    setModeSelectorVisible(false);
  };

  const { icon: CurrentModeIcon, labelKey: currentModeLabelKey } = MODE_CONFIG[mode];

  return (
    <div className="relative flex items-center gap-1.5" ref={modeSelectorRef}>
      <button
        onClick={toggleModeSelectorVisible}
        className="flex items-center gap-1 px-2 py-1 bg-bg-secondary text-text-tertiary hover:bg-bg-secondaryLight hover:text-text-primary focus:outline-none transition-colors duration-200 text-xs border-border-default border rounded-md"
      >
        <CurrentModeIcon className="w-4 h-4" />
        <span className="mb-[-2px] ml-1 text-2xs">{t(currentModeLabelKey)}</span>
        {modeSelectorVisible ? <MdKeyboardArrowUp className="w-4 h-4 ml-0.5" /> : <MdKeyboardArrowDown className="w-4 h-4 ml-0.5" />}
      </button>

      {modeSelectorVisible && (
        <div className="absolute bottom-full mb-1 bg-bg-primaryLight border border-border-defaultDark rounded-md shadow-lg z-10 min-w-[150px]">
          {MODES_ORDER.map((value) => {
            const { icon: Icon, labelKey } = MODE_CONFIG[value];
            return (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                className={`w-full px-3 py-1.5 text-left hover:bg-bg-tertiary transition-colors duration-200 text-xs flex items-center gap-2
                ${value === mode ? 'text-text-primary font-semibold bg-neutral-750' : 'text-text-tertiary'}`}
              >
                <Icon className="w-4 h-4" />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
