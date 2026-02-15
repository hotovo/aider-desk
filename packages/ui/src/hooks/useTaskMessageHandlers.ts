import { useCallback, useEffect } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { UserMessageData, MessageRemovedData } from '@aider-desk/common/types';
import type { UserMessage } from '@/types/message';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

export const useTaskMessageHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  const handleUserMessage = useCallback(
    (data: UserMessageData) => {
      const userMessage: UserMessage = {
        id: data.id,
        type: 'user',
        content: data.content,
        promptContext: data.promptContext,
      };

      setMessages(taskId, (prevMessages) => {
        const loadingMessages = prevMessages.filter((message) => message.type === 'loading');
        const nonLoadingMessages = prevMessages.filter(
          (message) => message.type !== 'loading' && message.id !== data.id && !(message.type === 'user' && (message as UserMessage).isOptimistic),
        );
        return [...nonLoadingMessages, userMessage, ...loadingMessages];
      });
    },
    [taskId, setMessages],
  );

  const handleMessageRemoved = useCallback(
    (data: MessageRemovedData) => {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !data.messageIds.includes(message.id)));
    },
    [taskId, setMessages],
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
