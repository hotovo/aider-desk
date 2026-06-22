import { useCallback, useEffect } from 'react';

import type { UserMessageData, MessageRemovedData, UserMessage } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { setMessages, touchTaskActivity } from '@/stores/taskStore';

export const useTaskMessageHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();

  const handleUserMessage = useCallback(
    (data: UserMessageData) => {
      touchTaskActivity(taskId);
      const userMessage: UserMessage = {
        id: data.id,
        type: 'user',
        content: data.content,
        images: data.images,
        promptContext: data.promptContext,
        timestamp: data.timestamp,
      };

      setMessages(taskId, (prevMessages) => {
        const loadingMessages = prevMessages.filter((message) => message.type === 'loading');
        const nonLoadingMessages = prevMessages.filter(
          (message) => message.type !== 'loading' && message.id !== data.id && !(message.type === 'user' && (message as UserMessage).isOptimistic),
        );
        return [...nonLoadingMessages, userMessage, ...loadingMessages];
      });
    },
    [taskId],
  );

  const handleMessageRemoved = useCallback(
    (data: MessageRemovedData) => {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !data.messageIds.includes(message.id)));
    },
    [taskId],
  );

  useEffect(() => {
    const removeUserMessage = api.addUserMessageListener(baseDir, taskId, handleUserMessage);
    const removeMessageRemoved = api.addMessageRemovedListener(baseDir, taskId, handleMessageRemoved);

    return () => {
      removeUserMessage();
      removeMessageRemoved();
    };
  }, [api, baseDir, taskId, handleUserMessage, handleMessageRemoved]);
};
