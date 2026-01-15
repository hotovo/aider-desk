import { DefaultTaskState, Mode, Model, ModelsData, ProjectData, TaskData, TodoItem } from '@common/types';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { ResizableBox, ResizeCallbackData } from 'react-resizable';
import { clsx } from 'clsx';
import { getProviderModelId } from '@common/agent';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { useLocalStorage } from '@reactuses/core';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';

import { useSidebarWidth } from './useSidebarWidth';

import { StyledTooltip } from '@/components/common/StyledTooltip';
import { isLogMessage, isUserMessage, Message, TaskInfoMessage } from '@/types/message';
import { Messages, MessagesRef } from '@/components/message/Messages';
import { VirtualizedMessages, VirtualizedMessagesRef } from '@/components/message/VirtualizedMessages';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { AddFileDialog } from '@/components/project/AddFileDialog';
import { TaskBar, TaskBarRef } from '@/components/project/TaskBar';
import { PromptField, PromptFieldRef } from '@/components/PromptField';
import { Button } from '@/components/common/Button';
import { TodoWindow } from '@/components/project/TodoWindow';
import { TerminalView, TerminalViewRef } from '@/components/terminal/TerminalView';
import { MobileSidebar } from '@/components/project/MobileSidebar';
import { FilesContextInfoContent } from '@/components/project/FilesContextInfoContent';
import { WelcomeMessage } from '@/components/project/WelcomeMessage';
import 'react-resizable/css/styles.css';
import { useSearchText } from '@/hooks/useSearchText';
import { useApi } from '@/contexts/ApiContext';
import { resolveAgentProfile } from '@/utils/agents';
import { useResponsive } from '@/hooks/useResponsive';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useTask } from '@/contexts/TaskContext';
import { useAgents } from '@/contexts/AgentsContext';
import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { useTaskMessages, useTaskState } from '@/stores/taskStore';
import { showErrorNotification } from '@/utils/notifications';

type AddFileDialogOptions = {
  readOnly: boolean;
};

export type TaskViewRef = {
  exportMessagesToImage: () => void;
  focusPromptField: () => void;
};

const FILES_COLLAPSED_WIDTH = 36;

type Props = {
  project: ProjectData;
  task: TaskData;
  updateTask: (updates: Partial<TaskData>, useOptimistic?: boolean) => void;
  inputHistory: string[];
  isActive?: boolean;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
  shouldFocusPrompt?: boolean;
  onProceed?: () => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
  onToggleTaskSidebar?: () => void;
};

