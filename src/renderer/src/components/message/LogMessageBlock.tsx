import { FaInfoCircle, FaExclamationTriangle, FaExclamationCircle } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { CopyMessageButton } from './CopyMessageButton';

import { LogMessage } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  message: LogMessage;
  onRemove?: () => void;
};

export const LogMessageBlock = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs border';

  const levelConfig = {
    info: {
      levelClasses: 'bg-bg-secondary border-bg-tertiary50 text-text-primary',
      tooltipClass: 'text-text-muted hover:text-text-mutedLight',
      Icon: FaInfoCircle,
    },
    warning: {
      levelClasses: 'bg-warning10 border-warning30 text-agent-contextFiles',
      tooltipClass: 'text-warning hover:text-warningLight',
      Icon: FaExclamationTriangle,
    },
    error: {
      levelClasses: 'bg-error15 border-error30 text-diffViewerTextPrimary',
      tooltipClass: 'text-errorLight hover:text-diffViewerTextPrimary',
      Icon: FaExclamationCircle,
    },
  };

  const config = levelConfig[message.level] || levelConfig.info;
  const Icon = config.Icon;

  return (
    <div className={`${baseClasses} ${config.levelClasses} relative group`}>
      <div className="flex items-start gap-3">
        <Icon className="inline-block h-3 w-3 flex-shrink-0 mt-[3px]" />
        <div>{t(message.content)}</div>
      </div>
      <div className="absolute top-2 right-2 flex items-center space-x-1">
        <CopyMessageButton content={message.content} className={config.tooltipClass} />
        {onRemove && (
          <IconButton
            icon={<MdClose className="w-4 h-4" />}
            onClick={onRemove}
            tooltip={t('common.remove')}
            className={`p-1 rounded ${config.tooltipClass} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
          />
        )}
      </div>
    </div>
  );
};
