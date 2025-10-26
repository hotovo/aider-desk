import { Mode, Model, ModelsData, ProjectData, TaskData, TodoItem } from '@common/types';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ResizableBox } from 'react-resizable';
import { clsx } from 'clsx';
import { getActiveAgentProfile } from '@common/utils';
import { getProviderModelId } from '@common/agent';

import { isLogMessage, isResponseMessage, isToolMessage, isUserMessage, Message } from '@/types/message';
import { Messages, MessagesRef } from '@/components/message/Messages';
import { VirtualizedMessages, VirtualizedMessagesRef } from '@/components/message/VirtualizedMessages';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { AddFileDialog } from '@/components/project/AddFileDialog';
import { ProjectBar, ProjectTopBarRef } from '@/components/project/ProjectBar';
import { PromptField, PromptFieldRef } from '@/components/PromptField';
import { Button } from '@/components/common/Button';
import { TodoWindow } from '@/components/project/TodoWindow';
import { TerminalView, TerminalViewRef } from '@/components/terminal/TerminalView';
import { MobileSidebar } from '@/components/project/MobileSidebar';
import { SidebarContent } from '@/components/project/SidebarContent';
import 'react-resizable/css/styles.css';
import { useSearchText } from '@/hooks/useSearchText';
import { useApi } from '@/contexts/ApiContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useTask } from '@/contexts/TaskContext';

type AddFileDialogOptions = {
  readOnly: boolean;
};

type Props = {
  project: ProjectData;
  task: TaskData;
  inputHistory: string[];
  isActive?: boolean;
};

export const TaskView = ({ project, task, inputHistory, isActive = false }: Props) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { projectSettings, saveProjectSettings } = useProjectSettings();
  const { isMobile } = useResponsive();
  const api = useApi();
  const { models } = useModelProviders();
  const { getTaskState, clearSession, restartTask, addInterruptedMessage, setMessages, setQuestion, setTodoItems, setAiderModelsData } = useTask();

  const taskState = getTaskState(task.id);
  const aiderModelsData = taskState?.aiderModelsData || null;

  const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [showSidebar, setShowSidebar] = useState(isMobile);

  const promptFieldRef = useRef<PromptFieldRef>(null);
  const projectTopBarRef = useRef<ProjectTopBarRef>(null);
  const messagesRef = useRef<MessagesRef | VirtualizedMessagesRef>(null);
  const terminalViewRef = useRef<TerminalViewRef | null>(null);
  const [messagesPending, startMessagesTransition] = useTransition();
  const [transitionMessages, setTransitionMessages] = useState<Message[]>([]);

  const { renderSearchInput } = useSearchText(messagesRef.current?.container || null, 'absolute top-1 left-1');

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

  const answerQuestion = (answer: string) => {
    if (question) {
      api.answerQuestion(project.baseDir, task.id, answer);
      setQuestion(task.id, null);
    }
  };

  const scrapeWeb = async (url: string, filePath?: string) => {
    await api.scrapeWeb(project.baseDir, task.id, url, filePath);
  };

  const handleInterruptResponse = () => {
    api.interruptResponse(project.baseDir, task.id);
    addInterruptedMessage(task.id);
  };

  const handleModelChange = (modelsData: ModelsData | null) => {
    setAiderModelsData(task.id, modelsData);
    promptFieldRef.current?.focus();
  };

  const handleModeChange = (mode: Mode) => {
    void saveProjectSettings({ currentMode: mode });
  };

  const runPrompt = (prompt: string) => {
    if (question) {
      setQuestion(task.id, null);
    }

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

  const exportMessagesToImage = () => {
    messagesRef.current?.exportToImage();
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

  if (!projectSettings || !settings) {
    return renderLoading(t('common.loadingProjectSettings'));
  }

  return (
    <div className={clsx('h-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative', isMobile ? 'flex flex-col' : 'flex')}>
      {!loaded && renderLoading(t('common.loadingTask'))}
      <div className="flex flex-col flex-grow overflow-hidden">
        <ProjectBar
          ref={projectTopBarRef}
          baseDir={project.baseDir}
          taskId={task.id}
          modelsData={aiderModelsData}
          mode={projectSettings.currentMode}
          onModelsChange={handleModelChange}
          onExportSessionToImage={exportMessagesToImage}
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
            {settings.virtualizedRendering ? (
              <VirtualizedMessages
                ref={messagesRef}
                baseDir={project.baseDir}
                messages={displayedMessages}
                allFiles={allFiles}
                renderMarkdown={settings.renderMarkdown}
                removeMessage={handleRemoveMessage}
                redoLastUserPrompt={handleRedoLastUserPrompt}
                editLastUserMessage={handleEditLastUserMessage}
              />
            ) : (
              <Messages
                ref={messagesRef}
                baseDir={project.baseDir}
                messages={displayedMessages}
                allFiles={allFiles}
                renderMarkdown={settings.renderMarkdown}
                removeMessage={handleRemoveMessage}
                redoLastUserPrompt={handleRedoLastUserPrompt}
                editLastUserMessage={handleEditLastUserMessage}
              />
            )}
            {messagesPending && transitionMessages.length === 0 && renderLoading(t('common.loadingMessages'))}
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
              promptBehavior={settings.promptBehavior}
              clearLogMessages={clearLogMessages}
              toggleTerminal={api.isTerminalSupported() ? toggleTerminal : undefined}
              terminalVisible={terminalVisible}
              scrollToBottom={messagesRef.current?.scrollToBottom}
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
};
