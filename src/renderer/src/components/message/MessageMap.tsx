import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { Message } from '@common/types';

import { createMessageMapTurns, getActiveTurnId, MessageMapTurn } from './messageMap';
import { MessageMapMarker } from './MessageMapMarker';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  messages: Message[];
  visibleIndex: number;
  onNavigate: (index: number) => void;
  onPreviousUserMessage: () => void;
  onNextUserMessage: () => void;
  hasPreviousUserMessage: boolean;
  hasNextUserMessage: boolean;
  onScrollToBottom: () => void;
};

export const MessageMap = memo(
  ({ messages, visibleIndex, onNavigate, onPreviousUserMessage, onNextUserMessage, hasPreviousUserMessage, hasNextUserMessage, onScrollToBottom }: Props) => {
    const { t } = useTranslation();
    const turns = useMemo(() => createMessageMapTurns(messages), [messages]);
    const activeTurnId = useMemo(() => getActiveTurnId(turns, visibleIndex), [turns, visibleIndex]);

    const handleNavigate = (turn: MessageMapTurn) => {
      onNavigate(turn.startIndex);
    };

    if (turns.length === 0) {
      return null;
    }

    const buttonClassName =
      'flex h-6 w-7 shrink-0 items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-text-primary rounded-sm';

    return (
      <nav
        aria-label={t('messages.map.title')}
        className="absolute left-0 top-1/2 z-20 flex max-h-[calc(100%-4rem)] w-8 -translate-y-1/2 flex-col items-center rounded-r-md border border-transparent bg-bg-primary-light/0 py-1.5 opacity-10 transition-all duration-200 hover:border-border-default hover:bg-bg-primary-light/95 hover:opacity-100"
      >
        <Tooltip content={t('messages.previousUserMessage')} side="right">
          <button
            type="button"
            aria-label={t('messages.previousUserMessage')}
            disabled={!hasPreviousUserMessage}
            onClick={onPreviousUserMessage}
            className={buttonClassName}
          >
            <MdKeyboardArrowUp className="h-5 w-5" />
          </button>
        </Tooltip>
        <div className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin flex flex-col items-center gap-0.5 py-1">
          {turns.map((turn) => (
            <MessageMapMarker key={turn.id} turn={turn} active={activeTurnId === turn.id} onNavigate={handleNavigate} />
          ))}
        </div>
        <Tooltip content={t('messages.nextUserMessage')} side="right">
          <button type="button" aria-label={t('messages.nextUserMessage')} disabled={!hasNextUserMessage} onClick={onNextUserMessage} className={buttonClassName}>
            <MdKeyboardArrowDown className="h-5 w-5" />
          </button>
        </Tooltip>
        <Tooltip content={t('messages.scrollToBottom')} side="right">
          <button type="button" aria-label={t('messages.scrollToBottom')} onClick={onScrollToBottom} className={buttonClassName}>
            <MdKeyboardDoubleArrowDown className="h-5 w-5" />
          </button>
        </Tooltip>
      </nav>
    );
  },
);

MessageMap.displayName = 'MessageMap';
