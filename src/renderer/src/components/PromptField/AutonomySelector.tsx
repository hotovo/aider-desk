import { memo, startTransition, useCallback, useOptimistic } from 'react';
import { useTranslation } from 'react-i18next';
import { FaRegCompass } from 'react-icons/fa';
import { LuHand, LuZap } from 'react-icons/lu';
import { VscLock, VscUnlock } from 'react-icons/vsc';
import { AutonomyMode } from '@common/types';
import { clsx } from 'clsx';

import { IconButton } from '@/components/common/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  mode: AutonomyMode;
  locked: boolean;
  onChange?: (mode: AutonomyMode) => void;
  onLockChange?: (locked: boolean) => void;
};

const MODE_CONFIG: Record<AutonomyMode, { icon: typeof LuHand; labelKey: string; tooltipKey: string }> = {
  [AutonomyMode.Manual]: {
    icon: LuHand,
    labelKey: 'promptField.autonomyManual',
    tooltipKey: 'promptField.autonomyManualTooltip',
  },
  [AutonomyMode.Guided]: {
    icon: FaRegCompass,
    labelKey: 'promptField.autonomyGuided',
    tooltipKey: 'promptField.autonomyGuidedTooltip',
  },
  [AutonomyMode.Autonomous]: {
    icon: LuZap,
    labelKey: 'promptField.autonomyAutonomous',
    tooltipKey: 'promptField.autonomyAutonomousTooltip',
  },
};

const MODE_ORDER: AutonomyMode[] = [AutonomyMode.Manual, AutonomyMode.Guided, AutonomyMode.Autonomous];

export const AutonomySelector = memo(({ mode, locked, onChange, onLockChange }: Props) => {
  const { t } = useTranslation();
  const [optimisticMode, setOptimisticMode] = useOptimistic(mode);

  const handleModeClick = useCallback(
    (newMode: AutonomyMode) => {
      startTransition(() => {
        setOptimisticMode(newMode);
        onChange?.(newMode);
      });
    },
    [onChange, setOptimisticMode],
  );

  const handleLockClick = useCallback(() => {
    onLockChange?.(!locked);
  }, [locked, onLockChange]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center bg-bg-secondary border border-border-default rounded-md h-[26px]">
        {MODE_ORDER.map((modeKey) => {
          const config = MODE_CONFIG[modeKey];
          const Icon = config.icon;
          const isActive = optimisticMode === modeKey;

          return (
            <Tooltip key={modeKey} content={t(config.tooltipKey)} delayDuration={500}>
              <button
                onClick={() => handleModeClick(modeKey)}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1 transition-colors duration-150 border border-transparent',
                  isActive
                    ? 'bg-bg-tertiary-strong text-text-primary border-border-default-dark'
                    : 'text-text-muted hover:text-text-tertiary hover:bg-bg-tertiary',
                  modeKey === MODE_ORDER[0] && 'rounded-l-md',
                  modeKey === MODE_ORDER[MODE_ORDER.length - 1] && 'rounded-r-md',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-2xs">{t(config.labelKey)}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>
      <IconButton
        icon={locked ? <VscLock className="w-3.5 h-3.5" /> : <VscUnlock className="w-3.5 h-3.5" />}
        onClick={handleLockClick}
        tooltip={t('promptField.autonomyLockTooltip')}
      />
    </div>
  );
});

AutonomySelector.displayName = 'AutonomySelector';
