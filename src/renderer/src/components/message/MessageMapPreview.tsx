import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { MessageMapRole } from './messageMap';

type Props = {
  turnNumber: number;
  role: MessageMapRole;
  preview: string;
};

export const MessageMapPreview = ({ turnNumber, role, preview }: Props) => {
  const { t } = useTranslation();
  const isUser = role === MessageMapRole.User;
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
        <span className="text-4xs font-semibold uppercase tracking-wide text-text-muted">
          {t('messages.map.turn', { number: turnNumber })} · {label}
        </span>
      </div>
      <p className="line-clamp-4 whitespace-pre-wrap break-words text-3xs text-text-secondary">{preview || t('messages.map.emptyPreview')}</p>
    </div>
  );
};
