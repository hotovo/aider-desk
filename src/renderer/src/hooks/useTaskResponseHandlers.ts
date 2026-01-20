import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { ResponseChunkData, ResponseCompletedData } from '@common/types';
import type { Message, ReflectedMessage, ResponseMessage } from '@/types/message';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

const processingResponseMessageMap = new Map<string, ResponseMessage>();

export const useTaskResponseHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  const handleResponseChunk = useCallback(
    ({ messageId, chunk, reflectedMessage, promptContext }: ResponseChunkData) => {
      let processingMessage = processingResponseMessageMap.get(taskId);
      if (processingMessage?.id === messageId) {
        processingMessage = {
          ...processingMessage,
          content: processingMessage.content + chunk,
          promptContext,
        };
        processingResponseMessageMap.set(taskId, processingMessage);
        setMessages(taskId, (prevMessages) =>
          prevMessages.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  content: message.content + chunk,
                  promptContext,
                }
              : message,
          ),
        );
      } else {
        setMessages(taskId, (prevMessages) => {
          const existingMessageIndex = prevMessages.findIndex((message) => message.id === messageId);
          const newMessages: Message[] = [];

          if (reflectedMessage) {
            const reflected: ReflectedMessage = {
              id: uuidv4(),
              type: 'reflected-message',
              content: reflectedMessage,
              responseMessageId: messageId,
              promptContext,
            };

            newMessages.push(reflected);
          }

          if (existingMessageIndex === -1) {
            const newResponseMessage: ResponseMessage = {
              id: messageId,
              type: 'response',
              content: chunk,
              promptContext,
            };
            processingResponseMessageMap.set(taskId, newResponseMessage);
            newMessages.push(newResponseMessage);

            return prevMessages.filter((message) => message.type !== 'loading').concat(...newMessages);
          } else {
            return prevMessages.map((message) => {
              if (message.id === messageId) {
                return {
                  ...message,
                  content: message.content + chunk,
                  promptContext,
                };
              }
              return message;
            });
          }
        });
      }
    },
    [taskId, setMessages],
  );

  const handleResponseCompleted = useCallback(
    ({ messageId, usageReport, content, reflectedMessage, promptContext }: ResponseCompletedData) => {
      const processingMessage = processingResponseMessageMap.get(taskId);

      if (content) {
        setMessages(taskId, (prevMessages) => {
          const responseMessage = prevMessages.find((message) => message.id === messageId) as ResponseMessage | undefined;
          if (responseMessage) {
            return prevMessages.map((message) =>
              message.id === messageId
                ? {
                    ...responseMessage,
                    content,
                    processing: false,
                    usageReport,
                    promptContext,
                  }
                : message,
            );
          } else {
            const messages: Message[] = [];
            if (reflectedMessage) {
              const reflected: ReflectedMessage = {
                id: uuidv4(),
                type: 'reflected-message',
                content: reflectedMessage,
                responseMessageId: messageId,
                promptContext,
              };
              messages.push(reflected);
            }

            const newResponseMessage: ResponseMessage = {
              id: messageId,
              type: 'response',
              content,
              usageReport,
              promptContext,
            };
            messages.push(newResponseMessage);

            return prevMessages.filter((message) => message.type !== 'loading').concat(...messages);
          }
        });
      } else if (processingMessage && processingMessage.id === messageId) {
        processingMessage.usageReport = usageReport;
        processingMessage.promptContext = promptContext;
        processingMessage.content = content || processingMessage.content;
        setMessages(taskId, (prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
      } else {
        setMessages(taskId, (prevMessages) => prevMessages.filter((message) => message.type !== 'loading'));
      }

      processingResponseMessageMap.delete(taskId);
    },
    [taskId, setMessages],
  );

  useEffect(() => {
    const removeChunk = api.addResponseChunkListener(baseDir, taskId, handleResponseChunk);
    const removeCompleted = api.addResponseCompletedListener(baseDir, taskId, handleResponseCompleted);

    return () => {
      removeChunk();
      removeCompleted();
    };
  }, [api, baseDir, taskId, handleResponseChunk, handleResponseCompleted]);
};