export const TaskView = forwardRef<TaskViewRef, Props>(
  (
    {
      project,
      task,
      updateTask,
      inputHistory,
      isActive = false,
      showSettingsPage,
      shouldFocusPrompt = false,
      onProceed,
      onArchiveTask,
      onUnarchiveTask,
      onDeleteTask,
      onToggleTaskSidebar,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const { TASK_HOTKEYS } = useConfiguredHotkeys();
    const { projectSettings } = useProjectSettings();
    const { isMobile } = useResponsive();
    const api = useApi();
    const { models } = useModelProviders();
    const { loadTask, clearSession, resetTask, setMessages, setTodoItems, setAiderModelsData, answerQuestion, interruptResponse, refreshAllFiles } = useTask();
    const { getProfiles } = useAgents();

    const taskState = useTaskState(task.id);
    const messages = useTaskMessages(task.id);

    useEffect(() => {
      if (isActive && !taskState.loaded && !taskState.loading) {
        loadTask(task.id);
      }
    }, [isActive, loadTask, task.id, taskState.loaded, taskState.loading]);

    const aiderModelsData = taskState?.aiderModelsData || null;
    const currentMode = task.currentMode || 'agent';

    const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [terminalVisible, setTerminalVisible] = useLocalStorage(`terminal-visible-${project.baseDir}-${task.id}`, false);
    const [showSidebar, setShowSidebar] = useState(isMobile);
    const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth(project.baseDir, task.id);
    const [isFilesSidebarCollapsed, setIsFilesSidebarCollapsed] = useLocalStorage(`files-sidebar-collapsed-${project.baseDir}-${task.id}`, false);

    const promptFieldRef = useRef<PromptFieldRef>(null);
    const projectTopBarRef = useRef<TaskBarRef>(null);
    const messagesRef = useRef<MessagesRef | VirtualizedMessagesRef>(null);
    const terminalViewRef = useRef<TerminalViewRef | null>(null);
    const [messagesPending, startMessagesTransition] = useTransition();
    const [transitionMessages, setTransitionMessages] = useState<Message[]>([]);
    const [searchContainer, setSearchContainer] = useState<HTMLElement | null>(null);
    const activeAgentProfile = useMemo(() => {
      return resolveAgentProfile(task, projectSettings?.agentProfileId, getProfiles(project.baseDir));
    }, [task, projectSettings?.agentProfileId, getProfiles, project.baseDir]);

    const { renderSearchInput } = useSearchText(searchContainer, 'absolute top-1 left-1');

    useImperativeHandle(ref, () => ({
      exportMessagesToImage: () => {
        messagesRef.current?.exportToImage();
      },
      focusPromptField: () => {
        promptFieldRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (shouldFocusPrompt && isActive) {
        requestAnimationFrame(() => {
          promptFieldRef.current?.focus();
        });
      }
    }, [shouldFocusPrompt, isActive]);

    // Focus prompt field
    useHotkeys(
      TASK_HOTKEYS.FOCUS_PROMPT,
      (e) => {
        e.preventDefault();
        promptFieldRef.current?.focus();
      },
      {
        enabled: isActive,
        scopes: 'task',
        enableOnFormTags: true,
        enableOnContentEditable: true,
      },
    );

    const currentModel = useMemo(() => {
      let model: Model | undefined;
      if (currentMode === 'agent') {
        if (activeAgentProfile) {
          model = models.find((m) => m.id === activeAgentProfile.model && m.providerId === activeAgentProfile.provider);
        }
      } else {
        model = models.find((m) => getProviderModelId(m) === aiderModelsData?.mainModel);
      }

      return model;
    }, [currentMode, activeAgentProfile, models, aiderModelsData?.mainModel]);
    const maxInputTokens = currentModel?.maxInputTokens || 0;

    useEffect(() => {
      startMessagesTransition(() => {
        setTransitionMessages(messages);
      });
    }, [messages]);

    const todoListVisible = useMemo(() => {
      return currentMode === 'agent' && activeAgentProfile?.useTodoTools;
    }, [currentMode, activeAgentProfile?.useTodoTools]);

    const handleOpenModelSelector = useCallback(() => {
      projectTopBarRef.current?.openMainModelSelector();
    }, []);

    const handleOpenAgentModelSelector = useCallback(() => {
      projectTopBarRef.current?.openAgentModelSelector();
    }, []);

    const handleScrollToBottom = useCallback(() => {
      messagesRef.current?.scrollToBottom();
    }, []);

    if (!taskState) {
      return <LoadingOverlay message={t('common.loadingTask')} />;
    }

    const { loading, loaded, allFiles, contextFiles, autocompletionWords, aiderTotalCost, tokensInfo, question, todoItems } = taskState;

    const displayedMessages = messages;

    const handleAddFiles = (filePaths: string[], readOnly = false) => {
      for (const filePath of filePaths) {
        api.addFile(project.baseDir, task.id, filePath, readOnly);
      }
      setAddFileDialogOptions(null);
      promptFieldRef.current?.focus();
    };

    const showFileDialog = (readOnly: boolean) => {
      setAddFileDialogOptions({
        readOnly,
      });
    };

    const clearMessages = (clearContext = true) => {
      clearSession(task.id, true);

      if (clearContext) {
        api.clearContext(project.baseDir, task.id);
      }
    };

    const toggleTerminal = () => {
      setTerminalVisible(!terminalVisible);
    };

    const clearLogMessages = () => {
      setMessages(task.id, (prevMessages) => prevMessages.filter((message) => !isLogMessage(message)));
    };

    const runCommand = (command: string) => {
      api.runCommand(project.baseDir, task.id, command);
    };

    const runTests = (testCmd?: string) => {
      runCommand(`test ${testCmd || ''}`);
    };

    const scrapeWeb = async (url: string, filePath?: string) => {
      await api.scrapeWeb(project.baseDir, task.id, url, filePath);
    };

    const handleModelChange = (modelsData: ModelsData | null) => {
      setAiderModelsData(task.id, modelsData);
      promptFieldRef.current?.focus();
    };

    const handleModeChange = (mode: Mode) => {
      updateTask({ currentMode: mode });
    };

    const handleMarkAsDone = () => {
      updateTask({ state: DefaultTaskState.Done });
    };

    const runPrompt = (prompt: string) => {
      if (editingMessageIndex !== null) {
        // This submission is an edit of a previous message
        setEditingMessageIndex(null); // Clear editing state
        setMessages(task.id, (prevMessages) => {
          return prevMessages.slice(0, editingMessageIndex);
        });
        api.redoLastUserPrompt(project.baseDir, task.id, currentMode, prompt);
      } else {
        api.runPrompt(project.baseDir, task.id, prompt, currentMode);
      }
    };

    const handleSavePrompt = async (prompt: string) => {
      await api.savePrompt(project.baseDir, task.id, prompt);
    };

    const handleEditLastUserMessage = (content?: string) => {
      let contentToEdit = content;
      const messageIndex = displayedMessages.findLastIndex(isUserMessage);

      if (messageIndex === -1) {
        // eslint-disable-next-line no-console
        console.warn('No user message found to edit.');
        return;
      }

      if (contentToEdit === undefined) {
        const lastUserMessage = displayedMessages[messageIndex];
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

    const handleResetTask = () => {
      resetTask(task.id);
      setAiderModelsData(task.id, null);
    };

    const handleRedoLastUserPrompt = () => {
      api.redoLastUserPrompt(project.baseDir, task.id, currentMode);
    };

    const handleResumeTask = () => {
      api.resumeTask(project.baseDir, task.id);
    };

    const handleProceed = () => {
      onProceed?.();
    };

    const handleArchiveTask = () => {
      onArchiveTask?.();
    };

    const handleUnarchiveTask = () => {
      onUnarchiveTask?.();
    };

    const handleDeleteTask = () => {
      onDeleteTask?.();
    };

    const handleRemoveMessage = async (messageToRemove: Message) => {
      const originalMessages = messages;

      setMessages(task.id, (prevMessages) => prevMessages.filter((msg) => msg.id !== messageToRemove.id));

      try {
        await api.removeMessage(project.baseDir, task.id, messageToRemove.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to remove message:', error);
        setMessages(task.id, () => originalMessages);
        showErrorNotification(t('errors.removeMessageFailed'));
      }
    };

    const handleAddTodo = async (name: string) => {
      try {
        const updatedTodos = await api.addTodo(project.baseDir, task.id, name);
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error adding todo:', error);
      }
    };

    const handleToggleTodo = async (name: string, completed: boolean) => {
      try {
        const updatedTodos = await api.updateTodo(project.baseDir, task.id, name, {
          completed,
        });
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error toggling todo:', error);
      }
    };

    const handleUpdateTodo = async (name: string, updates: Partial<TodoItem>) => {
      try {
        const updatedTodos = await api.updateTodo(project.baseDir, task.id, name, updates);
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error updating todo:', error);
      }
    };

    const handleDeleteTodo = async (name: string) => {
      try {
        const updatedTodos = await api.deleteTodo(project.baseDir, task.id, name);
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error deleting todo:', error);
      }
    };

    const handleClearAllTodos = async () => {
      try {
        const updatedTodos = await api.clearAllTodos(project.baseDir, task.id);
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error clearing all todos:', error);
      }
    };

    const handleShowTaskInfo = () => {
      const taskInfo: TaskInfoMessage = {
        id: uuidv4(),
        type: 'task-info',
        content: '',
        task: JSON.parse(JSON.stringify(task)) as TaskData,
        messageCount: messages.length || 0,
      };
      setMessages(task.id, (prevMessages) => [...prevMessages, taskInfo]);
    };

    const handleTerminalViewResize = () => {
      terminalViewRef.current?.resize();
    };

    const handleSidebarResize = async (_, data: ResizeCallbackData) => {
      setSidebarWidth(data.size.width);
    };

    const handleToggleFilesSidebarCollapse = () => {
      setIsFilesSidebarCollapsed(!isFilesSidebarCollapsed);
    };

    const handleCopyTerminalOutput = (output: string) => {
      promptFieldRef.current?.appendText(output);
    };

    const handleAutoApproveChanged = (autoApprove: boolean) => {
      updateTask({
        autoApprove,
      });
    };

    const handleAnswerQuestion = (answer: string) => {
      answerQuestion(task.id, answer);
    };

    const handleInterruptResponse = () => {
      interruptResponse(task.id);
    };

    if (!projectSettings || !settings) {
      return <LoadingOverlay message={t('common.loadingProjectSettings')} />;
    }

    return (
      <div className={clsx('h-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative', isMobile ? 'flex flex-col' : 'flex')}>
        {!loaded && <LoadingOverlay message={t('common.loadingTask')} />}
        {messagesPending && transitionMessages.length === 0 && <LoadingOverlay message={t('common.loadingMessages')} />}
        <div className="flex flex-col flex-grow overflow-hidden">
          <TaskBar
            ref={projectTopBarRef}
            baseDir={project.baseDir}
            task={task}
            modelsData={aiderModelsData}
            mode={currentMode}
            onModelsChange={handleModelChange}
            runCommand={runCommand}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            onToggleTaskSidebar={onToggleTaskSidebar}
            updateTask={updateTask}
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
            <div className="overflow-hidden flex-grow relative">
              {displayedMessages.length === 0 && !loading && !messagesPending && task.state !== DefaultTaskState.InProgress ? (
                <WelcomeMessage onModeChange={handleModeChange} />
              ) : (
                <>
                  {settings.virtualizedRendering ? (
                    <VirtualizedMessages
                      ref={(node) => {
                        messagesRef.current = node;
                        if (node?.container) {
                          setSearchContainer(node.container);
                        }
                      }}
                      baseDir={project.baseDir}
                      taskId={task.id}
                      task={task}
                      messages={displayedMessages}
                      allFiles={allFiles}
                      renderMarkdown={settings.renderMarkdown}
                      removeMessage={handleRemoveMessage}
                      resumeTask={handleResumeTask}
                      redoLastUserPrompt={handleRedoLastUserPrompt}
                      editLastUserMessage={handleEditLastUserMessage}
                      onMarkAsDone={handleMarkAsDone}
                      onProceed={handleProceed}
                      onArchiveTask={handleArchiveTask}
                      onUnarchiveTask={handleUnarchiveTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  ) : (
                    <Messages
                      ref={(node) => {
                        messagesRef.current = node;
                        if (node?.container) {
                          setSearchContainer(node.container);
                        }
                      }}
                      baseDir={project.baseDir}
                      taskId={task.id}
                      task={task}
                      messages={displayedMessages}
                      allFiles={allFiles}
                      renderMarkdown={settings.renderMarkdown}
                      removeMessage={handleRemoveMessage}
                      resumeTask={handleResumeTask}
                      redoLastUserPrompt={handleRedoLastUserPrompt}
                      editLastUserMessage={handleEditLastUserMessage}
                      onMarkAsDone={handleMarkAsDone}
                      onProceed={handleProceed}
                      onArchiveTask={handleArchiveTask}
                      onUnarchiveTask={handleUnarchiveTask}
                      onDeleteTask={handleDeleteTask}
                    />
                  )}
                </>
              )}
            </div>
            <ResizableBox
              className="flex flex-col flex-shrink-0"
              height={terminalVisible ? (isMobile ? 150 : 200) : 0}
              width={Infinity}
              axis="y"
              resizeHandles={terminalVisible ? ['n'] : []}
              minConstraints={[Infinity, 100]}
              maxConstraints={[Infinity, isMobile ? window.innerHeight / 3 : window.innerHeight / 2]}
              onResize={handleTerminalViewResize}
            >
              <TerminalView
                ref={terminalViewRef}
                baseDir={project.baseDir}
                taskId={task.id}
                visible={terminalVisible}
                className="border-t border-border-dark-light flex-grow"
                onVisibilityChange={setTerminalVisible}
                onCopyOutput={handleCopyTerminalOutput}
              />
            </ResizableBox>
          </div>
          <div className={clsx('relative w-full flex-shrink-0 flex flex-col border-t border-border-dark-light', editingMessageIndex !== null && 'pt-1')}>
            <div className={clsx('p-4 pb-2', editingMessageIndex !== null && 'pt-1')}>
              {editingMessageIndex !== null && (
                <div className="flex items-center justify-between px-2 py-1 text-xs text-text-muted-light border-b border-border-default-dark mb-2">
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
                taskId={task.id}
                task={task}
                inputHistory={inputHistory}
                processing={task.state === DefaultTaskState.InProgress}
                mode={currentMode}
                onModeChanged={handleModeChange}
                runPrompt={runPrompt}
                savePrompt={handleSavePrompt}
                editLastUserMessage={handleEditLastUserMessage}
                isActive={isActive}
                allFiles={allFiles}
                words={autocompletionWords}
                clearMessages={clearMessages}
                scrapeWeb={scrapeWeb}
                showFileDialog={showFileDialog}
                addFiles={handleAddFiles}
                question={question}
                answerQuestion={handleAnswerQuestion}
                interruptResponse={handleInterruptResponse}
                runCommand={runCommand}
                runTests={runTests}
                redoLastUserPrompt={handleRedoLastUserPrompt}
                openModelSelector={handleOpenModelSelector}
                openAgentModelSelector={handleOpenAgentModelSelector}
                promptBehavior={settings.promptBehavior}
                clearLogMessages={clearLogMessages}
                toggleTerminal={api.isTerminalSupported() ? toggleTerminal : undefined}
                terminalVisible={terminalVisible}
                scrollToBottom={handleScrollToBottom}
                onAutoApproveChanged={handleAutoApproveChanged}
                showSettingsPage={showSettingsPage}
                showTaskInfo={handleShowTaskInfo}
              />
            </div>
          </div>
        </div>
        {!isMobile && (
          <div
            className="border-l border-border-dark-light flex flex-col flex-shrink-0 select-none relative group"
            style={{
              width: isFilesSidebarCollapsed ? FILES_COLLAPSED_WIDTH : sidebarWidth,
            }}
          >
            <StyledTooltip id="files-sidebar-tooltip" />

            {/* Expand/Collapse Button */}
            <button
              data-tooltip-id="files-sidebar-tooltip"
              data-tooltip-content={isFilesSidebarCollapsed ? t('common.expand') : t('common.collapse')}
              className={clsx(
                'absolute top-[50%] translate-y-[-50%] z-10 p-1.5 rounded-md hover:bg-bg-tertiary -mt-0.5',
                isFilesSidebarCollapsed ? 'left-1' : 'transition-opacity opacity-0 group-hover:opacity-100 left-3',
              )}
              onClick={handleToggleFilesSidebarCollapse}
            >
              <RiMenuUnfold4Line className={clsx('w-4 h-4 text-text-primary transition-transform duration-300', !isFilesSidebarCollapsed && 'rotate-180')} />
            </button>

            {/* Resizable wrapper for expanded state */}
            {!isFilesSidebarCollapsed && (
              <ResizableBox
                width={sidebarWidth}
                height={Infinity}
                minConstraints={[200, Infinity]}
                maxConstraints={[window.innerWidth - 100, Infinity]}
                axis="x"
                resizeHandles={['w']}
                className="flex flex-col h-full"
                onResize={handleSidebarResize}
              >
                <div className="flex flex-col h-full">
                  <FilesContextInfoContent
                    baseDir={project.baseDir}
                    taskId={task.id}
                    allFiles={allFiles}
                    contextFiles={contextFiles}
                    tokensInfo={tokensInfo}
                    aiderTotalCost={aiderTotalCost}
                    maxInputTokens={currentModel?.maxInputTokens || 0}
                    clearMessages={clearMessages}
                    runCommand={runCommand}
                    resetTask={handleResetTask}
                    mode={currentMode}
                    showFileDialog={() =>
                      setAddFileDialogOptions({
                        readOnly: false,
                      })
                    }
                    task={task}
                    updateTask={updateTask}
                    refreshAllFiles={(useGit) => refreshAllFiles(task.id, useGit)}
                  />
                </div>
              </ResizableBox>
            )}
          </div>
        )}

        {addFileDialogOptions && (
          <AddFileDialog
            baseDir={project.baseDir}
            taskId={task.id}
            onClose={() => {
              setAddFileDialogOptions(null);
              promptFieldRef.current?.focus();
            }}
            onAddFiles={handleAddFiles}
            initialReadOnly={addFileDialogOptions.readOnly}
          />
        )}
        {isMobile && (
          <MobileSidebar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            baseDir={project.baseDir}
            taskId={task.id}
            allFiles={allFiles}
            contextFiles={contextFiles}
            tokensInfo={tokensInfo}
            aiderTotalCost={aiderTotalCost}
            maxInputTokens={maxInputTokens}
            clearMessages={clearMessages}
            runCommand={runCommand}
            resetTask={handleResetTask}
            mode={currentMode}
            setAddFileDialogOptions={setAddFileDialogOptions}
            task={task}
            updateTask={updateTask}
            refreshAllFiles={(useGit) => refreshAllFiles(task.id, useGit)}
          />
        )}
      </div>
    );
  },
);

TaskView.displayName = 'TaskView';
