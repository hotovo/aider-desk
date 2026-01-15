import React, { createContext, ReactNode, useCallback, useContext, useEffect } from 'react';
import { usePrevious } from '@reactuses/core';
import {
  AutocompletionData,
  ClearTaskData,
  CommandOutputData,
  ContextFilesUpdatedData,
  DefaultTaskState,
  LogData,
  MessageRemovedData,
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
import { useTaskStore } from '@/stores/taskStore';

const processingResponseMessageMap = new Map<string, ResponseMessage>();

interface TaskEventSubscriberProps {
  baseDir: string;
  taskId: string;
  state?: string;
}

const TaskEventSubscriber: React.FC<TaskEventSubscriberProps> = ({ baseDir, taskId, state }) => {
  const api = useApi();
  const { t } = useTranslation();
  const previousState = usePrevious(state);
  const {
    updateTaskState,
    clearSession,
    setQuestion,
    setTodoItems,
    setMessages,
    setAllFiles,
    setAutocompletionWords,
    setTokensInfo,
    setAiderTotalCost,
    setAiderModelsData,
  } = useTaskStore();

  useEffect(() => {
    if (previousState === DefaultTaskState.InProgress && state !== DefaultTaskState.InProgress) {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
    }
  }, [previousState, setMessages, state, taskId]);

  useEffect(() => {
    const handleSetAiderTotalCost = (aiderTotalCost: number) => {
      setAiderTotalCost(taskId, aiderTotalCost);
    };

    const handleSetAllFiles = (allFiles: string[]) => {
      setAllFiles(taskId, allFiles);
    };

    const handleSetAutocompletionWords = (autocompletionWords: string[]) => {
      setAutocompletionWords(taskId, autocompletionWords);
    };

    const handleSetTokensInfo = (tokensInfo: TokensInfoData | null) => {
      setTokensInfo(taskId, tokensInfo);
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
              promptContext,
            };
            processingResponseMessageMap.set(taskId, newResponseMessage);
            newMessages.push(newResponseMessage);

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
              usageReport,
              promptContext,
            };
            messages.push(newResponseMessage);

            return prevMessages.filter((message) => !isLoadingMessage(message)).concat(...messages);
          }
        });
      } else if (processingMessage && processingMessage.id === messageId) {
        processingMessage.usageReport = usageReport;
        processingMessage.promptContext = promptContext;
        processingMessage.content = content || processingMessage.content;
        setMessages(taskId, (prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
      } else {
        setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
      }

      if (usageReport) {
        if (usageReport.aiderTotalCost !== undefined) {
          handleSetAiderTotalCost(usageReport.aiderTotalCost);
        }
      }

      processingResponseMessageMap.delete(taskId);
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
                  setTodoItems(taskId, () => parsedResponse.items);
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

    const handleTool = ({ id, serverName, toolName, args, response, usageReport, promptContext, finished }: ToolData) => {
      if (serverName === TODO_TOOL_GROUP_NAME) {
        handleTodoTool(toolName, args as Record<string, unknown>, response);

        if (usageReport?.aiderTotalCost !== undefined) {
          handleSetAiderTotalCost(usageReport.aiderTotalCost);
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
          finished,
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
            finished,
          } as ToolMessage;
          return updatedMessages;
        } else {
          return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
        }
      });

      if (usageReport?.aiderTotalCost !== undefined) {
        handleSetAiderTotalCost(usageReport.aiderTotalCost);
      }
    };

    const handleLog = ({ level, message, finished, promptContext, actionIds }: LogData) => {
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
        setMessages(taskId, (prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), logMessage]);
      }
    };

    const handleUpdateAutocompletion = ({ allFiles, words }: AutocompletionData) => {
      if (allFiles) {
        handleSetAllFiles(allFiles);
      }
      if (words) {
        handleSetAutocompletionWords(words);
      }
    };

    const handleTokensInfo = (data: TokensInfoData) => {
      handleSetTokensInfo(data);
    };

    const handleQuestion = (data: QuestionData) => {
      setQuestion(taskId, data);
    };

    const handleQuestionAnswered = () => {
      setQuestion(taskId, null);
    };

    const handleUserMessage = (data: UserMessageData) => {
      const userMessage: UserMessage = {
        id: data.id,
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
      setAiderModelsData(taskId, data);
      if (data.error) {
        // eslint-disable-next-line no-console
        console.error('Models data error:', data.error);
      }
    };

    const handleMessageRemoved = (data: MessageRemovedData) => {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !data.messageIds.includes(message.id)));
    };

    const removeAutocompletionListener = api.addUpdateAutocompletionListener(baseDir, taskId, handleUpdateAutocompletion);
    const removeCommandOutputListener = api.addCommandOutputListener(baseDir, taskId, handleCommandOutput);
    const removeResponseChunkListener = api.addResponseChunkListener(baseDir, taskId, handleResponseChunk);
    const removeResponseCompletedListener = api.addResponseCompletedListener(baseDir, taskId, handleResponseCompleted);
    const removeLogListener = api.addLogListener(baseDir, taskId, handleLog);
    const removeTokensInfoListener = api.addTokensInfoListener(baseDir, taskId, handleTokensInfo);
    const removeAskQuestionListener = api.addAskQuestionListener(baseDir, taskId, handleQuestion);
    const removeQuestionAnsweredListener = api.addQuestionAnsweredListener(baseDir, taskId, handleQuestionAnswered);
    const removeToolListener = api.addToolListener(baseDir, taskId, handleTool);
    const removeUserMessageListener = api.addUserMessageListener(baseDir, taskId, handleUserMessage);
    const removeClearProjectListener = api.addClearTaskListener(baseDir, taskId, handleClearProject);
    const removeContextFilesListener = api.addContextFilesUpdatedListener(baseDir, taskId, handleContextFilesUpdated);
    const removeUpdateAiderModelsListener = api.addUpdateAiderModelsListener(baseDir, taskId, handleUpdateAiderModels);
    const removeMessageRemovedListener = api.addMessageRemovedListener(baseDir, taskId, handleMessageRemoved);

    return () => {
      removeAutocompletionListener();
      removeCommandOutputListener();
      removeResponseChunkListener();
      removeResponseCompletedListener();
      removeLogListener();
      removeTokensInfoListener();
      removeAskQuestionListener();
      removeQuestionAnsweredListener();
      removeToolListener();
      removeUserMessageListener();
      removeClearProjectListener();
      removeContextFilesListener();
      removeUpdateAiderModelsListener();
      removeMessageRemovedListener();
    };
  }, [
    api,
    baseDir,
    taskId,
    updateTaskState,
    clearSession,
    setQuestion,
    setTodoItems,
    setMessages,
    setAllFiles,
    setAutocompletionWords,
    setTokensInfo,
    setAiderTotalCost,
    setAiderModelsData,
    t,
  ]);

  return null;
};

