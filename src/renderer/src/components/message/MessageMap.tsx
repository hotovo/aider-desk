import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { Message } from '@common/types';

import { createMessageMapMarkers, createMessageMapTurns, getActiveMarkerId } from './messageMap';
import { MessageMapMarker } from './MessageMapMarker';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  messages: Message[];
  visibleIndex: number;
  onNavigate: (index: number, animated: boolean) => void;
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
    const markers = useMemo(() => createMessageMapMarkers(turns), [turns]);
    const activeMarkerId = useMemo(() => getActiveMarkerId(markers, visibleIndex), [markers, visibleIndex]);

    if (markers.length === 0) {
      return null;
    }

    const buttonClassName =
      'flex h-6 w-7 shrink-0 items-center justify-center text-text-muted opacity-0 transition-opacity duration-200 hover:text-text-primary group-hover:opacity-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-text-primary rounded-sm';

    return (
      <nav
        aria-label={t('messages.map.title')}
        className="group absolute left-0 top-1/2 z-20 flex max-h-[calc(100%-4rem)] w-8 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-r-md border-y border-r border-transparent bg-bg-primary-light/0 py-1.5 opacity-10 transition-all duration-200 hover:translate-x-0 hover:border-border-default hover:bg-bg-primary-light hover:opacity-100"
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
          {markers.map((marker) => (
            <MessageMapMarker
              key={marker.id}
              turnNumber={marker.turnNumber}
              role={marker.role}
              index={marker.index}
              preview={marker.preview}
              active={activeMarkerId === marker.id}
              onNavigate={onNavigate}
            />
          ))}
        </div>
        <Tooltip content={t('messages.nextUserMessage')} side="right">
          <button
            type="button"
            aria-label={t('messages.nextUserMessage')}
            disabled={!hasNextUserMessage}
            onClick={onNextUserMessage}
            className={buttonClassName}
          >
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
