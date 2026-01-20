import { useCallback } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { v4 as uuidv4 } from 'uuid';
import { TODO_TOOL_GROUP_NAME } from '@common/tools';

import { Message, ReflectedMessage, ResponseMessage, ToolMessage, UserMessage } from '@/types/message';
import { useTaskStore } from '@/stores/taskStore';
import { useApi } from '@/contexts/ApiContext';

type UseTaskActionsParams = {
  baseDir: string;
};

export const useTaskActions = ({ baseDir }: UseTaskActionsParams) => {
  const api = useApi();
  const updateTaskState = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.updateTaskState, shallow);
  const clearSession = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.clearSession, shallow);
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);
  const setAllFiles = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setAllFiles, shallow);

  const loadTask = useCallback(
    async (taskId: string) => {
      try {
        updateTaskState(taskId, { loading: true });

        const { messages: stateMessages, files, todoItems, question } = await api.loadTask(baseDir, taskId);

        const messages: Message[] = stateMessages.reduce((messages, message) => {
          if (message.type === 'response-completed') {
            if (message.reflectedMessage) {
              const reflected: ReflectedMessage = {
                id: uuidv4(),
                type: 'reflected-message',
                content: message.reflectedMessage,
                responseMessageId: message.messageId,
                promptContext: message.promptContext,
              };
              messages.push(reflected);
            }

            const responseMessage: ResponseMessage = {
              id: message.messageId,
              type: 'response',
              content: message.content,
              usageReport: message.usageReport,
              promptContext: message.promptContext,
            };
            messages.push(responseMessage);
          } else if (message.type === 'user') {
            const userMessage: UserMessage = {
              id: message.id,
              type: 'user',
              content: message.content,
              promptContext: message.promptContext,
            };
            messages.push(userMessage);
          } else if (message.type === 'tool') {
            if (message.serverName === TODO_TOOL_GROUP_NAME) {
              return messages;
            }

            const toolMessage: ToolMessage = {
              type: 'tool',
              id: message.id,
              serverName: message.serverName,
              toolName: message.toolName,
              args: (message.args as Record<string, unknown> | undefined) || {},
              content: message.response || '',
              promptContext: message.promptContext,
              usageReport: message.usageReport,
            };
            messages.push(toolMessage);
          }

          return messages;
        }, [] as Message[]);

        setMessages(taskId, (existingMessages) => [
          ...messages,
          ...existingMessages.filter((existingMessage) => !messages.some((message) => message.id === existingMessage.id)),
        ]);
        updateTaskState(taskId, {
          loading: false,
          loaded: true,
          contextFiles: files,
          todoItems: todoItems || [],
          question,
        });
      } catch {
        // error is silently caught
      }
    },
    [api, baseDir, updateTaskState, setMessages],
  );

  const resetTask = useCallback(
    (taskId: string) => {
      api.resetTask(baseDir, taskId);
      clearSession(taskId, false);
    },
    [api, baseDir, clearSession],
  );

  const answerQuestion = useCallback(
    (taskId: string, answer: string) => {
      api.answerQuestion(baseDir, taskId, answer);
      updateTaskState(taskId, { question: null });
    },
    [api, baseDir, updateTaskState],
  );

  const interruptResponse = useCallback(
    (taskId: string) => {
      api.interruptResponse(baseDir, taskId);
      updateTaskState(taskId, {
        question: null,
      });
    },
    [api, baseDir, updateTaskState],
  );

  const updateTaskAgentProfile = useCallback(
    (taskId: string, agentProfileId: string, provider: string, model: string) => {
      void api.updateTask(baseDir, taskId, {
        agentProfileId,
        provider,
        model,
      });
    },
    [api, baseDir],
  );

  const refreshAllFiles = useCallback(
    async (taskId: string, useGit = true) => {
      const refreshedFiles = await api.getAllFiles(baseDir, taskId, useGit);
      setAllFiles(taskId, refreshedFiles);
    },
    [api, baseDir, setAllFiles],
  );

  return {
    loadTask,
    clearSession,
    resetTask,
    answerQuestion,
    interruptResponse,
    updateTaskAgentProfile,
    refreshAllFiles,
  };
};
