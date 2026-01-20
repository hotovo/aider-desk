import { useCallback, useEffect } from 'react';

import { useTranslation } from 'react-i18next';

import { v4 as uuidv4 } from 'uuid';

import type { LogData } from '@common/types';

import type { LogMessage, LoadingMessage, Message } from '@/types/message';

import { useApi } from '@/contexts/ApiContext';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { useTaskStore } from '@/stores/taskStore';

function isLoadingMessage(message: Message): message is LoadingMessage {
  return message.type === 'loading';
}

export function useTaskLogHandlers(baseDir: string, taskId: string) {
  const api = useApi();
  const { t } = useTranslation();
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  const handleLog = useCallback(
    ({ level, message, finished, promptContext, actionIds }: LogData) => {
      if (level === 'loading') {
        if (finished) {
          const currentGroupId = promptContext?.group?.id;
          if (currentGroupId) {
            setMessages(taskId, (prevMessages) =>
              prevMessages.map((msg) => {
                const msgGroupId = msg.promptContext?.group?.id;
                if (msgGroupId && msgGroupId === currentGroupId) {
                  return {
                    ...msg,
                    promptContext: msg.promptContext
                      ? {
                          ...msg.promptContext,
                          group: msg.promptContext.group ? { ...msg.promptContext.group, finished: true } : msg.promptContext.group,
                        }
                      : msg.promptContext,
                  };
                }
                return msg;
              }),
            );
          }

          setMessages(taskId, (prevMessages) => prevMessages.filter((message) => message.type !== 'loading'));
        } else {
          const loadingMessage: LoadingMessage = {
            id: uuidv4(),
            type: 'loading',
            content: message || t('messages.thinking'),
            promptContext,
            actionIds,
          };

          setMessages(taskId, (prevMessages) => {
            const existingLoadingIndex = prevMessages.findIndex(isLoadingMessage);
            if (existingLoadingIndex !== -1) {
              const updatedMessages = [...prevMessages];
              updatedMessages[existingLoadingIndex] = {
                ...updatedMessages[existingLoadingIndex],
                content: loadingMessage.content,
                promptContext,
              };

              return updatedMessages;
            } else {
              return [...prevMessages, loadingMessage];
            }
          });
        }
      } else {
        const logMessage: LogMessage = {
          id: uuidv4(),
          type: 'log',
          level,
          content: message || '',
          promptContext,
          actionIds,
        };
        setMessages(taskId, (prevMessages) => [...prevMessages.filter((message) => message.type !== 'loading'), logMessage]);
      }
    },
    [taskId, setMessages, t],
  );

  useEffect(() => {
    const removeListener = api.addLogListener(baseDir, taskId, handleLog);

    return () => {
      removeListener();
    };
  }, [api, baseDir, taskId, handleLog]);
}
