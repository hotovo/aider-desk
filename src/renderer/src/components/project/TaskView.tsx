import { Mode, Model, ModelsData, ProjectData, TaskData, TodoItem } from '@common/types';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { CgSpinner } from 'react-icons/cg';
import { ResizableBox } from 'react-resizable';
import { clsx } from 'clsx';
import { getActiveAgentProfile } from '@common/utils';
import { getProviderModelId } from '@common/agent';
import { useHotkeys } from 'react-hotkeys-hook';

import { isLogMessage, isResponseMessage, isToolMessage, isUserMessage, Message } from '@/types/message';
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
import { SidebarContent } from '@/components/project/SidebarContent';
import { WelcomeMessage } from '@/components/project/WelcomeMessage';
import 'react-resizable/css/styles.css';
import { useSearchText } from '@/hooks/useSearchText';
import { useApi } from '@/contexts/ApiContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useTask } from '@/contexts/TaskContext';
import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { getSortedVisibleTasks } from '@/utils/taskUtils';

type AddFileDialogOptions = {
  readOnly: boolean;
};

export type TaskViewRef = {
  exportMessagesToImage: () => void;
  focusPromptField: () => void;
};

type Props = {
  project: ProjectData;
  task: TaskData;
  updateTask: (updates: Partial<TaskData>, useOptimistic?: boolean) => void;
  inputHistory: string[];
  isActive?: boolean;
  shouldFocusPrompt?: boolean;
  allTasks?: TaskData[];
  onTaskSelect?: (taskId: string) => void;
  onCreateNewTask?: () => void;
  onDeleteTask?: (taskId: string) => void;
};

