import { ReactNode, useCallback, useEffect, useState } from 'react';
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
    if (!container || userMessageIds.length === 0) {
      setHasPreviousUserMessage(false);
      setHasNextUserMessage(false);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;
    const viewportBottom = containerRect.bottom;

    let hasPrevious = false;
    let hasNext = false;

    for (const msgId of userMessageIds) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, userMessagesKey]);

  const handleNavigateToPreviousUserMessage = useCallback(() => {
    const container = containerRef.current;
    if (!container || (!scrollToMessageByElement && !scrollToMessageById)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;

    for (let i = userMessageIds.length - 1; i >= 0; i--) {
      const msgId = userMessageIds[i];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, scrollToMessageByElement, scrollToMessageById, userMessagesKey]);

  const handleNavigateToNextUserMessage = useCallback(() => {
    const container = containerRef.current;
    if (!container || (!scrollToMessageByElement && !scrollToMessageById)) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const viewportBottom = containerRect.bottom;

    for (const msgId of userMessageIds) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const defaultButtonClassName = clsx(
    'bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary',
    !alwaysVisible && 'hidden group-hover:block',
    buttonClassName,
  );

  const navigationButtons: NavigationButton[] = [
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

  const renderGoToPrevious = useCallback(() => {
    if (userMessageIds.length === 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationButtons, userMessagesKey]);

  const renderGoToNext = useCallback(() => {
    if (userMessageIds.length === 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationButtons, userMessagesKey]);

  const renderButtons = useCallback(() => {
    if (userMessageIds.length === 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
