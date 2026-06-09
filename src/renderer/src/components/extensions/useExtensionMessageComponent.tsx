import { useCallback, useMemo } from 'react';
import { ExtensionUIComponent, Message, isToolMessage } from '@common/types';

import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';

const matchesMessage = (message: Message, messageFilter: ExtensionUIComponent['messageFilter']): boolean => {
  if (!messageFilter) {
    return false;
  }

  if (messageFilter.types && messageFilter.types.length > 0) {
    if (!messageFilter.types.includes(message.type)) {
      return false;
    }
  }

  if (messageFilter.serverName || messageFilter.toolName) {
    if (!isToolMessage(message)) {
      return false;
    }

    if (messageFilter.serverName && message.serverName !== messageFilter.serverName) {
      return false;
    }

    if (messageFilter.toolName && message.toolName !== messageFilter.toolName) {
      return false;
    }
  }

  return true;
};

type UseExtensionMessageComponentProps = {
  message: Message;
  projectDir?: string;
  taskId?: string;
};

export const useExtensionMessageComponent = ({ message, projectDir, taskId }: UseExtensionMessageComponentProps) => {
  const additionalProps = useMemo(
    () => ({
      message,
    }),
    [message],
  );

  const { components, renderComponents } = useExtensionComponentsWrapper({
    placement: 'task-message',
    additionalProps,
    projectDir,
    taskId,
  });

  const hasMatch = useMemo(() => {
    if (!components || components.length === 0) {
      return false;
    }

    return components.some((comp) => matchesMessage(message, comp.messageFilter));
  }, [components, message]);

  const renderMatchingComponent = useCallback(() => {
    if (!components || components.length === 0) {
      return null;
    }

    const matchingComponent = components.find((comp) => matchesMessage(message, comp.messageFilter));
    if (!matchingComponent) {
      return null;
    }

    const matchingIndex = components.indexOf(matchingComponent);
    const allRendered = renderComponents();

    return allRendered[matchingIndex] ?? null;
  }, [components, message, renderComponents]);

  return {
    hasMatch,
    renderMatchingComponent,
  };
};
