import { AGENT_MODES, DefaultTaskState, Mode, Model, ModelsData, TaskData, TodoItem } from '@common/types';
import { forwardRef, useCallback, useDeferredValue, useEffect, useImperativeHandle, useMemo, useOptimistic, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResizableBox, ResizeCallbackData } from 'react-resizable';
import { clsx } from 'clsx';
import { getProviderModelId } from '@common/agent';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { useLocalStorage } from '@reactuses/core';
import { useHotkeys } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';

import { useSidebarWidth } from './useSidebarWidth';

import { Tooltip } from '@/components/ui/Tooltip';
import { isLogMessage, isTaskInfoMessage, isUserMessage, Message, TaskInfoMessage, UserMessage } from '@/types/message';
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
import { useSearchText } from '@/hooks/useSearchText';

type AddFileDialogOptions = {
  readOnly: boolean;
};

export type TaskViewRef = {
  exportMessagesToImage: () => void;
  focusPromptField: () => void;
};

const FILES_COLLAPSED_WIDTH = 36;

type Props = {
  projectDir: string;
  task: TaskData;
  updateTask: (taskId: string, updates: Partial<TaskData>, useOptimistic?: boolean) => void;
  updateOptimisticTaskState: (taskId: string, taskState: string) => void;
  inputHistory: string[];
  isActive?: boolean;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
  shouldFocusPrompt?: boolean;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
  onToggleTaskSidebar?: () => void;
};

