import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { MessageMapMarkerItem, MessageMapRole } from './messageMap';
import { MessageMapPreview } from './MessageMapPreview';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  marker: MessageMapMarkerItem;
  active: boolean;
  onNavigate: (marker: MessageMapMarkerItem) => void;
};

export const MessageMapMarker = ({ marker, active, onNavigate }: Props) => {
  const { t } = useTranslation();
  const isUser = marker.role === MessageMapRole.User;
  const label = isUser ? t('messages.map.userPrompt') : t('messages.map.assistantReply');
  const handleClick = () => onNavigate(marker);

  return (
    <Tooltip side="right" content={<MessageMapPreview marker={marker} />}>
      <button
        type="button"
        aria-label={t('messages.map.goToMessage', { label, number: marker.turnNumber })}
        aria-current={active ? 'true' : undefined}
        onClick={handleClick}
        className="flex min-h-3 w-full items-center justify-center py-0.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-text-primary rounded-sm"
      >
        <span
          className={clsx('h-1 w-4 rounded-full transition-all hover:w-5', {
            'bg-success-light': isUser,
            'bg-info-light': !isUser,
            'w-5 ring-1 ring-text-primary ring-offset-1 ring-offset-bg-primary-light': active,
          })}
        />
      </button>
    </Tooltip>
  );
};