export const TaskView = forwardRef<TaskViewRef, Props>(
  (
    { project, task, updateTask, inputHistory, isActive = false, shouldFocusPrompt = false, allTasks = [], onTaskSelect, onCreateNewTask, onDeleteTask },
    ref,
  ) => {
    const { t } = useTranslation();
    const { settings } = useSettings();
    const { TASK_HOTKEYS } = useConfiguredHotkeys();
    const { projectSettings, saveProjectSettings } = useProjectSettings();
    const { isMobile } = useResponsive();
    const api = useApi();
    const { models } = useModelProviders();
    const { getTaskState, clearSession, restartTask, setMessages, setTodoItems, setAiderModelsData, answerQuestion, interruptResponse } = useTask();

    const taskState = getTaskState(task.id);
    const aiderModelsData = taskState?.aiderModelsData || null;

    const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [terminalVisible, setTerminalVisible] = useState(false);
    const [showSidebar, setShowSidebar] = useState(isMobile);

    const promptFieldRef = useRef<PromptFieldRef>(null);
    const projectTopBarRef = useRef<TaskBarRef>(null);
    const messagesRef = useRef<MessagesRef | VirtualizedMessagesRef>(null);
    const terminalViewRef = useRef<TerminalViewRef | null>(null);
    const [messagesPending, startMessagesTransition] = useTransition();
    const [transitionMessages, setTransitionMessages] = useState<Message[]>([]);
    const [searchContainer, setSearchContainer] = useState<HTMLElement | null>(null);

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

    const switchToTaskByIndex = useCallback(
      (index: number) => {
        const sortedTasks = getSortedVisibleTasks(allTasks, false, '');
        if (index < sortedTasks.length) {
          const targetTask = sortedTasks[index];
          if (targetTask && targetTask.id !== task.id && onTaskSelect) {
            onTaskSelect(targetTask.id);
          }
        }
      },
      [allTasks, task.id, onTaskSelect],
    );

    // Switch to specific task tabs (Ctrl + 1-9)
    useHotkeys(
      [
        TASK_HOTKEYS.SWITCH_TASK_1,
        TASK_HOTKEYS.SWITCH_TASK_2,
        TASK_HOTKEYS.SWITCH_TASK_3,
        TASK_HOTKEYS.SWITCH_TASK_4,
        TASK_HOTKEYS.SWITCH_TASK_5,
        TASK_HOTKEYS.SWITCH_TASK_6,
        TASK_HOTKEYS.SWITCH_TASK_7,
        TASK_HOTKEYS.SWITCH_TASK_8,
        TASK_HOTKEYS.SWITCH_TASK_9,
      ].join(','),
      (e) => {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        switchToTaskByIndex(index);
      },
      { enabled: isActive, scopes: 'task', enableOnFormTags: true, enableOnContentEditable: true },
      [allTasks, task.id, onTaskSelect, switchToTaskByIndex],
    );

    // Focus prompt field
    useHotkeys(
      TASK_HOTKEYS.FOCUS_PROMPT,
      (e) => {
        e.preventDefault();
        promptFieldRef.current?.focus();
      },
      { enabled: isActive, scopes: 'task', enableOnFormTags: true, enableOnContentEditable: true },
    );

    // Create new task
    useHotkeys(
      TASK_HOTKEYS.NEW_TASK,
      (e) => {
        e.preventDefault();
        if (onCreateNewTask) {
          onCreateNewTask();
        }
      },
      { enabled: isActive, scopes: 'task', enableOnFormTags: true, enableOnContentEditable: true },
      [onCreateNewTask],
    );

    // Close current task
    useHotkeys(
      TASK_HOTKEYS.CLOSE_TASK,
      (e) => {
        e.preventDefault();
        if (onDeleteTask) {
          onDeleteTask(task.id);
        }
      },
      { enabled: isActive, scopes: 'task', enableOnFormTags: true, enableOnContentEditable: true },
      [task.id, onDeleteTask],
    );

    const currentModel = useMemo(() => {
      let model: Model | undefined;
      if (projectSettings?.currentMode === 'agent') {
        const activeAgentProfile = getActiveAgentProfile(settings, projectSettings);
        if (activeAgentProfile) {
          model = models.find((m) => m.id === activeAgentProfile.model && m.providerId === activeAgentProfile.provider);
        }
      } else {
        model = models.find((m) => getProviderModelId(m) === aiderModelsData?.mainModel);
      }

      return model;
    }, [projectSettings, settings, models, aiderModelsData?.mainModel]);
    const maxInputTokens = currentModel?.maxInputTokens || 0;

    useEffect(() => {
      startMessagesTransition(() => {
        setTransitionMessages(taskState?.messages || []);
      });
    }, [taskState?.messages]);

    const todoListVisible = useMemo(() => {
      return projectSettings?.currentMode === 'agent' && getActiveAgentProfile(settings, projectSettings)?.useTodoTools;
    }, [projectSettings, settings]);

    const renderLoading = (message: string) => (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-bg-primary to-bg-primary-light z-10">
        <CgSpinner className="animate-spin w-8 h-8" />
        <div className="mt-2 text-xs text-center text-text-primary">{message}</div>
      </div>
    );

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
      return renderLoading(t('common.loadingTask'));
    }

    const { loading, loaded, processing, allFiles, contextFiles, autocompletionWords, aiderTotalCost, tokensInfo, question, todoItems, messages } = taskState;

    const displayedMessages = processing ? messages : transitionMessages;

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
      void saveProjectSettings({ currentMode: mode });
    };

    const runPrompt = (prompt: string) => {
      if (!projectSettings) {
        return;
      } // Should not happen if component is rendered

      if (editingMessageIndex !== null) {
        // This submission is an edit of a previous message
        setEditingMessageIndex(null); // Clear editing state
        setMessages(task.id, (prevMessages) => {
          return prevMessages.slice(0, editingMessageIndex);
        });
        api.redoLastUserPrompt(project.baseDir, task.id, projectSettings.currentMode, prompt);
      } else {
        api.runPrompt(project.baseDir, task.id, prompt, projectSettings.currentMode);
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

    const handleRestartTask = () => {
      restartTask(task.id);
      setAiderModelsData(task.id, null);
    };

    const handleRedoLastUserPrompt = () => {
      setMessages(task.id, (prevMessages) => {
        const lastUserMessageIndex = prevMessages.findLastIndex(isUserMessage);
        if (lastUserMessageIndex === -1) {
          return prevMessages;
        }

        // Keep messages up to and excluding the one being redone
        return prevMessages.slice(0, lastUserMessageIndex);
      });
      if (projectSettings) {
        // Ensure projectSettings is available
        api.redoLastUserPrompt(project.baseDir, task.id, projectSettings.currentMode);
      }
    };

    const handleRemoveMessage = (messageToRemove: Message) => {
      const isLastMessage = displayedMessages[displayedMessages.length - 1] === messageToRemove;

      if (isLastMessage && (isToolMessage(messageToRemove) || isUserMessage(messageToRemove) || isResponseMessage(messageToRemove))) {
        api.removeLastMessage(project.baseDir, task.id);
      }

      setMessages(task.id, (prevMessages) => prevMessages.filter((msg) => msg.id !== messageToRemove.id));
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

    const handleTerminalViewResize = () => {
      terminalViewRef.current?.resize();
    };

    const handleCopyTerminalOutput = (output: string) => {
      promptFieldRef.current?.appendText(output);
    };

    const handleAutoApproveChanged = (autoApprove: boolean) => {
      updateTask({
        autoApprove,
      });
    };

    if (!projectSettings || !settings) {
      return renderLoading(t('common.loadingProjectSettings'));
    }

    return (
      <div className={clsx('h-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative', isMobile ? 'flex flex-col' : 'flex')}>
        {!loaded && renderLoading(t('common.loadingTask'))}
        <div className="flex flex-col flex-grow overflow-hidden">
          <TaskBar
            ref={projectTopBarRef}
            baseDir={project.baseDir}
            task={task}
            modelsData={aiderModelsData}
            mode={projectSettings.currentMode}
            onModelsChange={handleModelChange}
            runCommand={runCommand}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
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
              {displayedMessages.length === 0 && !loading && !messagesPending && !processing ? (
                <WelcomeMessage />
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
                      messages={displayedMessages}
                      allFiles={allFiles}
                      renderMarkdown={settings.renderMarkdown}
                      removeMessage={handleRemoveMessage}
                      redoLastUserPrompt={handleRedoLastUserPrompt}
                      editLastUserMessage={handleEditLastUserMessage}
                      processing={processing}
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
                      messages={displayedMessages}
                      allFiles={allFiles}
                      renderMarkdown={settings.renderMarkdown}
                      removeMessage={handleRemoveMessage}
                      redoLastUserPrompt={handleRedoLastUserPrompt}
                      editLastUserMessage={handleEditLastUserMessage}
                      processing={processing}
                    />
                  )}
                  {messagesPending && transitionMessages.length === 0 && renderLoading(t('common.loadingMessages'))}
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
                processing={processing}
                mode={projectSettings.currentMode}
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
                answerQuestion={(answer) => answerQuestion(task.id, answer)}
                interruptResponse={() => interruptResponse(task.id)}
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
              />
            </div>
          </div>
        </div>
        {!isMobile && (
          <ResizableBox
            width={300}
            height={Infinity}
            minConstraints={[100, Infinity]}
            maxConstraints={[window.innerWidth - 300, Infinity]}
            axis="x"
            resizeHandles={['w']}
            className="border-l border-border-dark-light flex flex-col flex-shrink-0"
          >
            <div className="flex flex-col h-full">
              <SidebarContent
                baseDir={project.baseDir}
                taskId={task.id}
                allFiles={allFiles}
                contextFiles={contextFiles}
                tokensInfo={tokensInfo}
                aiderTotalCost={aiderTotalCost}
                maxInputTokens={currentModel?.maxInputTokens || 0}
                clearMessages={clearMessages}
                runCommand={runCommand}
                restartTask={handleRestartTask}
                mode={projectSettings.currentMode}
                showFileDialog={() =>
                  setAddFileDialogOptions({
                    readOnly: false,
                  })
                }
                projectSettings={projectSettings}
                saveProjectSettings={saveProjectSettings}
              />
            </div>
          </ResizableBox>
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
            restartTask={handleRestartTask}
            mode={projectSettings.currentMode}
            setAddFileDialogOptions={setAddFileDialogOptions}
            projectSettings={projectSettings}
            saveProjectSettings={saveProjectSettings}
          />
        )}
      </div>
    );
  },
);

TaskView.displayName = 'TaskView';
