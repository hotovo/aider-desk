import { useCallback, useEffect } from 'react';
import { TODO_TOOL_GROUP_NAME, TODO_TOOL_SET_ITEMS, TODO_TOOL_GET_ITEMS, TODO_TOOL_UPDATE_ITEM_COMPLETION, TODO_TOOL_CLEAR_ITEMS } from '@common/tools';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { ToolData, TodoItem } from '@common/types';
import type { ToolMessage } from '@/types/message';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

export const useTaskToolHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const { setMessages, setAiderTotalCost, setTodoItems } = useStoreWithEqualityFn(
    useTaskStore,
    (storeState) => ({
      setMessages: storeState.setMessages,
      setAiderTotalCost: storeState.setAiderTotalCost,
      setTodoItems: storeState.setTodoItems,
    }),
    shallow,
  );

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
      } catch {
        // error is silently caught
      }
    },
    [taskId, setTodoItems],
  );

  const handleTool = useCallback(
    ({ id, serverName, toolName, args, response, usageReport, promptContext, finished }: ToolData) => {
      if (serverName === TODO_TOOL_GROUP_NAME) {
        handleTodoTool(toolName, args as Record<string, unknown>, response);

        if (usageReport?.aiderTotalCost !== undefined) {
          setAiderTotalCost(taskId, usageReport.aiderTotalCost);
        }
        return;
      }

      const createNewToolMessage = (): ToolMessage => {
        const toolMessage: ToolMessage = {
          id,
          type: 'tool',
          serverName,
          toolName,
          args: (args as Record<string, unknown> | undefined) || {},
          content: response || '',
          usageReport,
          promptContext,
          finished,
        };
        return toolMessage;
      };

      setMessages(taskId, (prevMessages) => {
        const loadingMessages = prevMessages.filter((message) => message.type === 'loading');
        const nonLoadingMessages = prevMessages.filter((message) => message.type !== 'loading' && message.id !== id);
        const toolMessageIndex = prevMessages.findIndex((message) => message.id === id);
        const toolMessage = prevMessages[toolMessageIndex];

        if (toolMessage) {
          const updatedMessages = [...prevMessages];
          updatedMessages[toolMessageIndex] = {
            ...createNewToolMessage(),
            ...toolMessage,
            content: response || '',
            usageReport,
            promptContext,
            finished,
          } as ToolMessage;
          return updatedMessages;
        } else {
          return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
        }
      });

      if (usageReport?.aiderTotalCost !== undefined) {
        setAiderTotalCost(taskId, usageReport.aiderTotalCost);
      }
    },
    [taskId, setMessages, setAiderTotalCost, handleTodoTool],
  );

  useEffect(() => {
    const removeListener = api.addToolListener(baseDir, taskId, handleTool);

    return () => {
      removeListener();
    };
  }, [api, baseDir, taskId, handleTool]);
};
