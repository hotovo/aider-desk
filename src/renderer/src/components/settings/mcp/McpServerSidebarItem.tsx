import { BiPencil, BiRefresh, BiTrash } from 'react-icons/bi';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { VerticalDotsMenu, type MenuOption } from '@/components/common/VerticalDotsMenu';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  serverName: string;
  isSelected: boolean;
  error?: string | null;
  onClick: (name: string) => void;
  onRefresh: (name: string) => void;
  onEdit: (name: string) => void;
  onRemove: (name: string) => void;
};

export const McpServerSidebarItem = ({ serverName, isSelected, error, onClick, onRefresh, onEdit, onRemove }: Props) => {
  const { t } = useTranslation();

  const menuOptions: MenuOption[] = [
    {
      label: t('mcp.reload'),
      action: () => onRefresh(serverName),
      icon: <BiRefresh className="w-4 h-4" />,
    },
    {
      label: t('common.edit'),
      action: () => onEdit(serverName),
      icon: <BiPencil className="w-4 h-4" />,
    },
    {
      label: t('common.remove'),
      action: () => onRemove(serverName),
      icon: <BiTrash className="w-4 h-4" />,
    },
  ];

  return (
    <div className="group">
      <div
        onClick={() => onClick(serverName)}
        className={clsx(
          'px-2 py-1 rounded-sm text-sm transition-colors cursor-pointer flex items-center justify-between',
          isSelected ? 'bg-bg-secondary-light text-text-primary' : 'text-text-primary hover:bg-bg-secondary-light',
        )}
      >
        <span className="flex-1 truncate">{serverName}</span>
        {error && (
          <Tooltip content={error} maxWidth={400}>
            <div className="w-2.5 h-2.5 rounded-full bg-error flex-shrink-0 ml-2" />
          </Tooltip>
        )}
        <VerticalDotsMenu options={menuOptions} className="ml-1" />
      </div>
    </div>
  );
};
