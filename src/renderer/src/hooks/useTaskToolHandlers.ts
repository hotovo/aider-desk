import { useCallback, useEffect } from 'react';
import { TODO_TOOL_CLEAR_ITEMS, TODO_TOOL_GET_ITEMS, TODO_TOOL_GROUP_NAME, TODO_TOOL_SET_ITEMS, TODO_TOOL_UPDATE_ITEM_COMPLETION } from '@common/tools';

import type { TodoItem, ToolData, ToolInputChunkData, ToolMessage } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { setMessages, setTodoItems, touchTaskActivity } from '@/stores/taskStore';

export const useTaskToolHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();

  const handleTodoTool = useCallback(
    (toolName: string, args: Record<string, unknown> | undefined, response: string | undefined) => {
      try {
        switch (toolName) {
          case TODO_TOOL_SET_ITEMS: {
            if (args?.items && Array.isArray(args.items)) {
              setTodoItems(taskId, () => args.items as TodoItem[]);
            }
            break;
          }
          case TODO_TOOL_GET_ITEMS: {
            if (response) {
              try {
                const parsedResponse = JSON.parse(response);
                if (parsedResponse.items && Array.isArray(parsedResponse.items)) {
                  setTodoItems(taskId, () => parsedResponse.items);
                }
              } catch {
                if (response.includes('No todo items found')) {
                  setTodoItems(taskId, () => []);
                }
              }
            }
            break;
          }
          case TODO_TOOL_UPDATE_ITEM_COMPLETION: {
            if (args?.name && typeof args.completed === 'boolean') {
              setTodoItems(taskId, (prev) => prev.map((item) => (item.name === args.name ? { ...item, completed: args.completed as boolean } : item)));
            }
            break;
          }
          case TODO_TOOL_CLEAR_ITEMS: {
            setTodoItems(taskId, () => []);
            break;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error handling TODO tool:', error);
      }
    },
    [taskId],
  );

  const handleToolInputChunk = useCallback(
    ({ toolCallId, serverName, toolName, partialArgs, isComplete, promptContext }: ToolInputChunkData) => {
      touchTaskActivity(taskId);
      setMessages(taskId, (prevMessages) => {
        const existingIndex = prevMessages.findIndex((m) => m.id === toolCallId);
        if (existingIndex !== -1) {
          const updated = [...prevMessages];
          const existing = updated[existingIndex] as ToolMessage;
          updated[existingIndex] = {
            ...existing,
            args: (partialArgs as Record<string, unknown>) || existing.args,
            isStreaming: !isComplete,
            promptContext: promptContext ?? existing.promptContext,
          } as ToolMessage;
          return updated;
        }
        const newToolMessage: ToolMessage = {
          id: toolCallId,
          type: 'tool',
          serverName: serverName || '',
          toolName: toolName || '',
          args: (partialArgs as Record<string, unknown>) || {},
          content: '',
          isStreaming: !isComplete,
          promptContext,
          timestamp: Date.now(),
        };
        const loadingMessages = prevMessages.filter((m) => m.type === 'loading');
        const nonLoadingMessages = prevMessages.filter((m) => m.type !== 'loading' && m.id !== toolCallId);
        return [...nonLoadingMessages, newToolMessage, ...loadingMessages];
      });
    },
    [taskId],
  );

  const handleTool = useCallback(
    ({ id, serverName, toolName, args, response, usageReport, promptContext, finished, timestamp }: ToolData) => {
      touchTaskActivity(taskId);
      if (serverName === TODO_TOOL_GROUP_NAME) {
        handleTodoTool(toolName, args as Record<string, unknown>, response);
        return;
      }

      const createNewToolMessage = (): ToolMessage => {
        return {
          id,
          type: 'tool',
          serverName,
          toolName,
          args: (args as Record<string, unknown> | undefined) || {},
          content: response || '',
          usageReport,
          promptContext,
          finished,
          timestamp,
        };
      };

      setMessages(taskId, (prevMessages) => {
        const loadingMessages = prevMessages.filter((message) => message.type === 'loading');
        const nonLoadingMessages = prevMessages.filter((message) => message.type !== 'loading' && message.id !== id);
        const toolMessageIndex = prevMessages.findIndex((message) => message.id === id);
        const toolMessage = prevMessages[toolMessageIndex] as ToolMessage;

        if (toolMessage) {
          const updatedMessages = [...prevMessages];
          updatedMessages[toolMessageIndex] = {
            ...createNewToolMessage(),
            ...toolMessage,
            args: args || toolMessage.args,
            content: response || '',
            usageReport,
            promptContext,
            finished,
            isStreaming: false,
          } as ToolMessage;
          return updatedMessages;
        } else {
          return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
        }
      });
    },
    [taskId, handleTodoTool],
  );

  useEffect(() => {
    const removeListener = api.addToolListener(baseDir, taskId, handleTool);

    return () => {
      removeListener();
    };
  }, [api, baseDir, taskId, handleTool]);

  useEffect(() => {
    const removeToolInputListener = api.addToolInputChunkListener(baseDir, taskId, handleToolInputChunk);
    return () => {
      removeToolInputListener();
    };
  }, [api, baseDir, taskId, handleToolInputChunk]);
};
