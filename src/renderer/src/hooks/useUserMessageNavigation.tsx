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
  // Index-based mode (for virtualized lists where off-screen messages are not in the DOM).
  // When both are provided, navigation is computed from item indices and the visible range
  // instead of querying/measuring DOM nodes.
  userMessageIndices?: number[];
  getVisibleRange?: () => { startIndex: number; endIndex: number } | null;
  scrollToIndex?: (index: number) => void;
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
  userMessageIndices,
  getVisibleRange,
  scrollToIndex,
  alwaysVisible = false,
  buttonClassName = '',
}: UseUserMessageNavigationProps) => {
  const { t } = useTranslation();
  const [hasPreviousUserMessage, setHasPreviousUserMessage] = useState(false);
  const [hasNextUserMessage, setHasNextUserMessage] = useState(false);
  const userMessagesKey = userMessageIds.join(',');
  const isIndexMode = !!getVisibleRange && !!userMessageIndices;
  const userIndicesKey = (userMessageIndices ?? []).join(',');

  const updateNavigationButtons = useCallback(() => {
    if (isIndexMode) {
      const range = getVisibleRange!();
      const indices = userIndicesKey ? userIndicesKey.split(',').map(Number) : [];
      if (!range || indices.length === 0) {
        setHasPreviousUserMessage(false);
        setHasNextUserMessage(false);
        return;
      }
      setHasPreviousUserMessage(indices.some((index) => index < range.startIndex));
      setHasNextUserMessage(indices.some((index) => index > range.endIndex));
      return;
    }

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
  }, [isIndexMode, getVisibleRange, userIndicesKey, containerRef, userMessagesKey]);

  const handleNavigateToPreviousUserMessage = useCallback(() => {
    if (isIndexMode) {
      const range = getVisibleRange!();
      const indices = userIndicesKey ? userIndicesKey.split(',').map(Number) : [];
      if (!range) {
        return;
      }
      // indices are ascending; pick the largest one strictly above the visible range
      let target = -1;
      for (const index of indices) {
        if (index < range.startIndex) {
          target = index;
        } else {
          break;
        }
      }
      if (target !== -1) {
        scrollToIndex?.(target);
      }
      return;
    }

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
  }, [isIndexMode, getVisibleRange, scrollToIndex, userIndicesKey, containerRef, scrollToMessageByElement, scrollToMessageById, userMessagesKey]);

  const handleNavigateToNextUserMessage = useCallback(() => {
    if (isIndexMode) {
      const range = getVisibleRange!();
      const indices = userIndicesKey ? userIndicesKey.split(',').map(Number) : [];
      if (!range) {
        return;
      }
      // indices are ascending; pick the first one strictly below the visible range
      const target = indices.find((index) => index > range.endIndex);
      if (target !== undefined) {
        scrollToIndex?.(target);
      }
      return;
    }

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
  }, [isIndexMode, getVisibleRange, scrollToIndex, userIndicesKey, containerRef, scrollToMessageByElement, scrollToMessageById, userMessagesKey]);

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
