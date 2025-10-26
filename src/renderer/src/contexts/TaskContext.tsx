import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  AutocompletionData,
  ClearTaskData,
  CommandOutputData,
  ContextFile,
  ContextFilesUpdatedData,
  LogData,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  TaskData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UserMessageData,
} from '@common/types';
import { v4 as uuidv4 } from 'uuid';
import { TODO_TOOL_CLEAR_ITEMS, TODO_TOOL_GET_ITEMS, TODO_TOOL_GROUP_NAME, TODO_TOOL_SET_ITEMS, TODO_TOOL_UPDATE_ITEM_COMPLETION } from '@common/tools';
import { useTranslation } from 'react-i18next';

import {
  CommandOutputMessage,
  isCommandOutputMessage,
  isLoadingMessage,
  LoadingMessage,
  LogMessage,
  Message,
  ReflectedMessage,
  ResponseMessage,
  ToolMessage,
  UserMessage,
} from '@/types/message';
import { useApi } from '@/contexts/ApiContext';

interface TaskState {
  loading: boolean;
  loaded: boolean;
  processing: boolean;
  finishAcknowledged: boolean;
  messages: Message[];
  tokensInfo: TokensInfoData | null;
  question: QuestionData | null;
  todoItems: TodoItem[];
  allFiles: string[];
  autocompletionWords: string[];
  aiderTotalCost: number;
  contextFiles: ContextFile[];
  aiderModelsData: ModelsData | null;
}

const EMPTY_TASK_STATE: TaskState = {
  processing: false,
  loading: false,
  loaded: false,
  finishAcknowledged: true,
  messages: [],
  tokensInfo: null,
  question: null,
  todoItems: [],
  allFiles: [],
  autocompletionWords: [],
  aiderTotalCost: 0,
  contextFiles: [],
  aiderModelsData: null,
};

const processingResponseMessageMap = new Map<string, ResponseMessage>();

