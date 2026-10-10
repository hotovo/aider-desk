import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { MessageMapRole } from './messageMap';
import { MessageMapPreview } from './MessageMapPreview';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  turnNumber: number;
  role: MessageMapRole;
  index: number;
  preview: string;
  active: boolean;
  onNavigate: (index: number, animated: boolean) => void;
};

export const MessageMapMarker = memo(({ turnNumber, role, index, preview, active, onNavigate }: Props) => {
  const { t } = useTranslation();
  const isUser = role === MessageMapRole.User;
  const label = isUser ? t('messages.map.userPrompt') : t('messages.map.assistantReply');
  const handleClick = () => onNavigate(index, false);

  return (
    <Tooltip side="right" content={<MessageMapPreview turnNumber={turnNumber} role={role} preview={preview} />}>
      <button
        type="button"
        aria-label={t('messages.map.goToMessage', { label, number: turnNumber })}
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
});

MessageMapMarker.displayName = 'MessageMapMarker';
