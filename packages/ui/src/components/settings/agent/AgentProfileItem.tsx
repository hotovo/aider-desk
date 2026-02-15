import { AgentProfile } from '@aider-desk/common/types';
import { BiCopy, BiCut, BiTrash } from 'react-icons/bi';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { VerticalDotsMenu, type MenuOption } from '@/components/common/VerticalDotsMenu';

type Props = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
  onCopy?: (profile: AgentProfile) => void;
  onCut?: (profile: AgentProfile) => void;
  onDelete?: (profile: AgentProfile) => void;
  isCut?: boolean;
  isDefaultProfile?: boolean;
};

export const AgentProfileItem = ({ profile, isSelected, onClick, onCopy, onCut, onDelete, isCut, isDefaultProfile }: Props) => {
  const { t } = useTranslation();

  const menuOptions: MenuOption[] = [
    {
      label: t('settings.agent.copyProfile'),
      action: () => onCopy?.(profile),
      icon: <BiCopy className="w-4 h-4" />,
    },
    ...(isDefaultProfile
      ? []
      : [
          {
            label: t('settings.agent.cutProfile'),
            action: () => onCut?.(profile),
            icon: <BiCut className="w-4 h-4" />,
          },
          {
            label: t('settings.agent.deleteProfile'),
            action: () => onDelete?.(profile),
            icon: <BiTrash className="w-4 h-4" />,
          },
        ]),
  ];

  return (
    <div className="group">
      <div
        onClick={() => onClick(profile.id)}
        className={clsx(
          'px-2 py-1 rounded-sm text-sm transition-colors cursor-pointer flex items-center justify-between',
          isSelected
            ? 'bg-bg-secondary-light text-text-primary'
            : isCut
              ? 'text-text-muted hover:bg-bg-secondary-light'
              : 'text-text-primary hover:bg-bg-secondary-light',
        )}
      >
        <div className="flex items-center">
          {profile.subagent.enabled && <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: profile.subagent.color }} />}
          <span className="flex-1 text-sm">{profile.name}</span>
        </div>
        <VerticalDotsMenu options={menuOptions} />
      </div>
    </div>
  );
};