export interface TaskContextType {
  loadTask: (taskId: string) => void;
  clearSession: (taskId: string, messagesOnly: boolean) => void;
  resetTask: (taskId: string) => void;
  setMessages: (taskId: string, updateMessages: (prevState: Message[]) => Message[]) => void;
  setTodoItems: (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => void;
  setAiderModelsData: (taskId: string, modelsData: ModelsData | null) => void;
  answerQuestion: (taskId: string, answer: string) => void;
  interruptResponse: (taskId: string) => void;
  updateTaskAgentProfile: (taskId: string, agentProfileId: string, provider: string, model: string) => void;
  refreshAllFiles: (taskId: string, useGit?: boolean) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export const TaskProvider: React.FC<{
  baseDir: string;
  tasks: TaskData[];
  children: ReactNode;
}> = ({ baseDir, tasks, children }) => {
  const api = useApi();
  const { updateTaskState, clearSession, setMessages, setTodoItems, setAiderModelsData, setAllFiles } = useTaskStore();

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
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load task:', error);
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

  return (
    <TaskContext.Provider
      value={{
        loadTask,
        clearSession,
        resetTask,
        setTodoItems,
        setMessages,
        setAiderModelsData,
        answerQuestion,
        interruptResponse,
        updateTaskAgentProfile,
        refreshAllFiles,
      }}
    >
      {tasks.map((task) => (
        <TaskEventSubscriber key={task.id} baseDir={baseDir} taskId={task.id} state={task.state} />
      ))}
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
