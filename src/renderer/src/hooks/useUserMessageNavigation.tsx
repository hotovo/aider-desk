import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { IconButton } from '@/components/common/IconButton';

interface UseUserMessageNavigationProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  userMessageIds: string[];
  scrollToMessageByElement?: (element: HTMLElement) => void;
  scrollToMessageById?: (id: string) => void;
  alwaysVisible?: boolean;
  buttonClassName?: string;
}

interface NavigationButton {
  key: string;
  icon: ReactNode;
  onClick: () => void;
  tooltip: string;
  ariaLabel: string;
  disabled: boolean;
  className: string;
}

export const useUserMessageNavigation = ({
  containerRef,
  userMessageIds,
  scrollToMessageByElement,
  scrollToMessageById,
  alwaysVisible = false,
  buttonClassName = '',
}: UseUserMessageNavigationProps) => {
  const { t } = useTranslation();
  const [hasPreviousUserMessage, setHasPreviousUserMessage] = useState(false);
  const [hasNextUserMessage, setHasNextUserMessage] = useState(false);
  const userMessagesKey = userMessageIds.join(',');

  const updateNavigationButtons = useCallback(() => {
    const container = containerRef.current;
    const ids = userMessagesKey ? userMessagesKey.split(',') : [];
    if (!container || ids.length === 0) {
      setHasPreviousUserMessage(false);
      setHasNextUserMessage(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;
    const viewportBottom = containerRect.bottom;

    let hasPrevious = false;
    let hasNext = false;

    for (const msgId of ids) {
      const msgElement = container.querySelector(`#user-message-${msgId}`) as HTMLElement;
      if (!msgElement) {
        continue;
      }

      const msgRect = msgElement.getBoundingClientRect();
      const msgTop = msgRect.top;
      const msgBottom = msgRect.bottom;

      if (msgBottom < viewportTop) {
        hasPrevious = true;
      }
      if (msgTop > viewportBottom) {
        hasNext = true;
        break;
      }
    }

    setHasPreviousUserMessage(hasPrevious);
    setHasNextUserMessage(hasNext);
  }, [containerRef, userMessagesKey]);

  const handleNavigateToPreviousUserMessage = useCallback(() => {
    const container = containerRef.current;
    if (!container || (!scrollToMessageByElement && !scrollToMessageById)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;

    const ids = userMessagesKey ? userMessagesKey.split(',') : [];
    for (let i = ids.length - 1; i >= 0; i--) {
      const msgId = ids[i];
      const msgElement = container.querySelector(`#user-message-${msgId}`) as HTMLElement;
      if (!msgElement) {
        continue;
      }

      const msgRect = msgElement.getBoundingClientRect();
      if (msgRect.bottom < viewportTop) {
        scrollToMessageByElement?.(msgElement);
        scrollToMessageById?.(msgId);
        break;
      }
    }
  }, [containerRef, scrollToMessageByElement, scrollToMessageById, userMessagesKey]);

  const handleNavigateToNextUserMessage = useCallback(() => {
    const container = containerRef.current;
    if (!container || (!scrollToMessageByElement && !scrollToMessageById)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportBottom = containerRect.bottom;

    const ids = userMessagesKey ? userMessagesKey.split(',') : [];
    for (const msgId of ids) {
      const msgElement = container.querySelector(`#user-message-${msgId}`) as HTMLElement;
      if (!msgElement) {
        continue;
      }

      const msgRect = msgElement.getBoundingClientRect();
      if (msgRect.top > viewportBottom) {
        scrollToMessageByElement?.(msgElement);
        scrollToMessageById?.(msgId);
        break;
      }
    }
  }, [containerRef, scrollToMessageByElement, scrollToMessageById, userMessagesKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        updateNavigationButtons();
        rafId = null;
      });
    };

    container.addEventListener('scroll', handleScroll);

    const timeoutId = setTimeout(() => {
      updateNavigationButtons();
    }, 0);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      clearTimeout(timeoutId);
    };
  }, [containerRef, updateNavigationButtons]);

  const navigationButtons: NavigationButton[] = useMemo(() => {
    const defaultButtonClassName = clsx(
      'bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary',
      !alwaysVisible && 'hidden group-hover:block',
      buttonClassName,
    );

    return [
      {
        key: 'previous',
        icon: <MdKeyboardArrowUp className="h-6 w-6" />,
        onClick: handleNavigateToPreviousUserMessage,
        tooltip: t('messages.previousUserMessage'),
        ariaLabel: t('messages.previousUserMessage'),
        disabled: !hasPreviousUserMessage,
        className: defaultButtonClassName,
      },
      {
        key: 'next',
        icon: <MdKeyboardArrowDown className="h-6 w-6" />,
        onClick: handleNavigateToNextUserMessage,
        tooltip: t('messages.nextUserMessage'),
        ariaLabel: t('messages.nextUserMessage'),
        disabled: !hasNextUserMessage,
        className: defaultButtonClassName,
      },
    ];
  }, [handleNavigateToPreviousUserMessage, handleNavigateToNextUserMessage, t, hasPreviousUserMessage, hasNextUserMessage, alwaysVisible, buttonClassName]);

  const renderGoToPrevious = useCallback(() => {
    if (!userMessagesKey) {
      return null;
    }

    const button = navigationButtons.find((b) => b.key === 'previous');
    if (!button) {
      return null;
    }

    return (
      <IconButton
        icon={button.icon}
        onClick={button.onClick}
        tooltip={button.tooltip}
        className={button.className}
        aria-label={button.ariaLabel}
        disabled={button.disabled}
      />
    );
  }, [navigationButtons, userMessagesKey]);

  const renderGoToNext = useCallback(() => {
    if (!userMessagesKey) {
      return null;
    }

    const button = navigationButtons.find((b) => b.key === 'next');
    if (!button) {
      return null;
    }

    return (
      <IconButton
        icon={button.icon}
        onClick={button.onClick}
        tooltip={button.tooltip}
        className={button.className}
        aria-label={button.ariaLabel}
        disabled={button.disabled}
      />
    );
  }, [navigationButtons, userMessagesKey]);

  const renderButtons = useCallback(() => {
    if (!userMessagesKey) {
      return null;
    }

    return navigationButtons.map((button) => (
      <IconButton
        key={button.key}
        icon={button.icon}
        onClick={button.onClick}
        tooltip={button.tooltip}
        className={button.className}
        aria-label={button.ariaLabel}
        disabled={button.disabled}
      />
    ));
  }, [navigationButtons, userMessagesKey]);

  return {
    hasPreviousUserMessage,
    hasNextUserMessage,
    handleNavigateToPreviousUserMessage,
    handleNavigateToNextUserMessage,
    renderButtons,
    renderGoToPrevious,
    renderGoToNext,
  };
};
