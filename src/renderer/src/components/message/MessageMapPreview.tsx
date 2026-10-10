import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { MessageMapMarkerItem, MessageMapRole } from './messageMap';

type Props = {
  marker: MessageMapMarkerItem;
};

export const MessageMapPreview = ({ marker }: Props) => {
  const { t } = useTranslation();
  const isUser = marker.role === MessageMapRole.User;
  const label = isUser ? t('messages.map.userPrompt') : t('messages.map.assistantReply');

  return (
    <div className="flex max-w-[260px] flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', {
            'bg-success-light': isUser,
            'bg-info-light': !isUser,
          })}
        />
        <span className="text-2xs font-semibold uppercase tracking-wide text-text-muted">
          {t('messages.map.turn', { number: marker.turnNumber })} · {label}
        </span>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs text-text-secondary">{marker.preview || t('messages.map.emptyPreview')}</p>
    </div>
  );
};
