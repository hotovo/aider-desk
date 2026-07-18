import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TODO_TOOL_GROUP_NAME } from '@common/tools';
import { Message, ReflectedMessage, ResponseMessage, ToolMessage, UserMessage } from '@common/types';

import { updateTaskState, clearSession, setMessages } from '@/stores/taskStore';
import { setTaskAllFiles } from '@/stores/taskFilesStore';
import { useProjectStore } from '@/stores/projectStore';
import { getTaskDir } from '@/utils/task-utils';
import { useApi } from '@/contexts/ApiContext';

type UseTaskActionsParams = {
  baseDir: string;
};

export const useTaskActions = ({ baseDir }: UseTaskActionsParams) => {
  const api = useApi();

  const loadTask = useCallback(
    async (taskId: string) => {
      try {
        updateTaskState(taskId, { loading: true });

        const { messages: stateMessages, files, todoItems, question, queuedPrompts } = await api.loadTask(baseDir, taskId);

        const messages: Message[] = stateMessages.flatMap((message): Message[] => {
          if (message.type === 'response-completed') {
            const result: Message[] = [];
            if (message.reflectedMessage) {
              result.push({
                id: uuidv4(),
                type: 'reflected-message',
                content: message.reflectedMessage,
                responseMessageId: message.messageId,
                promptContext: message.promptContext,
                timestamp: message.timestamp,
              } as ReflectedMessage);
            }
            result.push({
              id: message.messageId,
              type: 'response',
              content: message.content,
              reasoning: message.reasoning,
              usageReport: message.usageReport,
              promptContext: message.promptContext,
              finished: true,
              timestamp: message.timestamp,
            } as ResponseMessage);
            return result;
          }
          if (message.type === 'user') {
            return [
              {
                id: message.id,
                type: 'user',
                content: message.content,
                images: message.images,
                promptContext: message.promptContext,
                timestamp: message.timestamp,
              } as UserMessage,
            ];
          }
          if (message.type === 'tool') {
            if (message.serverName === TODO_TOOL_GROUP_NAME) {
              return [];
            }
            return [
              {
                type: 'tool',
                id: message.id,
                serverName: message.serverName,
                toolName: message.toolName,
                args: (message.args as Record<string, unknown> | undefined) || {},
                content: message.response || '',
                promptContext: message.promptContext,
                usageReport: message.usageReport,
                timestamp: message.timestamp,
                finished: message.finished,
              } as ToolMessage,
            ];
          }
          return [];
        });

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
          queuedPrompts,
          lastActiveAt: new Date(),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load task:', error);
      }
    },
    [api, baseDir],
  );

  const resetTask = useCallback(
    (taskId: string) => {
      api.resetTask(baseDir, taskId);
      clearSession(taskId);
      setMessages(taskId, () => []);
    },
    [api, baseDir],
  );

  const restartAiderConnector = useCallback(
    (taskId: string) => {
      api.restartAiderConnector(baseDir, taskId);
    },
    [api, baseDir],
  );

  const answerQuestion = useCallback(
    (taskId: string, answer: string) => {
      api.answerQuestion(baseDir, taskId, answer);
      updateTaskState(taskId, { question: null });
    },
    [api, baseDir],
  );

  const interruptResponse = useCallback(
    (taskId: string, interruptId?: string) => {
      api.interruptResponse(baseDir, taskId, interruptId);
      updateTaskState(taskId, {
        question: null,
      });
    },
    [api, baseDir],
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
      const tasks = useProjectStore.getState().projectTasksMap.get(baseDir) || [];
      const task = tasks.find((t) => t.id === taskId);
      const taskDir = task ? getTaskDir(task) : baseDir;
      setTaskAllFiles(taskId, taskDir, refreshedFiles);
    },
    [api, baseDir],
  );

  const refreshContextFiles = useCallback(
    async (taskId: string) => {
      await api.refreshContextFiles(baseDir, taskId);
    },
    [api, baseDir],
  );

  return useMemo(
    () => ({
      loadTask,
      clearSession,
      resetTask,
      restartAiderConnector,
      answerQuestion,
      interruptResponse,
      updateTaskAgentProfile,
      refreshAllFiles,
      refreshContextFiles,
    }),
    [loadTask, resetTask, restartAiderConnector, answerQuestion, interruptResponse, updateTaskAgentProfile, refreshAllFiles, refreshContextFiles],
  );
};
