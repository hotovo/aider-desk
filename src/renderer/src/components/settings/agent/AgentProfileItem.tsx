import { AgentProfile } from '@common/types';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { MdVpnKey } from 'react-icons/md';

type Props = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
  isDefault: boolean;
};

export const AgentProfileItem = ({ profile, isSelected, onClick, isDefault }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      onClick={() => onClick(profile.id)}
      className={clsx(
        'px-2 py-1.5 rounded-sm text-sm transition-colors cursor-pointer flex items-center justify-between',
        isSelected ? 'bg-bg-secondary-light text-text-primary' : 'text-text-primary hover:bg-bg-secondary-light',
      )}
    >
      <div className="flex items-center">
        {profile.subagent.enabled && (
          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: profile.subagent.color }} />
        )}
        <span className="flex-1">{profile.name}</span>
      </div>
      {isDefault && (
        <div className="flex items-center text-xs text-text-muted-light">
          <MdVpnKey className="mr-1" />
          <span>{t('common.default')}</span>
        </div>
      )}
    </div>
  );
};