interface TaskContextType {
  getTaskState: (taskId: string, loadIfNotLoaded?: boolean) => TaskState | null;
  addInterruptedMessage: (taskId: string) => void;
  clearSession: (taskId: string, messagesOnly: boolean) => void;
  restartTask: (taskId: string) => void;
  setMessages: (taskId: string, updateMessages: (prevState: Message[]) => Message[]) => void;
  // TODO: add listeners for todo items and remove
  setTodoItems: (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => void;
  // TODO: add question answer, clear question events and listeners and remove
  setQuestion: (taskId: string, question: QuestionData | null) => void;
  setAiderModelsData: (taskId: string, modelsData: ModelsData | null) => void;
}

const TaskContext = createContext<TaskContextType | null>(null);

export const TaskProvider: React.FC<{
  baseDir: string;
  tasks: TaskData[];
  children: ReactNode;
}> = ({ baseDir, tasks, children }) => {
  const api = useApi();
  const { t } = useTranslation();
  const [taskStateMap, setTaskStateMap] = useState<Map<string, TaskState>>(new Map());

  const updateTaskState = useCallback((taskId: string, updates: Partial<TaskState>) => {
    setTaskStateMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(taskId) || EMPTY_TASK_STATE;
      newMap.set(taskId, { ...current, ...updates });
      return newMap;
    });
  }, []);

  const loadTask = async (taskId: string) => {
    try {
      const contextData = await api.loadTask(baseDir, taskId);

      const messages: Message[] = contextData.messages.reduce((messages, message) => {
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
            processing: false,
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

      setTaskStateMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(taskId, {
          ...EMPTY_TASK_STATE,
          loading: false,
          loaded: true,
          messages,
          contextFiles: contextData.files,
        });
        return newMap;
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load task:', error);
    }
  };

  const getTaskState = (taskId: string, loadIfNotLoaded = true): TaskState | null => {
    const taskState = taskStateMap.get(taskId);
    if (!taskState) {
      return null;
    }

    if (!taskState.loaded && !taskState.loading && loadIfNotLoaded) {
      void loadTask(taskId);
      updateTaskState(taskId, { loading: true });

      return {
        ...taskState,
        loading: true,
      };
    }

    return taskState;
  };

  const setMessages = (taskId: string, updateMessages: (prevState: Message[]) => Message[]) => {
    setTaskStateMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(taskId) || EMPTY_TASK_STATE;
      newMap.set(taskId, { ...current, messages: updateMessages(current.messages) });
      return newMap;
    });
  };

  const clearSession = useCallback(
    (taskId: string, messagesOnly: boolean) => {
      const update: Partial<TaskState> = {
        messages: [],
        processing: false,
      };

      processingResponseMessageMap.delete(taskId);

      if (!messagesOnly) {
        update.aiderTotalCost = 0;
        update.tokensInfo = null;
        update.question = null;
        // setEditingMessageIndex(null);
      }

      updateTaskState(taskId, update);
    },
    [updateTaskState],
  );

  const restartTask = useCallback(
    (taskId: string) => {
      api.restartTask(baseDir, taskId);
      clearSession(taskId, false);
    },
    [api, baseDir, clearSession],
  );

  const setTodoItems = (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => {
    setTaskStateMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(taskId) || EMPTY_TASK_STATE;
      newMap.set(taskId, { ...current, todoItems: updateTodoItems(current.todoItems) });
      return newMap;
    });
  };

  const setQuestion = useCallback(
    (taskId: string, question: QuestionData | null) => {
      updateTaskState(taskId, { question });
    },
    [updateTaskState],
  );

  const setAiderModelsData = useCallback(
    (taskId: string, modelsData: ModelsData | null) => {
      updateTaskState(taskId, { aiderModelsData: modelsData });
    },
    [updateTaskState],
  );

  // TODO: move to main process
  const addInterruptedMessage = useCallback(
    (taskId: string) => {
      const interruptMessage: LogMessage = {
        id: uuidv4(),
        type: 'log',
        level: 'warning',
        content: t('messages.interrupted'),
      };

      setMessages(taskId, (prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), interruptMessage]);
      updateTaskState(taskId, {
        processing: false,
        question: null,
      });
    },
    [t, updateTaskState],
  );

  useEffect(() => {
    const subscribeForTaskEvents = (taskId: string) => {
      const setProcessing = (processing: boolean) => {
        updateTaskState(taskId, { processing });
      };

      const setAiderTotalCost = (aiderTotalCost: number) => {
        updateTaskState(taskId, { aiderTotalCost });
      };

      const setAllFiles = (allFiles: string[]) => {
        updateTaskState(taskId, { allFiles });
      };

      const setAutocompletionWords = (autocompletionWords: string[]) => {
        updateTaskState(taskId, { autocompletionWords });
      };

      const setTokensInfo = (tokensInfo: TokensInfoData | null) => {
        updateTaskState(taskId, { tokensInfo });
      };

      const handleResponseChunk = ({ messageId, chunk, reflectedMessage, promptContext }: ResponseChunkData) => {
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
                processing: true,
                promptContext,
              };
              processingResponseMessageMap.set(taskId, newResponseMessage);
              newMessages.push(newResponseMessage);
              setProcessing(true);

              return prevMessages.filter((message) => !isLoadingMessage(message)).concat(...newMessages);
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
      };

      const handleResponseCompleted = ({ messageId, usageReport, content, reflectedMessage, promptContext }: ResponseCompletedData) => {
        const processingMessage = processingResponseMessageMap.get(taskId);

        if (content) {
          setMessages(taskId, (prevMessages) => {
            // If no processing message exists, find the last response message
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

              // If no response message exists, create a new one
              const newResponseMessage: ResponseMessage = {
                id: messageId,
                type: 'response',
                content,
                processing: false,
                usageReport,
                promptContext,
              };
              messages.push(newResponseMessage);

              return prevMessages.filter((message) => !isLoadingMessage(message)).concat(...messages);
            }
          });
        } else if (processingMessage && processingMessage.id === messageId) {
          processingMessage.processing = false;
          processingMessage.usageReport = usageReport;
          processingMessage.promptContext = promptContext;
          processingMessage.content = content || processingMessage.content;
          setMessages(taskId, (prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
        } else {
          setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
        }

        if (usageReport) {
          if (usageReport.aiderTotalCost !== undefined) {
            setAiderTotalCost(usageReport.aiderTotalCost);
          }
        }

        setProcessing(false);
      };

      const handleCommandOutput = ({ command, output }: CommandOutputData) => {
        setMessages(taskId, (prevMessages) => {
          const lastMessage = prevMessages[prevMessages.length - 1];

          if (lastMessage && isCommandOutputMessage(lastMessage) && lastMessage.command === command) {
            const updatedLastMessage: CommandOutputMessage = {
              ...lastMessage,
              content: lastMessage.content + output,
            };
            return prevMessages.slice(0, -1).concat(updatedLastMessage);
          } else {
            const commandOutputMessage: CommandOutputMessage = {
              id: uuidv4(),
              type: 'command-output',
              command,
              content: output,
            };
            return prevMessages.filter((message) => !isLoadingMessage(message)).concat(commandOutputMessage);
          }
        });
      };

      const handleTodoTool = (toolName: string, args: Record<string, unknown> | undefined, response: string | undefined) => {
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
                    setTodoItems(taskId, parsedResponse.items);
                  }
                } catch {
                  // If response is not JSON, it might be a message like "No todo items found"
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
      };

      const handleTool = ({ id, serverName, toolName, args, response, usageReport, promptContext }: ToolData) => {
        if (serverName === TODO_TOOL_GROUP_NAME) {
          handleTodoTool(toolName, args as Record<string, unknown>, response);

          if (usageReport?.aiderTotalCost !== undefined) {
            setAiderTotalCost(usageReport.aiderTotalCost);
          }
          return;
        }

        const createNewToolMessage = () => {
          const toolMessage: ToolMessage = {
            id,
            type: 'tool',
            serverName,
            toolName,
            args: (args as Record<string, unknown> | undefined) || {},
            content: response || '',
            usageReport,
            promptContext,
          };
          return toolMessage;
        };

        setMessages(taskId, (prevMessages) => {
          const loadingMessages = prevMessages.filter(isLoadingMessage);
          const nonLoadingMessages = prevMessages.filter((message) => !isLoadingMessage(message) && message.id !== id);
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
            } as ToolMessage;
            return updatedMessages;
          } else {
            return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
          }
        });

        if (usageReport?.aiderTotalCost !== undefined) {
          setAiderTotalCost(usageReport.aiderTotalCost);
        }
      };

      const handleLog = ({ level, message, finished, promptContext }: LogData) => {
        if (level === 'loading') {
          if (finished) {
            // Mark all messages in the same group as finished before removing loading messages
            const currentGroupId = promptContext?.group?.id;
            if (currentGroupId) {
              setMessages(taskId, (prevMessages) =>
                prevMessages.map((msg) => {
                  const msgGroupId = msg.promptContext?.group?.id;
                  if (msgGroupId && msgGroupId === currentGroupId) {
                    // Create a new message object with updated promptContext.group.finished
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

            // Then remove loading messages
            setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
          } else {
            const loadingMessage: LoadingMessage = {
              id: uuidv4(),
              type: 'loading',
              content: message || t('messages.thinking'),
              promptContext,
            };

            setMessages(taskId, (prevMessages) => {
              const existingLoadingIndex = prevMessages.findIndex(isLoadingMessage);
              if (existingLoadingIndex !== -1) {
                // Update existing loading message
                const updatedMessages = [...prevMessages];
                updatedMessages[existingLoadingIndex] = {
                  ...updatedMessages[existingLoadingIndex],
                  content: loadingMessage.content,
                  promptContext,
                };

                return updatedMessages;
              } else {
                // Add new loading message
                return [...prevMessages, loadingMessage];
              }
            });
            setProcessing(true);
          }
        } else {
          const logMessage: LogMessage = {
            id: uuidv4(),
            type: 'log',
            level,
            content: message || '',
            promptContext,
          };
          setMessages(taskId, (prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), logMessage]);

          if (finished) {
            setProcessing(false);
          }
        }
      };

      const handleUpdateAutocompletion = ({ allFiles, words }: AutocompletionData) => {
        setAllFiles(allFiles);
        setAutocompletionWords([...words, ...allFiles]);
      };

      const handleTokensInfo = (data: TokensInfoData) => {
        setTokensInfo(data);
      };

      const handleQuestion = (data: QuestionData) => {
        setQuestion(taskId, data);
      };

      const handleUserMessage = (data: UserMessageData) => {
        const userMessage: UserMessage = {
          id: uuidv4(),
          type: 'user',
          content: data.content,
          promptContext: data.promptContext,
        };

        setMessages(taskId, (prevMessages) => {
          const loadingMessages = prevMessages.filter(isLoadingMessage);
          const nonLoadingMessages = prevMessages.filter((message) => !isLoadingMessage(message));
          return [...nonLoadingMessages, userMessage, ...loadingMessages];
        });
      };

      const handleClearProject = ({ clearMessages: messages, clearSession: session }: ClearTaskData) => {
        if (session) {
          clearSession(taskId, false);
        } else if (messages) {
          clearSession(taskId, true);
        }
      };

      const handleContextFilesUpdated = ({ files }: ContextFilesUpdatedData) => {
        updateTaskState(taskId, { contextFiles: files });
      };

      const handleUpdateAiderModels = (data: ModelsData) => {
        updateTaskState(taskId, { aiderModelsData: data });
        if (data.error) {
          // eslint-disable-next-line no-console
          console.error('Models data error:', data.error);
        }
      };

      const removeAutocompletionListener = api.addUpdateAutocompletionListener(baseDir, taskId, handleUpdateAutocompletion);
      const removeCommandOutputListener = api.addCommandOutputListener(baseDir, taskId, handleCommandOutput);
      const removeResponseChunkListener = api.addResponseChunkListener(baseDir, taskId, handleResponseChunk);
      const removeResponseCompletedListener = api.addResponseCompletedListener(baseDir, taskId, handleResponseCompleted);
      const removeLogListener = api.addLogListener(baseDir, taskId, handleLog);
      const removeTokensInfoListener = api.addTokensInfoListener(baseDir, taskId, handleTokensInfo);
      const removeAskQuestionListener = api.addAskQuestionListener(baseDir, taskId, handleQuestion);
      const removeToolListener = api.addToolListener(baseDir, taskId, handleTool);
      const removeUserMessageListener = api.addUserMessageListener(baseDir, taskId, handleUserMessage);
      const removeClearProjectListener = api.addClearTaskListener(baseDir, taskId, handleClearProject);
      const removeContextFilesListener = api.addContextFilesUpdatedListener(baseDir, taskId, handleContextFilesUpdated);
      const removeUpdateAiderModelsListener = api.addUpdateAiderModelsListener(baseDir, taskId, handleUpdateAiderModels);

      return () => {
        removeAutocompletionListener();
        removeCommandOutputListener();
        removeResponseChunkListener();
        removeResponseCompletedListener();
        removeLogListener();
        removeTokensInfoListener();
        removeAskQuestionListener();
        removeToolListener();
        removeUserMessageListener();
        removeClearProjectListener();
        removeContextFilesListener();
        removeUpdateAiderModelsListener();
      };
    };

    const unsubscribes: (() => void)[] = [];

    tasks.forEach((task) => {
      setTaskStateMap((prev) => {
        if (prev.has(task.id)) {
          return prev;
        }
        const newMap = new Map(prev);
        newMap.set(task.id, EMPTY_TASK_STATE);
        return newMap;
      });
      unsubscribes.push(subscribeForTaskEvents(task.id));
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [baseDir, tasks, api, updateTaskState, t, clearSession, setQuestion]);

  return (
    <TaskContext.Provider
      value={{
        getTaskState,
        clearSession,
        restartTask,
        addInterruptedMessage,
        setTodoItems,
        setQuestion,
        setMessages,
        setAiderModelsData,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};
