import { AgentProfile } from '@common/types';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

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

  return (
    <div
      className={clsx(
        'w-full rounded-sm justify-start truncate text-left h-auto py-1 px-2 text-sm cursor-pointer',
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
      {profile.name}&nbsp;
      {isDefault && <span className="ml-1.5 text-xs text-text-muted-light">({t('common.default')})</span>}
    </div>
  );
};
