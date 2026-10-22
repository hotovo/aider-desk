import { useTranslation } from 'react-i18next';
import { RiAlertLine, RiProhibitedLine, RiRefreshLine } from 'react-icons/ri';
import { clsx } from 'clsx';
import { ToolRecoveryMode } from '@common/types';

import type { IconType } from 'react-icons';

import { RichSelect, RichSelectOption } from '@/components/common/RichSelect';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  value: ToolRecoveryMode;
  onChange: (value: ToolRecoveryMode) => void;
};

const MODE_CONFIG: Record<ToolRecoveryMode, { icon: IconType; color: string }> = {
  [ToolRecoveryMode.Forget]: { icon: RiProhibitedLine, color: 'text-text-muted' },
  [ToolRecoveryMode.Safe]: { icon: RiRefreshLine, color: 'text-success' },
  [ToolRecoveryMode.Notify]: { icon: RiAlertLine, color: 'text-warning' },
};

export const ToolRecoverySelect = ({ value, onChange }: Props) => {
  const { t } = useTranslation();

  const options: RichSelectOption[] = (Object.values(ToolRecoveryMode) as ToolRecoveryMode[]).map((mode) => {
    const { icon: Icon, color } = MODE_CONFIG[mode];
    return {
      value: mode,
      label: t('tool.recovery.' + mode),
      description: t('tool.recovery.descriptions.' + mode),
      icon: <Icon className={clsx('h-3.5 w-3.5', color)} />,
    };
  });

  const handleChange = (next: string) => {
    onChange(next as ToolRecoveryMode);
  };

  const renderTrigger = (selected: RichSelectOption | undefined, isOpen: boolean) => {
    const mode = (selected?.value as ToolRecoveryMode) ?? ToolRecoveryMode.Forget;
    const { icon: Icon, color } = MODE_CONFIG[mode];
    const tooltip = (
      <div className="space-y-1 text-left">
        <div className="font-semibold text-text-primary">{t('tool.recovery.label')}</div>
        <div className="text-text-secondary">{t('tool.recovery.description')}</div>
        <div className="mt-1 border-t border-border-default pt-1">
          <span className="font-medium text-text-primary">{t('tool.recovery.' + mode)}</span>
          <span className="text-text-muted-light"> — {t('tool.recovery.descriptions.' + mode)}</span>
        </div>
      </div>
    );
    return (
      <Tooltip content={tooltip} maxWidth={320}>
        <span
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded border-2 transition-colors',
            isOpen ? 'border-border-light bg-bg-tertiary' : 'border-border-default bg-bg-secondary-light hover:bg-bg-tertiary',
          )}
        >
          <Icon className={clsx('h-3.5 w-3.5', color)} />
        </span>
      </Tooltip>
    );
  };

  return (
    <RichSelect
      options={options}
      value={value}
      onChange={handleChange}
      renderTrigger={renderTrigger}
      menuWidth={260}
      align="right"
      ariaLabel={t('tool.recovery.' + value)}
    />
  );
};
