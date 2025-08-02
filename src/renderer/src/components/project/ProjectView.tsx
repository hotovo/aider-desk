import {
  AgentRunCompletedData,
  AgentRunStartedData,
  AutocompletionData,
  CommandOutputData,
  InputHistoryData,
  LogData,
  Mode,
  ModelInfo,
  ModelsData,
  ProjectData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UserMessageData,
} from '@common/types';
import { useTranslation } from 'react-i18next';
import { IpcRendererEvent } from 'electron';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ResizableBox } from 'react-resizable';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { getActiveAgentProfile } from '@common/utils';
import { TODO_TOOL_CLEAR_ITEMS, TODO_TOOL_GET_ITEMS, TODO_TOOL_GROUP_NAME, TODO_TOOL_SET_ITEMS, TODO_TOOL_UPDATE_ITEM_COMPLETION } from '@common/tools';

import {
  CommandOutputMessage,
  GroupMessage,
  isCommandOutputMessage,
  isLoadingMessage,
  isLogMessage,
  isResponseMessage,
  isToolMessage,
  isUserMessage,
  LoadingMessage,
  LogMessage,
  Message,
  ReflectedMessage,
  ResponseMessage,
  ToolMessage,
  UserMessage,
} from '@/types/message';
import { ContextFiles } from '@/components/ContextFiles';
import { Messages, MessagesRef } from '@/components/message/Messages';
import { useSettings } from '@/context/SettingsContext';
import { useProjectSettings } from '@/context/ProjectSettingsContext';
import { AddFileDialog } from '@/components/project/AddFileDialog';
import { ProjectBar, ProjectTopBarRef } from '@/components/project/ProjectBar';
import { PromptField, PromptFieldRef } from '@/components/PromptField';
import { CostInfo } from '@/components/CostInfo';
import { Button } from '@/components/common/Button';
import { TodoWindow } from '@/components/project/TodoWindow';
import { TerminalView, TerminalViewRef } from '@/components/terminal/TerminalView';
import 'react-resizable/css/styles.css';
import { useSearchText } from '@/hooks/useSearchText';
import { useMessages } from '@/hooks/useMessages';

type AddFileDialogOptions = {
  readOnly: boolean;
};

type Props = {
  project: ProjectData;
  modelsInfo: Record<string, ModelInfo>;
  isActive?: boolean;
};

