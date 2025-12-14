import { FaInfoCircle, FaExclamationTriangle, FaExclamationCircle } from 'react-icons/fa';
import { MdClose } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { CopyMessageButton } from './CopyMessageButton';
import { MessageActions } from './MessageActions';

import { LogMessage } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';

type Props = {
  baseDir: string;
  taskId: string;
  message: LogMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const LogMessageBlock = ({ baseDir, taskId, message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs border';

  const levelConfig = {
    info: {
      levelClasses: 'bg-bg-secondary border-bg-tertiary-strong text-text-primary',
      tooltipClass: 'text-text-muted hover:text-text-muted-light',
      Icon: FaInfoCircle,
    },
    warning: {
      levelClasses: 'bg-warning-subtle border-warning-emphasis text-agent-context-files',
      tooltipClass: 'text-warning hover:text-warning-light',
      Icon: FaExclamationTriangle,
    },
    error: {
      levelClasses: 'bg-error-muted border-error-emphasis text-diffViewerTextPrimary',
      tooltipClass: 'text-error-light hover:text-diffViewerTextPrimary',
      Icon: FaExclamationCircle,
    },
  };

  const config = levelConfig[message.level] || levelConfig.info;
  const Icon = config.Icon;

  const renderMessage = () => (
    <div className="flex items-start gap-3">
      <Icon className="inline-block h-3 w-3 flex-shrink-0 mt-[3px]" />
      <div>{t(message.content)}</div>
    </div>
  );

  if (compact) {
    return renderMessage();
  }

  return (
    <div className={`${baseClasses} ${config.levelClasses} relative group`}>
      {renderMessage()}
      {message.actionIds && (
        <div className="flex flex-wrap justify-end">
          <MessageActions actionIds={message.actionIds} baseDir={baseDir} taskId={taskId} />
        </div>
      )}
      <div className="absolute top-2 right-2 flex items-center space-x-1">
        <CopyMessageButton content={t(message.content)} className={config.tooltipClass} />
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
