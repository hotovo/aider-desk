import { AgentProfile } from '@common/types';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
  isDefault: boolean;
};

export const AgentProfileItem = ({ profile, isSelected, onClick, isDefault }: Props) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onClick(profile.id);
  };

  const tooltipId = `subagent-tooltip-${profile.id}`;

  return (
    <>
      <div
        className={clsx(
          'w-full rounded-sm justify-between items-center flex h-auto py-1 px-2 text-sm cursor-pointer',
          'transition-colors duration-200 ease-in-out',
          isSelected ? 'bg-bg-secondary-light text-text-primary' : 'hover:bg-bg-tertiary-strong text-text-tertiary',
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <div className="truncate">
          {profile.name}&nbsp;
          {isDefault && <span className="ml-1.5 text-xs text-text-muted-light">({t('common.default')})</span>}
        </div>
        {profile.subagent.enabled && (
          <div
            data-tooltip-id={tooltipId}
            className="w-3 h-3 rounded border border-border-default flex-shrink-0"
            style={{ backgroundColor: profile.subagent.color }}
          />
        )}
      </div>
      <StyledTooltip id={tooltipId} content={t(`settings.agent.subagent.${profile.subagent.invocationMode}`)} />
    </>
  );
};