export const ProjectView = ({ project, modelsInfo, isActive = false }: Props) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const {
    messages,
    setMessages,
    addMessage,
    updateMessage,
    completeMessage,
    addCommandOutput,
    addToolMessage,
    addLogMessage,
    addLoadingMessage,
    removeLoadingMessage,
    addUserMessage,
    startGroup,
    endGroup,
    clearMessages: clearMessagesState,
    removeMessageById,
    setProcessingMessage,
    truncateMessages,
  } = useMessages();
  const [processing, setProcessing] = useState(false);
  const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [autocompletionWords, setAutocompletionWords] = useState<string[]>([]);
  const [aiderModelsData, setAiderModelsData] = useState<ModelsData | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiderTotalCost, setAiderTotalCost] = useState(0);
  const [tokensInfo, setTokensInfo] = useState<TokensInfoData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [terminalVisible, setTerminalVisible] = useState(false);

  const promptFieldRef = useRef<PromptFieldRef>(null);
  const projectTopBarRef = useRef<ProjectTopBarRef>(null);
  const messagesRef = useRef<MessagesRef>(null);
  const terminalViewRef = useRef<TerminalViewRef | null>(null);

  const { renderSearchInput } = useSearchText(messagesRef.current?.container || null, 'absolute top-1 left-1');

  const maxInputTokens = useMemo(() => {
    if (!projectSettings) {
      return 0;
    }
    if (projectSettings.currentMode === 'agent') {
      const activeAgentProfile = getActiveAgentProfile(settings, projectSettings);
      if (activeAgentProfile) {
        const modelParts = activeAgentProfile.model.split('/');

        return modelsInfo[modelParts[modelParts.length - 1]]?.maxInputTokens || 0;
      }
      return 0;
    } else {
      return aiderModelsData?.info?.max_input_tokens ?? 0;
    }
  }, [projectSettings, settings, modelsInfo, aiderModelsData?.info?.max_input_tokens]);

  const todoListVisible = useMemo(() => {
    return projectSettings?.currentMode === 'agent' && getActiveAgentProfile(settings, projectSettings)?.useTodoTools;
  }, [projectSettings, settings]);

  useEffect(() => {
    const handleProjectStarted = () => {
      setLoading(false);
    };
    const projectStartedListenerId = window.api.addProjectStartedListener(project.baseDir, handleProjectStarted);

    // Load existing todos
    const loadTodos = async () => {
      try {
        const todos = await window.api.getTodos(project.baseDir);
        setTodoItems(todos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading todos:', error);
      }
    };

    window.api.startProject(project.baseDir);
    void loadTodos();

    return () => {
      window.api.removeProjectStartedListener(projectStartedListenerId);
      window.api.stopProject(project.baseDir);
    };
  }, [project.baseDir]);

  useEffect(() => {
    const handleResponseChunk = (_: IpcRendererEvent, { messageId, chunk, reflectedMessage }: ResponseChunkData) => {
      const existingMessage = messages.find((m) => m.id === messageId);
      if (!existingMessage) {
        const newResponseMessage: ResponseMessage = {
          id: messageId,
          type: 'response',
          content: chunk,
          processing: true,
        };
        setProcessingMessage(newResponseMessage);
        addMessage(newResponseMessage, reflectedMessage);
        setProcessing(true);
      } else {
        updateMessage(messageId, chunk);
      }
    };

    const handleResponseCompleted = (_: IpcRendererEvent, { messageId, usageReport, content, reflectedMessage }: ResponseCompletedData) => {
      const responseMessage = messages.find((message) => message.id === messageId) as ResponseMessage | undefined;

      if (responseMessage) {
        completeMessage(messageId, usageReport, content);
      } else {
        const newResponseMessage: ResponseMessage = {
          id: messageId,
          type: 'response',
          content: content || '',
          processing: false,
          usageReport,
        };
        addMessage(newResponseMessage, reflectedMessage);
      }

      if (usageReport?.aiderTotalCost !== undefined) {
        setAiderTotalCost(usageReport.aiderTotalCost);
      }

      setProcessing(false);
    };

    const handleCommandOutput = (_: IpcRendererEvent, { command, output }: CommandOutputData) => {
      addCommandOutput(command, output);
    };

    const handleTodoTool = (toolName: string, args: Record<string, unknown> | undefined, response: string | undefined) => {
      try {
        switch (toolName) {
          case TODO_TOOL_SET_ITEMS: {
            if (args?.items && Array.isArray(args.items)) {
              setTodoItems(args.items as TodoItem[]);
            }
            break;
          }
          case TODO_TOOL_GET_ITEMS: {
            if (response) {
              try {
                const parsedResponse = JSON.parse(response);
                if (parsedResponse.items && Array.isArray(parsedResponse.items)) {
                  setTodoItems(parsedResponse.items);
                }
              } catch {
                // If response is not JSON, it might be a message like "No todo items found"
                if (response.includes('No todo items found')) {
                  setTodoItems([]);
                }
              }
            }
            break;
          }
          case TODO_TOOL_UPDATE_ITEM_COMPLETION: {
            if (args?.name && typeof args.completed === 'boolean') {
              setTodoItems((prev) => prev.map((item) => (item.name === args.name ? { ...item, completed: args.completed as boolean } : item)));
            }
            break;
          }
          case TODO_TOOL_CLEAR_ITEMS: {
            setTodoItems([]);
            break;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error handling TODO tool:', error);
      }
    };

    const handleTool = (_: IpcRendererEvent, { id, serverName, toolName, args, response, usageReport }: ToolData) => {
      if (serverName === TODO_TOOL_GROUP_NAME) {
        handleTodoTool(toolName, args, response);
        if (usageReport?.aiderTotalCost !== undefined) {
          setAiderTotalCost(usageReport.aiderTotalCost);
        }
        return;
      }
      addToolMessage({ id, type: 'tool', serverName, toolName, args: args || {}, content: response || '', usageReport });
      if (usageReport?.aiderTotalCost !== undefined) {
        setAiderTotalCost(usageReport.aiderTotalCost);
      }
    };

    const handleLog = (_: IpcRendererEvent, { level, message, finished }: LogData) => {
      if (level === 'loading') {
        if (finished) {
          removeLoadingMessage();
        } else {
          addLoadingMessage(message || t('messages.thinking'));
          setProcessing(true);
        }
      } else {
        addLogMessage({ level, content: message || '' });
        if (finished) {
          setProcessing(false);
        }
      }
    };

    const handleUpdateAutocompletion = (_: IpcRendererEvent, { allFiles, models, words }: AutocompletionData) => {
      setAllFiles(allFiles);
      setAvailableModels(models);
      setAutocompletionWords(words);
    };

    const handleUpdateAiderModels = (_: IpcRendererEvent, data: ModelsData) => {
      setAiderModelsData(data);
      setLoading(false);
      if (data.error) {
        addLogMessage({ level: 'error', content: data.error });
      }
    };

    const handleTokensInfo = (_: IpcRendererEvent, data: TokensInfoData) => {
      setTokensInfo(data);
    };

    const handleQuestion = (_: IpcRendererEvent, data: QuestionData) => {
      setQuestion(data);
    };

    const handleInputHistoryUpdate = (_: IpcRendererEvent, data: InputHistoryData) => {
      setInputHistory(data.messages);
    };

    const handleUserMessage = (_: IpcRendererEvent, data: UserMessageData) => {
      addUserMessage({
        mode: data.mode || projectSettings?.currentMode || 'code',
        content: data.content,
      });
    };

    const handleClearProject = (_: IpcRendererEvent, messages: boolean, session: boolean) => {
      if (session) {
        clearSession();
      } else if (messages) {
        clearMessages(false);
      }
    };

    const handleAgentRunStarted = (_: IpcRendererEvent, { id, prompt, profile, groupType }: AgentRunStartedData) => {
      startGroup(id, prompt, profile, groupType);
    };

    const handleAgentRunCompleted = () => {
      endGroup();
    };

    const autocompletionListenerId = window.api.addUpdateAutocompletionListener(project.baseDir, handleUpdateAutocompletion);
    const updateAiderModelsListenerId = window.api.addUpdateAiderModelsListener(project.baseDir, handleUpdateAiderModels);
    const commandOutputListenerId = window.api.addCommandOutputListener(project.baseDir, handleCommandOutput);
    const responseChunkListenerId = window.api.addResponseChunkListener(project.baseDir, handleResponseChunk);
    const responseCompletedListenerId = window.api.addResponseCompletedListener(project.baseDir, handleResponseCompleted);
    const logListenerId = window.api.addLogListener(project.baseDir, handleLog);
    const tokensInfoListenerId = window.api.addTokensInfoListener(project.baseDir, handleTokensInfo);
    const questionListenerId = window.api.addAskQuestionListener(project.baseDir, handleQuestion);
    const toolListenerId = window.api.addToolListener(project.baseDir, handleTool);
    const inputHistoryListenerId = window.api.addInputHistoryUpdatedListener(project.baseDir, handleInputHistoryUpdate);
    const userMessageListenerId = window.api.addUserMessageListener(project.baseDir, handleUserMessage);
    const clearProjectListenerId = window.api.addClearProjectListener(project.baseDir, handleClearProject);
    const agentRunStartedListenerId = window.api.addAgentRunStartedListener(project.baseDir, handleAgentRunStarted);
    const agentRunCompletedListenerId = window.api.addAgentRunCompletedListener(project.baseDir, handleAgentRunCompleted);

    return () => {
      window.api.removeUpdateAutocompletionListener(autocompletionListenerId);
      window.api.removeAiderModelsListener(updateAiderModelsListenerId);
      window.api.removeCommandOutputListener(commandOutputListenerId);
      window.api.removeResponseChunkListener(responseChunkListenerId);
      window.api.removeResponseCompletedListener(responseCompletedListenerId);
      window.api.removeLogListener(logListenerId);
      window.api.removeTokensInfoListener(tokensInfoListenerId);
      window.api.removeAskQuestionListener(questionListenerId);
      window.api.removeToolListener(toolListenerId);
      window.api.removeInputHistoryUpdatedListener(inputHistoryListenerId);
      window.api.removeUserMessageListener(userMessageListenerId);
      window.api.removeClearProjectListener(clearProjectListenerId);
      window.api.removeAgentRunStartedListener(agentRunStartedListenerId);
      window.api.removeAgentRunCompletedListener(agentRunCompletedListenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.baseDir, projectSettings?.currentMode]);

  const handleAddFiles = (filePaths: string[], readOnly = false) => {
    for (const filePath of filePaths) {
      window.api.addFile(project.baseDir, filePath, readOnly);
    }
    setAddFileDialogOptions(null);
    promptFieldRef.current?.focus();
  };

  const showFileDialog = (readOnly: boolean) => {
    setAddFileDialogOptions({
      readOnly,
    });
  };

  const clearSession = () => {
    clearMessagesState();
    setAiderTotalCost(0);
    setProcessing(false);
    setTokensInfo(null);
    setQuestion(null);
    setAiderModelsData(null);
    setEditingMessageIndex(null);
  };

  const clearMessages = (clearContext = true) => {
    clearMessagesState();
    setProcessing(false);

    if (clearContext) {
      window.api.clearContext(project.baseDir);
    }
  };

  const toggleTerminal = () => {
    setTerminalVisible(!terminalVisible);
  };

  const clearLogMessages = () => {
    setMessages((prevMessages) => prevMessages.filter((message) => !isLogMessage(message)));
  };

  const runCommand = (command: string) => {
    window.api.runCommand(project.baseDir, command);
  };

  const runTests = (testCmd?: string) => {
    runCommand(`test ${testCmd || ''}`);
  };

  const answerQuestion = (answer: string) => {
    if (question) {
      window.api.answerQuestion(project.baseDir, answer);
      setQuestion(null);
    }
  };

  const scrapeWeb = async (url: string, filePath?: string) => {
    setProcessing(true);
    addLoadingMessage(`Scraping ${url}...`);

    try {
      await window.api.scrapeWeb(project.baseDir, url, filePath);
    } catch (error) {
      if (error instanceof Error) {
        const getMessage = () => {
          if (error.message.includes('Cannot navigate to invalid URL')) {
            return `Invalid URL: ${url}`;
          } else if (error.message.includes('npx playwright install')) {
            return 'Playwright is not installed. Run `npx playwright install` in the terminal to install it and try again.';
          } else {
            return `Error during scraping: ${error.message}`;
          }
        };
        addLogMessage({ level: 'error', content: getMessage() });
      }
    } finally {
      removeLoadingMessage();
      setProcessing(false);
    }
  };

  const handleInterruptResponse = () => {
    window.api.interruptResponse(project.baseDir);
    addLogMessage({
      level: 'warning',
      content: t('messages.interrupted'),
    });
    setQuestion(null);
    setProcessing(false);
  };

  const handleModelChange = (modelsData: ModelsData | null) => {
    setAiderModelsData(modelsData);
    promptFieldRef.current?.focus();
  };

  const handleModeChange = (mode: Mode) => {
    void saveProjectSettings({ currentMode: mode });
  };

  const handleRenderMarkdownChanged = (renderMarkdown: boolean) => {
    void saveProjectSettings({ renderMarkdown });
  };

  const runPrompt = (prompt: string) => {
    if (question) {
      setQuestion(null);
    }

    if (!projectSettings) {
      return;
    } // Should not happen if component is rendered

    if (editingMessageIndex !== null) {
      // This submission is an edit of a previous message
      truncateMessages(editingMessageIndex);
      setEditingMessageIndex(null); // Clear editing state
      window.api.redoLastUserPrompt(project.baseDir, projectSettings.currentMode, prompt);
    } else {
      window.api.runPrompt(project.baseDir, prompt, projectSettings.currentMode);
    }
  };

  const handleEditLastUserMessage = (content?: string) => {
    let contentToEdit = content;
    const messageIndex = messages.findLastIndex(isUserMessage);

    if (messageIndex === -1) {
      // eslint-disable-next-line no-console
      console.warn('No user message found to edit.');
      return;
    }

    if (contentToEdit === undefined) {
      const lastUserMessage = messages[messageIndex];
      contentToEdit = lastUserMessage.content;
    }
    if (contentToEdit === undefined) {
      // eslint-disable-next-line no-console
      console.warn('Could not determine content to edit.');
      return;
    }

    setEditingMessageIndex(messageIndex);
    setTimeout(() => {
      promptFieldRef.current?.setText(contentToEdit);
      promptFieldRef.current?.focus();
    }, 0);
  };

  const restartProject = () => {
    setLoading(true);
    void window.api.restartProject(project.baseDir);
    clearSession();
  };

  const exportMessagesToImage = () => {
    messagesRef.current?.exportToImage();
  };

  const handleRedoLastUserPrompt = () => {
    const lastUserMessageIndex = messages.findLastIndex(isUserMessage);
    if (lastUserMessageIndex === -1) {
      return;
    }

    // Keep messages up to and excluding the one being redone
    truncateMessages(lastUserMessageIndex);
    if (projectSettings) {
      // Ensure projectSettings is available
      window.api.redoLastUserPrompt(project.baseDir, projectSettings.currentMode);
    }
  };

  const handleRemoveMessage = (messageToRemove: Message) => {
    const isLastMessage = messages[messages.length - 1] === messageToRemove;

    if (isLastMessage && (isToolMessage(messageToRemove) || isUserMessage(messageToRemove) || isResponseMessage(messageToRemove))) {
      window.api.removeLastMessage(project.baseDir);
    }

    removeMessageById(messageToRemove.id);
  };

  const handleAddTodo = async (name: string) => {
    try {
      const updatedTodos = await window.api.addTodo(project.baseDir, name);
      setTodoItems(updatedTodos);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error adding todo:', error);
    }
  };

  const handleToggleTodo = async (name: string, completed: boolean) => {
    try {
      const updatedTodos = await window.api.updateTodo(project.baseDir, name, {
        completed,
      });
      setTodoItems(updatedTodos);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error toggling todo:', error);
    }
  };

  const handleUpdateTodo = async (name: string, updates: Partial<TodoItem>) => {
    try {
      const updatedTodos = await window.api.updateTodo(project.baseDir, name, updates);
      setTodoItems(updatedTodos);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating todo:', error);
    }
  };

  const handleDeleteTodo = async (name: string) => {
    try {
      const updatedTodos = await window.api.deleteTodo(project.baseDir, name);
      setTodoItems(updatedTodos);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting todo:', error);
    }
  };

  const handleClearAllTodos = async () => {
    try {
      const updatedTodos = await window.api.clearAllTodos(project.baseDir);
      setTodoItems(updatedTodos);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error clearing all todos:', error);
    }
  };

  const handleTerminalViewResize = () => {
    terminalViewRef.current?.resize();
  };

  const handleCopyTerminalOutput = (output: string) => {
    promptFieldRef.current?.appendText(output);
  };

  if (!projectSettings || !settings) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 z-10">
        <CgSpinner className="animate-spin w-10 h-10" />
        <div className="mt-2 text-sm text-center text-white">{t('common.loadingProjectSettings')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gradient-to-b from-neutral-950 to-neutral-900 relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 z-10">
          <CgSpinner className="animate-spin w-10 h-10" />
          <div className="mt-2 text-sm text-center text-white">{t('common.startingUp')}</div>
        </div>
      )}
      <div className="flex flex-col flex-grow overflow-hidden">
        <ProjectBar
          ref={projectTopBarRef}
          baseDir={project.baseDir}
          modelsData={aiderModelsData}
          allModels={availableModels}
          mode={projectSettings.currentMode}
          renderMarkdown={projectSettings.renderMarkdown}
          onModelsChange={handleModelChange}
          onRenderMarkdownChanged={handleRenderMarkdownChanged}
          onExportSessionToImage={exportMessagesToImage}
          runCommand={runCommand}
        />
        <div className="flex-grow overflow-y-hidden relative flex flex-col">
          {renderSearchInput()}
          {!loading && todoItems.length > 0 && todoListVisible && (
            <TodoWindow
              todos={todoItems}
              onToggleTodo={handleToggleTodo}
              onAddTodo={handleAddTodo}
              onUpdateTodo={handleUpdateTodo}
              onDeleteTodo={handleDeleteTodo}
              onClearAllTodos={handleClearAllTodos}
            />
          )}
          <div className="overflow-hidden flex-grow">
            <Messages
              ref={messagesRef}
              baseDir={project.baseDir}
              messages={messages}
              allFiles={allFiles}
              renderMarkdown={projectSettings.renderMarkdown}
              removeMessage={handleRemoveMessage}
              redoLastUserPrompt={handleRedoLastUserPrompt}
              editLastUserMessage={handleEditLastUserMessage}
            />
          </div>
          <ResizableBox
            className="flex flex-col flex-shrink-0"
            height={terminalVisible ? 200 : 0}
            width={Infinity}
            axis="y"
            resizeHandles={terminalVisible ? ['n'] : []}
            minConstraints={[Infinity, 100]}
            maxConstraints={[Infinity, window.innerHeight / 2]}
            onResize={handleTerminalViewResize}
          >
            <TerminalView
              ref={terminalViewRef}
              baseDir={project.baseDir}
              visible={terminalVisible}
              className="border-t border-neutral-800 flex-grow"
              onVisibilityChange={setTerminalVisible}
              onCopyOutput={handleCopyTerminalOutput}
            />
          </ResizableBox>
        </div>
        <div className={clsx('relative w-full flex-shrink-0 flex flex-col border-t border-neutral-800', editingMessageIndex !== null && 'pt-1')}>
          <div className={clsx('p-4 pb-2', editingMessageIndex !== null && 'pt-1')}>
            {editingMessageIndex !== null && (
              <div className="flex items-center justify-between px-2 py-1 text-xs text-neutral-400 border-b border-neutral-700 mb-2">
                <span>{t('messages.editingLastMessage')}</span>
                <Button
                  size="xs"
                  variant="text"
                  onClick={() => {
                    setEditingMessageIndex(null);
                    promptFieldRef.current?.setText('');
                  }}
                >
                  {t('messages.cancelEdit')}
                </Button>
              </div>
            )}
            <PromptField
              ref={promptFieldRef}
              baseDir={project.baseDir}
              inputHistory={inputHistory}
              processing={processing}
              mode={projectSettings.currentMode}
              onModeChanged={handleModeChange}
              runPrompt={runPrompt}
              editLastUserMessage={handleEditLastUserMessage}
              isActive={isActive}
              words={autocompletionWords}
              clearMessages={clearMessages}
              scrapeWeb={scrapeWeb}
              showFileDialog={showFileDialog}
              addFiles={handleAddFiles}
              question={question}
              answerQuestion={answerQuestion}
              interruptResponse={handleInterruptResponse}
              runCommand={runCommand}
              runTests={runTests}
              redoLastUserPrompt={handleRedoLastUserPrompt}
              openModelSelector={projectTopBarRef.current?.openMainModelSelector}
              openAgentModelSelector={projectTopBarRef.current?.openAgentModelSelector}
              disabled={!aiderModelsData}
              promptBehavior={settings.promptBehavior}
              clearLogMessages={clearLogMessages}
              toggleTerminal={toggleTerminal}
              terminalVisible={terminalVisible}
            />
          </div>
        </div>
      </div>
      <ResizableBox
        width={300}
        height={Infinity}
        minConstraints={[100, Infinity]}
        maxConstraints={[window.innerWidth - 300, Infinity]}
        axis="x"
        resizeHandles={['w']}
        className="border-l border-neutral-800 flex flex-col flex-shrink-0"
      >
        <div className="flex flex-col h-full">
          <div className="flex-grow flex flex-col overflow-y-hidden">
            <ContextFiles
              baseDir={project.baseDir}
              allFiles={allFiles}
              showFileDialog={() =>
                setAddFileDialogOptions({
                  readOnly: false,
                })
              }
            />
          </div>
          <CostInfo
            tokensInfo={tokensInfo}
            aiderTotalCost={aiderTotalCost}
            maxInputTokens={maxInputTokens}
            clearMessages={clearMessages}
            refreshRepoMap={() => runCommand('map-refresh')}
            restartProject={restartProject}
            mode={projectSettings.currentMode}
          />
        </div>
      </ResizableBox>
      {addFileDialogOptions && (
        <AddFileDialog
          baseDir={project.baseDir}
          onClose={() => {
            setAddFileDialogOptions(null);
            promptFieldRef.current?.focus();
          }}
          onAddFiles={handleAddFiles}
          initialReadOnly={addFileDialogOptions.readOnly}
        />
      )}
    </div>
  );
};
