import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { isLogMessage } from '@common/types';
import { getLogActions } from '@common/log-actions';

import type { LogData, LogMessage, LoadingMessage, Message } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { setMessages, touchTaskActivity } from '@/stores/taskStore';

const isLoadingMessage = (message: Message): message is LoadingMessage => {
  return message.type === 'loading';
};

const RESOLVE_GIT_ERROR_WITH_AGENT_ACTION_ID = 'resolve-git-error-with-agent';

export const useTaskLogHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const { t } = useTranslation();

  const handleLog = useCallback(
    (data: LogData) => {
      const { level, message, finished, promptContext, timestamp } = data;
      const actions = getLogActions(data);
      touchTaskActivity(taskId);
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
            actions,
            timestamp,
          };

          setMessages(taskId, (prevMessages) => {
            const existingLoadingIndex = prevMessages.findIndex(isLoadingMessage);
            if (existingLoadingIndex !== -1) {
              const updatedMessages = [...prevMessages];
              updatedMessages[existingLoadingIndex] = {
                ...loadingMessage,
                id: updatedMessages[existingLoadingIndex].id,
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
          actions,
          timestamp,
        };
        setMessages(taskId, (prevMessages) => [
          ...prevMessages
            .map((msg) =>
              isLogMessage(msg) && msg.actions?.some((action) => action.id === RESOLVE_GIT_ERROR_WITH_AGENT_ACTION_ID)
                ? { ...msg, actions: msg.actions.filter((action) => action.id !== RESOLVE_GIT_ERROR_WITH_AGENT_ACTION_ID) }
                : msg,
            )
            .filter((message) => !isLoadingMessage(message)),
          logMessage,
        ]);
      }
    },
    [taskId, t],
  );

  useEffect(() => {
    const removeListener = api.addLogListener(baseDir, taskId, handleLog);

    return () => {
      removeListener();
    };
  }, [api, baseDir, taskId, handleLog]);
};
