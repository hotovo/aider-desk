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
        className="flex items-center gap-1 px-2 py-1 focus:outline-none transition-colors duration-200 text-xs border rounded-md"
        style={{
          backgroundColor: 'var(--theme-background-input)',
          color: 'var(--theme-foreground-secondary)',
          borderColor: 'var(--theme-border-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
          e.currentTarget.style.color = 'var(--theme-foreground-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
          e.currentTarget.style.color = 'var(--theme-foreground-secondary)';
        }}
      >
        <CurrentModeIcon className="w-4 h-4" />
        <span className="mb-[-2px] ml-1 text-2xs">{t(currentModeLabelKey)}</span>
        {modeSelectorVisible ? <MdKeyboardArrowUp className="w-4 h-4 ml-0.5" /> : <MdKeyboardArrowDown className="w-4 h-4 ml-0.5" />}
      </button>

      {modeSelectorVisible && (
        <div className="absolute bottom-full mb-1 rounded-md shadow-lg z-10 min-w-[150px]" style={{ backgroundColor: 'var(--theme-background-secondary)', borderColor: 'var(--theme-border-primary)', border: '1px solid' }}>
          {MODES_ORDER.map((value) => {
            const { icon: Icon, labelKey } = MODE_CONFIG[value];
            return (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                className="w-full px-3 py-1.5 text-left transition-colors duration-200 text-xs flex items-center gap-2"
                style={{
                  backgroundColor: value === mode ? 'var(--theme-background-tertiary)' : 'transparent',
                  color: value === mode ? 'var(--theme-foreground-primary)' : 'var(--theme-foreground-secondary)',
                  fontWeight: value === mode ? '600' : 'normal'
                }}
                onMouseEnter={(e) => {
                  if (value !== mode) {
                    e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== mode) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
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