export const TaskView = forwardRef<TaskViewRef, Props>(
  (
    {
      projectDir,
      task,
      updateTask,
      inputHistory,
      isActive = false,
      showSettingsPage,
      shouldFocusPrompt = false,
      updateOptimisticTaskState,
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
    const { loading, loaded, allFiles, contextFiles, autocompletionWords, tokensInfo, question, todoItems, aiderModelsData, queuedPrompts } = taskState;

    const messages = useTaskMessages(task.id);
    const deferredMessages = useDeferredValue(messages);
    const [displayedMessages, setDisplayedMessages] = useOptimistic(deferredMessages);
    const messagesPending = task.updatedAt && messages.length !== displayedMessages.length;

    const currentMode = task.currentMode || 'agent';

    const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [searchContainer, setSearchContainer] = useState<HTMLElement | null>(null);
    const [terminalVisible, setTerminalVisible] = useState(false);
    const [showSidebar, setShowSidebar] = useState(isMobile);
    const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth(projectDir, task.id);
    const [isFilesSidebarCollapsed, setIsFilesSidebarCollapsed] = useLocalStorage(`files-sidebar-collapsed-${projectDir}-${task.id}`, false);
    const { renderSearchInput } = useSearchText(searchContainer, 'absolute top-1 left-1', isActive);

    const inProgress = task.state === DefaultTaskState.InProgress;

    const promptFieldRef = useRef<PromptFieldRef>(null);
    const projectTopBarRef = useRef<TaskBarRef>(null);
    const messagesRef = useRef<MessagesRef | VirtualizedMessagesRef>(null);
    const terminalViewRef = useRef<TerminalViewRef | null>(null);
    const activeAgentProfile = useMemo(() => {
      return resolveAgentProfile(task, projectSettings?.agentProfileId, getProfiles(projectDir));
    }, [task, projectSettings?.agentProfileId, getProfiles, projectDir]);

    useEffect(() => {
      if (isActive && !taskState.loaded && !taskState.loading) {
        loadTask(task.id);
      }
    }, [isActive, loadTask, task.id, taskState.loaded, taskState.loading]);

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
      if (AGENT_MODES.includes(currentMode)) {
        if (activeAgentProfile) {
          model = models.find((m) => m.id === activeAgentProfile.model && m.providerId === activeAgentProfile.provider);
        }
      } else {
        model = models.find((m) => getProviderModelId(m) === aiderModelsData?.mainModel);
      }

      return model;
    }, [currentMode, activeAgentProfile, models, aiderModelsData?.mainModel]);
    const maxInputTokens = currentModel?.maxInputTokens || 0;

    const todoListVisible = useMemo(() => {
      return AGENT_MODES.includes(currentMode) && activeAgentProfile?.useTodoTools;
    }, [currentMode, activeAgentProfile?.useTodoTools]);

    const handleOpenModelSelector = useCallback(() => {
      projectTopBarRef.current?.openMainModelSelector();
    }, [projectTopBarRef]);

    const handleOpenAgentModelSelector = useCallback(() => {
      projectTopBarRef.current?.openAgentModelSelector();
    }, [projectTopBarRef]);

    const handleScrollToBottom = useCallback(() => {
      messagesRef.current?.scrollToBottom();
    }, [messagesRef]);

    const handleAddFiles = useCallback(
      (filePaths: string[], readOnly = false) => {
        for (const filePath of filePaths) {
          api.addFile(projectDir, task.id, filePath, readOnly);
        }
        setAddFileDialogOptions(null);
        promptFieldRef.current?.focus();
      },
      [api, projectDir, task.id, setAddFileDialogOptions, promptFieldRef],
    );

    const showFileDialog = useCallback((readOnly: boolean) => {
      setAddFileDialogOptions({
        readOnly,
      });
    }, []);

    const clearMessages = useCallback(
      (clearContext = true) => {
        clearSession(task.id, true);

        if (clearContext) {
          api.clearContext(projectDir, task.id);
        }
      },
      [clearSession, task.id, api, projectDir],
    );

    const toggleTerminal = useCallback(() => {
      setTerminalVisible(!terminalVisible);
    }, [terminalVisible]);

    const clearLogMessages = useCallback(() => {
      setMessages(task.id, (prevMessages) => prevMessages.filter((message) => !isLogMessage(message)));
    }, [setMessages, task.id]);

    const runCommand = useCallback(
      (command: string) => {
        api.runCommand(projectDir, task.id, command);
      },
      [api, projectDir, task.id],
    );

    const runTests = useCallback(
      (testCmd?: string) => {
        runCommand(`test ${testCmd || ''}`);
      },
      [runCommand],
    );

    const scrapeWeb = useCallback(
      async (url: string, filePath?: string) => {
        await api.scrapeWeb(projectDir, task.id, url, filePath);
      },
      [api, projectDir, task.id],
    );

    const handleModelChange = useCallback(
      (modelsData: ModelsData | null) => {
        setAiderModelsData(task.id, modelsData);
        promptFieldRef.current?.focus();
      },
      [task.id, setAiderModelsData, promptFieldRef],
    );

    const handleModeChange = useCallback(
      (mode: Mode) => {
        updateTask(task.id, { currentMode: mode });
      },
      [updateTask, task.id],
    );

    const handleMarkAsDone = useCallback(() => {
      updateTask(task.id, { state: DefaultTaskState.Done });
    }, [updateTask, task.id]);

    const runPrompt = useCallback(
      (prompt: string) => {
        updateOptimisticTaskState(task.id, DefaultTaskState.InProgress);
        if (editingMessageIndex !== null) {
          // This submission is an edit of a previous message
          setEditingMessageIndex(null); // Clear editing state
          setMessages(task.id, (prevMessages) => {
            return prevMessages
              .filter((_, index) => index <= editingMessageIndex)
              .map((message, index) => {
                if (index === editingMessageIndex) {
                  return {
                    ...message,
                    content: prompt,
                  };
                } else {
                  return message;
                }
              });
          });
          api.redoLastUserPrompt(projectDir, task.id, currentMode, prompt);
        } else {
          if (!question && !inProgress) {
            // OPTIMISTIC: Add user message immediately before backend response
            const optimisticUserMessage = {
              id: uuidv4(),
              type: 'user',
              content: prompt,
              isOptimistic: true,
            } satisfies UserMessage;
            setMessages(task.id, (prevMessages) => [...prevMessages, optimisticUserMessage]);
            setDisplayedMessages([...displayedMessages, optimisticUserMessage]);
          }
          api.runPrompt(projectDir, task.id, prompt, currentMode);
        }
      },
      [
        updateOptimisticTaskState,
        task.id,
        editingMessageIndex,
        setMessages,
        api,
        projectDir,
        currentMode,
        question,
        inProgress,
        setDisplayedMessages,
        displayedMessages,
      ],
    );

    const handleSavePrompt = useCallback(
      async (prompt: string) => {
        await api.savePrompt(projectDir, task.id, prompt);
      },
      [api, projectDir, task.id],
    );

    const handleEditLastUserMessage = useCallback(
      (content?: string) => {
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
      },
      [displayedMessages],
    );

    useEffect(() => {
      if (task.handoff && displayedMessages.length > 0) {
        setTimeout(() => {
          handleEditLastUserMessage();
        }, 0);

        updateTask(task.id, { handoff: false });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task.handoff, task.id, displayedMessages]);

    const handleResetTask = useCallback(() => {
      resetTask(task.id);
      setAiderModelsData(task.id, null);
    }, [resetTask, task.id, setAiderModelsData]);

    const handleRedoLastUserPrompt = useCallback(() => {
      const lastUserMessageIndex = displayedMessages.findLastIndex(isUserMessage);
      setMessages(task.id, (prevMessages) => {
        return prevMessages.filter((_, index) => index <= lastUserMessageIndex);
      });
      updateOptimisticTaskState(task.id, DefaultTaskState.InProgress);
      api.redoLastUserPrompt(projectDir, task.id, currentMode);
    }, [displayedMessages, setMessages, task.id, updateOptimisticTaskState, api, projectDir, currentMode]);

    const handleResumeTask = useCallback(() => {
      api.resumeTask(projectDir, task.id);
    }, [api, projectDir, task.id]);

    const handleRunPrompt = useCallback(
      (prompt: string) => {
        api.runPrompt(projectDir, task.id, prompt, currentMode);
      },
      [api, currentMode, projectDir, task.id],
    );

    const handleArchiveTask = useCallback(() => {
      onArchiveTask?.();
    }, [onArchiveTask]);

    const handleUnarchiveTask = useCallback(() => {
      onUnarchiveTask?.();
    }, [onUnarchiveTask]);

    const handleDeleteTask = useCallback(() => {
      onDeleteTask?.();
    }, [onDeleteTask]);

    const handleForkFromMessage = useCallback(
      async (message: Message) => {
        try {
          await api.forkTask(projectDir, task.id, message.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to fork task:', error);
          showErrorNotification(t('errors.forkTaskFailed'));
        }
      },
      [api, projectDir, task.id, t],
    );

    const handleRemoveMessage = useCallback(
      async (messageToRemove: Message) => {
        const originalMessages = displayedMessages;

        setMessages(task.id, (prevMessages) => prevMessages.filter((msg) => msg.id !== messageToRemove.id));

        if (isTaskInfoMessage(messageToRemove) || isLogMessage(messageToRemove)) {
          return;
        }

        try {
          await api.removeMessage(projectDir, task.id, messageToRemove.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to remove message:', error);
          setMessages(task.id, () => originalMessages);
          showErrorNotification(t('errors.removeMessageFailed'));
        }
      },
      [displayedMessages, setMessages, task.id, api, projectDir, t],
    );

    const handleRemoveUpToMessage = useCallback(
      async (messageToRemove: Message) => {
        const originalMessages = displayedMessages;

        // Optimistically remove the messages after it
        setMessages(task.id, (prevMessages) => {
          const messageIndex = prevMessages.findIndex((msg) => msg.id === messageToRemove.id);
          if (messageIndex === -1) {
            return prevMessages;
          }
          return prevMessages.slice(0, messageIndex + 1);
        });

        try {
          await api.removeMessagesUpTo(projectDir, task.id, messageToRemove.id);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to remove messages up to:', error);
          setMessages(task.id, () => originalMessages);
          showErrorNotification(t('errors.removeMessagesUpToFailed'));
        }
      },
      [displayedMessages, setMessages, task.id, api, projectDir, t],
    );

    const handleAddTodo = useCallback(
      async (name: string) => {
        try {
          const updatedTodos = await api.addTodo(projectDir, task.id, name);
          setTodoItems(task.id, () => updatedTodos);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error adding todo:', error);
        }
      },
      [api, projectDir, task.id, setTodoItems],
    );

    const handleToggleTodo = useCallback(
      async (name: string, completed: boolean) => {
        try {
          const updatedTodos = await api.updateTodo(projectDir, task.id, name, {
            completed,
          });
          setTodoItems(task.id, () => updatedTodos);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error toggling todo:', error);
        }
      },
      [api, projectDir, task.id, setTodoItems],
    );

    const handleUpdateTodo = useCallback(
      async (name: string, updates: Partial<TodoItem>) => {
        try {
          const updatedTodos = await api.updateTodo(projectDir, task.id, name, updates);
          setTodoItems(task.id, () => updatedTodos);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error updating todo:', error);
        }
      },
      [api, projectDir, task.id, setTodoItems],
    );

    const handleDeleteTodo = useCallback(
      async (name: string) => {
        try {
          const updatedTodos = await api.deleteTodo(projectDir, task.id, name);
          setTodoItems(task.id, () => updatedTodos);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error deleting todo:', error);
        }
      },
      [api, projectDir, task.id, setTodoItems],
    );

    const handleClearAllTodos = useCallback(async () => {
      try {
        const updatedTodos = await api.clearAllTodos(projectDir, task.id);
        setTodoItems(task.id, () => updatedTodos);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error clearing all todos:', error);
      }
    }, [api, projectDir, task.id, setTodoItems]);

    const handleShowTaskInfo = useCallback(() => {
      const taskInfo: TaskInfoMessage = {
        id: uuidv4(),
        type: 'task-info',
        content: '',
        task: JSON.parse(JSON.stringify(task)) as TaskData,
        messageCount: displayedMessages.length || 0,
      };
      setMessages(task.id, (prevMessages) => [...prevMessages, taskInfo]);
    }, [task, displayedMessages, setMessages]);

    const handleTerminalViewResize = useCallback(() => {
      terminalViewRef.current?.resize();
    }, [terminalViewRef]);

    const handleSidebarResize = useCallback(
      async (_, data: ResizeCallbackData) => {
        setSidebarWidth(data.size.width);
      },
      [setSidebarWidth],
    );

    const handleToggleFilesSidebarCollapse = useCallback(() => {
      setIsFilesSidebarCollapsed(!isFilesSidebarCollapsed);
    }, [isFilesSidebarCollapsed, setIsFilesSidebarCollapsed]);

    const handleCopyTerminalOutput = useCallback(
      (output: string) => {
        promptFieldRef.current?.appendText(output);
      },
      [promptFieldRef],
    );

    const handleAutoApproveChanged = useCallback(
      (autoApprove: boolean) => {
        updateTask(task.id, {
          autoApprove,
        });
      },
      [updateTask, task.id],
    );

    const handleAnswerQuestion = useCallback(
      (answer: string) => {
        answerQuestion(task.id, answer);
      },
      [answerQuestion, task.id],
    );

    const handleRemoveQueuedPrompt = useCallback(
      (id: string) => {
        api.removeQueuedPrompt(projectDir, task.id, id);
      },
      [api, projectDir, task.id],
    );

    const handleSendQueuedPromptNow = useCallback(
      (id: string) => {
        api.sendQueuedPromptNow(projectDir, task.id, id);
      },
      [api, projectDir, task.id],
    );

    const handleInterruptResponse = useCallback(
      (interruptId?: string) => {
        interruptResponse(task.id, interruptId);
        if (!interruptId) {
          // Only update task state if we're interrupting the entire task, not a specific agent
          updateOptimisticTaskState(task.id, DefaultTaskState.Interrupted);
        }
      },
      [interruptResponse, task.id, updateOptimisticTaskState],
    );

    const handleHandoff = useCallback(
      async (focus?: string) => {
        try {
          await api.handoffConversation(projectDir, task.id, focus);
        } catch (error) {
          showErrorNotification(error instanceof Error ? error.message : String(error));
        }
      },
      [api, projectDir, task.id],
    );

    const handleShowFileDialog = useCallback(() => {
      setAddFileDialogOptions({
        readOnly: false,
      });
    }, []);

    const setMessagesRef = useCallback((node: MessagesRef | VirtualizedMessagesRef | null) => {
      messagesRef.current = node;
      if (node?.container) {
        setSearchContainer(node.container);
      }
    }, []);

    const handleRefreshAllFiles = useCallback((useGit?: boolean) => refreshAllFiles(task.id, useGit), [refreshAllFiles, task.id]);

    if (!projectSettings || !settings) {
      return <LoadingOverlay message={t('common.loadingProjectSettings')} />;
    }

    return (
      <div className={clsx('h-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative', isMobile ? 'flex flex-col' : 'flex')}>
        {!loaded && <LoadingOverlay message={t('common.loadingTask')} />}
        {messagesPending && displayedMessages.length === 0 && <LoadingOverlay message={t('common.loadingMessages')} />}
        <div className="flex flex-col flex-grow overflow-hidden">
          <TaskBar
            ref={projectTopBarRef}
            baseDir={projectDir}
            task={task}
            modelsData={aiderModelsData}
            mode={currentMode}
            activeAgentProfile={activeAgentProfile}
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
                onHandoffTodo={handleHandoff}
                onClearAllTodos={handleClearAllTodos}
              />
            )}
            <div className="overflow-hidden flex-grow relative">
              {displayedMessages.length === 0 && !loading && !messagesPending && !inProgress ? (
                <WelcomeMessage onModeChange={handleModeChange} mode={currentMode} projectDir={projectDir} taskId={task.id} />
              ) : (
                <>
                  {settings.virtualizedRendering ? (
                    <VirtualizedMessages
                      ref={setMessagesRef}
                      baseDir={projectDir}
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
                      onRunPrompt={handleRunPrompt}
                      onArchiveTask={handleArchiveTask}
                      onUnarchiveTask={handleUnarchiveTask}
                      onDeleteTask={handleDeleteTask}
                      onInterrupt={handleInterruptResponse}
                    />
                  ) : (
                    <Messages
                      ref={setMessagesRef}
                      baseDir={projectDir}
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
                      onRunPrompt={handleRunPrompt}
                      onArchiveTask={handleArchiveTask}
                      onUnarchiveTask={handleUnarchiveTask}
                      onDeleteTask={handleDeleteTask}
                      onInterrupt={handleInterruptResponse}
                      onForkFromMessage={handleForkFromMessage}
                      onRemoveUpToMessage={handleRemoveUpToMessage}
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
                baseDir={projectDir}
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
                key={task.id}
                ref={promptFieldRef}
                baseDir={projectDir}
                taskId={task.id}
                task={task}
                inputHistory={inputHistory}
                processing={inProgress}
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
                queuedPrompts={queuedPrompts}
                removeQueuedPrompt={handleRemoveQueuedPrompt}
                sendQueuedPromptNow={handleSendQueuedPromptNow}
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
                handoffConversation={handleHandoff}
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
            {/* Expand/Collapse Button */}
            <Tooltip content={isFilesSidebarCollapsed ? t('common.expand') : t('common.collapse')}>
              <button
                className={clsx(
                  'absolute top-[50%] translate-y-[-50%] z-10 p-1.5 rounded-md hover:bg-bg-tertiary -mt-0.5',
                  isFilesSidebarCollapsed ? 'left-1' : 'transition-opacity opacity-0 group-hover:opacity-100 left-3',
                )}
                onClick={handleToggleFilesSidebarCollapse}
              >
                <RiMenuUnfold4Line className={clsx('w-4 h-4 text-text-primary transition-transform duration-300', !isFilesSidebarCollapsed && 'rotate-180')} />
              </button>
            </Tooltip>

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
                    baseDir={projectDir}
                    taskId={task.id}
                    allFiles={allFiles}
                    contextFiles={contextFiles}
                    tokensInfo={tokensInfo}
                    aiderTotalCost={task.aiderTotalCost}
                    maxInputTokens={currentModel?.maxInputTokens || 0}
                    clearMessages={clearMessages}
                    runCommand={runCommand}
                    resetTask={handleResetTask}
                    mode={currentMode}
                    showFileDialog={handleShowFileDialog}
                    task={task}
                    updateTask={updateTask}
                    refreshAllFiles={handleRefreshAllFiles}
                  />
                </div>
              </ResizableBox>
            )}
          </div>
        )}

        {addFileDialogOptions && (
          <AddFileDialog
            baseDir={projectDir}
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
            baseDir={projectDir}
            taskId={task.id}
            allFiles={allFiles}
            contextFiles={contextFiles}
            tokensInfo={tokensInfo}
            aiderTotalCost={task.aiderTotalCost}
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
