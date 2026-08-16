import { AutonomyMode, InputHistoryData, ProjectStartMode, TaskCreatedData, TaskData, DefaultTaskState } from '@common/types';
import { useTranslation } from 'react-i18next';
import { Activity, startTransition, useCallback, useEffect, useOptimistic, useRef, useState } from 'react';
import { useLocalStorage } from '@reactuses/core';
import { useHotkeys } from 'react-hotkeys-hook';
import { clsx } from 'clsx';

import { COLLAPSED_WIDTH, EXPANDED_WIDTH, MIN_WIDTH, MAX_WIDTH, TaskSidebar } from './TaskSidebar/TaskSidebar';

import {
  useProjectTasks,
  setProjectTasks,
  updateProjectTask,
  addProjectTask,
  removeProjectTask,
  clearProjectTasks,
  useProjectStore,
} from '@/stores/projectStore';
import { unloadTasks } from '@/stores/taskStore';
import { releaseTaskFiles, useTaskAllFiles } from '@/stores/taskFilesStore';
import { getTaskDir, getSortedVisibleTasks } from '@/utils/task-utils';
import { cleanupProjectCache } from '@/stores/extensionUIStore';
import { cleanupProcessingResponseMessage } from '@/hooks/useTaskResponseHandlers';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { TaskView, TaskViewRef } from '@/components/project/TaskView';
import { useApi } from '@/contexts/ApiContext';
import { TasksProvider } from '@/contexts/TasksContext';
import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { useOverlayFocusRestore } from '@/hooks/useOverlayFocusRestore';
import { useResponsive } from '@/hooks/useResponsive';
import { useBooleanState } from '@/hooks/useBooleanState';
import { showNotification } from '@/utils/browser-notifications';
import { showInfoNotification } from '@/utils/notifications';
import { ExtensionsProvider } from '@/contexts/ExtensionsContext';
import { FloatingExtensionPanels } from '@/components/extensions/FloatingExtensionPanels';
import { useFileEditorStore } from '@/stores/fileEditorStore';
import { useActiveAgentProfile } from '@/utils/agents';
import { PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';
import { registerAction, unregisterAction } from '@/stores/actionsStore';
import { FileEditorModal } from '@/components/Workspace/FileEditorModal';

type Props = {
  projectDir: string;
  isProjectActive?: boolean;
  initialTaskId?: string;
};

export const ProjectView = ({ projectDir, isProjectActive = false, initialTaskId }: Props) => {
  const { t } = useTranslation();
  const startupMode = useSettingsStore((state) => state.settings?.startupMode);
  const windowTitleTemplate = useSettingsStore((state) => state.settings?.windowTitleTemplate);
  const settingsLoaded = useSettingsStore((state) => !!state.settings);
  const { projectSettings } = useProjectSettings();
  const api = useApi();
  const { TASK_HOTKEYS, PROJECT_HOTKEYS } = useConfiguredHotkeys();
  const { isMobile } = useResponsive();
  const replaceItems = useCommandPaletteStore((state) => state.replaceItems);
  const clearItems = useCommandPaletteStore((state) => state.clearItems);

  const tasks = useProjectTasks(projectDir);
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(tasks);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [starting, setStarting] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [isTaskBarCollapsed, setIsTaskBarCollapsed] = useLocalStorage(`task-sidebar-collapsed-${projectDir}`, false);
  const [taskSidebarWidth, setTaskSidebarWidth] = useLocalStorage(`task-sidebar-width-${projectDir}`, EXPANDED_WIDTH);
  const [isTaskSidebarOpen, , hideTaskSidebar, toggleTaskSidebar] = useBooleanState();
  const [shouldFocusNewTask, setShouldFocusNewTask] = useState(false);
  const taskViewRef = useRef<TaskViewRef>(null);
  const taskContentRef = useRef<HTMLDivElement>(null);
  const creatingTaskRef = useRef(false);
  const activeTask = activeTaskId ? optimisticTasks.find((task) => task.id === activeTaskId) : null;
  const activeTaskFiles = useTaskAllFiles(activeTask ? getTaskDir(activeTask) : undefined);
  const editorOpenFiles = useFileEditorStore((state) => state.projectsMap.get(projectDir)?.openFiles ?? []);
  const isEditorOpen = useFileEditorStore((state) => state.projectsMap.get(projectDir)?.isEditorOpen ?? false);
  const openFile = useFileEditorStore((state) => state.openFile);
  const openEditor = useFileEditorStore((state) => state.openEditor);
  const closeEditor = useFileEditorStore((state) => state.closeEditor);
  const agentProfile = useActiveAgentProfile(activeTask, projectDir) || undefined;

  const focusActiveTaskPrompt = useCallback(() => {
    taskViewRef.current?.focusPromptField();
  }, []);

  useOverlayFocusRestore(focusActiveTaskPrompt, isProjectActive);

  const activateTask = useCallback(
    (taskId: string, shouldFocusActiveTaskPrompt = true, shouldFocusNewTask = false) => {
      setActiveTaskId(taskId);
      setShouldFocusNewTask(shouldFocusNewTask);
      if (shouldFocusActiveTaskPrompt) {
        focusActiveTaskPrompt();
      }
    },
    [focusActiveTaskPrompt],
  );

  const createNewTask = useCallback(
    async (parentId?: string) => {
      if (creatingTaskRef.current || starting || tasksLoading) {
        return;
      }

      creatingTaskRef.current = true;

      try {
        const existingNewTask = tasks.find((task) => !task.createdAt && task.parentId === (parentId || null));
        if (existingNewTask) {
          if (activeTaskId === existingNewTask.id) {
            focusActiveTaskPrompt();
            return;
          }
          activateTask(existingNewTask.id);
          return;
        }

        const newTask = await api.createNewTask(projectDir, parentId ? { parentId } : undefined);
        activateTask(newTask.id, false, true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create new task:', error);
      } finally {
        creatingTaskRef.current = false;
      }
    },
    [starting, tasksLoading, tasks, api, projectDir, activateTask, activeTaskId, focusActiveTaskPrompt],
  );

  useHotkeys(
    TASK_HOTKEYS.NEW_TASK,
    (e) => {
      e.preventDefault();
      void createNewTask();
    },
    {
      scopes: 'task',
      enabled: isProjectActive,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [TASK_HOTKEYS.NEW_TASK, createNewTask, isProjectActive],
  );

  useEffect(() => {
    const handleStartupMode = async (tasks: TaskData[]) => {
      // Check if URL specifies a task to activate
      if (initialTaskId) {
        const initialTask = tasks.find((task) => task.id === initialTaskId);
        if (initialTask) {
          activateTask(initialTask.id);
          return;
        }
      }

      const mode = startupMode ?? ProjectStartMode.Empty;
      const existingNewTask = tasks.find((task) => !task.createdAt);
      let startupTask: TaskData | null = null;

      switch (mode) {
        case ProjectStartMode.Empty: {
          if (existingNewTask) {
            startupTask = existingNewTask;
          } else if (!creatingTaskRef.current) {
            creatingTaskRef.current = true;
            try {
              startupTask = await api.createNewTask(projectDir);
            } finally {
              creatingTaskRef.current = false;
            }
          }
          break;
        }
        case ProjectStartMode.Last: {
          startupTask = tasks.filter((task) => task.createdAt && task.updatedAt && !task.archived).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!))[0];

          if (!startupTask) {
            if (existingNewTask) {
              startupTask = existingNewTask;
            } else if (!creatingTaskRef.current) {
              creatingTaskRef.current = true;
              try {
                startupTask = await api.createNewTask(projectDir);
              } finally {
                creatingTaskRef.current = false;
              }
            }
          }
          break;
        }
      }

      if (startupTask) {
        activateTask(startupTask.id);
      }
    };

    const handleProjectStarted = () => {
      setStarting(false);
    };

    const handleTaskCreated = ({ task, activate }: TaskCreatedData) => {
      addProjectTask(projectDir, task);

      if (activate) {
        activateTask(task.id);
      }
    };

    const handleTaskInitialized = (taskData: TaskData) => {
      updateProjectTask(projectDir, taskData);
    };

    const handleTaskUpdated = (taskData: TaskData) => {
      const existingTask = useProjectStore
        .getState()
        .projectTasksMap.get(projectDir)
        ?.find((t) => t.id === taskData.id);
      if (existingTask && getTaskDir(existingTask) !== getTaskDir(taskData)) {
        releaseTaskFiles(taskData.id);
      }
      updateProjectTask(projectDir, taskData);
    };

    const handleTaskStarted = (taskData: TaskData) => {
      updateProjectTask(projectDir, taskData);
    };

    const handleTaskCompleted = (taskData: TaskData) => {
      updateProjectTask(projectDir, taskData);
    };

    const handleTaskCancelled = (taskData: TaskData) => {
      updateProjectTask(projectDir, taskData);
    };

    const handleTaskDeleted = (taskData: TaskData) => {
      removeProjectTask(projectDir, taskData.id);
      releaseTaskFiles(taskData.id);
    };

    const handleInputHistoryUpdate = (data: InputHistoryData) => {
      setInputHistory(data.inputHistory);
    };

    // Set up listeners
    const removeProjectStartedListener = api.addProjectStartedListener(projectDir, handleProjectStarted);
    const removeTaskCreatedListener = api.addTaskCreatedListener(projectDir, handleTaskCreated);
    const removeTaskInitializedListener = api.addTaskInitializedListener(projectDir, handleTaskInitialized);
    const removeTaskUpdatedListener = api.addTaskUpdatedListener(projectDir, handleTaskUpdated);
    const removeTaskStartedListener = api.addTaskStartedListener(projectDir, handleTaskStarted);
    const removeTaskCompletedListener = api.addTaskCompletedListener(projectDir, handleTaskCompleted);
    const removeTaskCancelledListener = api.addTaskCancelledListener(projectDir, handleTaskCancelled);
    const removeTaskDeletedListener = api.addTaskDeletedListener(projectDir, handleTaskDeleted);

    const removeNotificationListener = api.addNotificationListener(projectDir, (data) => {
      void showNotification(data.title, data.body);
    });

    const removeInputHistoryListener = api.addInputHistoryUpdatedListener(projectDir, handleInputHistoryUpdate);

    const initProject = async () => {
      try {
        // Start project
        setStarting(true);
        await api.startProject(projectDir);
        setStarting(false);

        // Load input history (may have been emitted before listener was registered)
        const history = await api.loadInputHistory(projectDir);
        setInputHistory(history);

        // Load tasks
        setTasksLoading(true);
        const tasks = await api.getTasks(projectDir);
        setProjectTasks(projectDir, tasks);
        setTasksLoading(false);

        // Handle startup mode
        await handleStartupMode(tasks);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load tasks:', error);
      }
    };

    void initProject();

    return () => {
      removeProjectStartedListener();
      removeTaskCreatedListener();
      removeTaskInitializedListener();
      removeTaskUpdatedListener();
      removeTaskStartedListener();
      removeTaskCompletedListener();
      removeTaskCancelledListener();
      removeTaskDeletedListener();
      removeNotificationListener();
      removeInputHistoryListener();

      const taskIds =
        useProjectStore
          .getState()
          .projectTasksMap.get(projectDir)
          ?.map((t) => t.id) || [];
      clearProjectTasks(projectDir);
      unloadTasks(taskIds);
      taskIds.forEach(releaseTaskFiles);
      taskIds.forEach(cleanupProcessingResponseMessage);
      cleanupProjectCache(projectDir);
    };
  }, [activateTask, api, projectDir, startupMode, initialTaskId]);

  const handleTaskSelect = useCallback(
    (taskId: string) => {
      if (activeTaskId === taskId) {
        focusActiveTaskPrompt();
        return;
      }

      activateTask(taskId, false);

      if (isMobile) {
        hideTaskSidebar();
      }
    },
    [activateTask, activeTaskId, focusActiveTaskPrompt, hideTaskSidebar, isMobile],
  );

  const switchToTaskByIndex = useCallback(
    (index: number) => {
      const allStates = new Set([...Object.values(DefaultTaskState)]);
      const sortedTasks = getSortedVisibleTasks(optimisticTasks, allStates, true);
      if (index < sortedTasks.length) {
        const targetTask = sortedTasks[index];
        if (targetTask && targetTask.id !== activeTaskId) {
          handleTaskSelect(targetTask.id);
        }
      }
    },
    [activeTaskId, handleTaskSelect, optimisticTasks],
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
    {
      enabled: isProjectActive,
      scopes: 'task',
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [optimisticTasks, activeTaskId, handleTaskSelect, switchToTaskByIndex],
  );

  const handleToggleCollapse = useCallback(() => {
    setIsTaskBarCollapsed(!isTaskBarCollapsed);
  }, [isTaskBarCollapsed, setIsTaskBarCollapsed]);

  const handleTaskSidebarResize = useCallback(
    (newWidth: number) => {
      setTaskSidebarWidth(Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH));
    },
    [setTaskSidebarWidth],
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<TaskData>, useOptimistic = true) => {
      startTransition(async () => {
        try {
          if (useOptimistic) {
            setOptimisticTasks((prev) =>
              prev.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      ...updates,
                    }
                  : task,
              ),
            );
          }
          await api.updateTask(projectDir, taskId, updates);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to update task:', error);
        }
      });
    },
    [api, projectDir, setOptimisticTasks],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      startTransition(async () => {
        try {
          setOptimisticTasks((prev) => prev.filter((task) => task.id !== taskId));
          await api.deleteTask(projectDir, taskId);
          if (activeTaskId === taskId) {
            await createNewTask();
          }
          // Task will be automatically removed via the existing handleTaskDeleted listener
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to delete task:', error);
        }
      });
    },
    [activeTaskId, api, createNewTask, projectDir, setOptimisticTasks],
  );

  const handleDeleteActiveTask = useCallback(async () => {
    if (activeTaskId) {
      await handleDeleteTask(activeTaskId);
    }
  }, [activeTaskId, handleDeleteTask]);

  const handleArchiveActiveTask = useCallback(async () => {
    if (activeTaskId) {
      await handleUpdateTask(activeTaskId, { archived: true });
      await createNewTask();
    }
  }, [activeTaskId, handleUpdateTask, createNewTask]);

  const handleUnarchiveActiveTask = useCallback(async () => {
    if (activeTaskId) {
      await handleUpdateTask(activeTaskId, { archived: false });
    }
  }, [activeTaskId, handleUpdateTask]);

  // Close current task
  useHotkeys(
    TASK_HOTKEYS.CLOSE_TASK,
    (e) => {
      e.preventDefault();
      void handleDeleteTask(activeTaskId!);
    },
    {
      enabled: !!activeTaskId,
      scopes: 'task',
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [activeTaskId, handleDeleteTask],
  );

  const handleOpenEditor = useCallback(() => {
    openEditor(projectDir);
  }, [openEditor, projectDir]);

  useHotkeys(
    PROJECT_HOTKEYS.OPEN_EDITOR,
    (e) => {
      e.preventDefault();
      handleOpenEditor();
    },
    {
      enabled: !!activeTaskId,
      scopes: 'task',
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [handleOpenEditor, PROJECT_HOTKEYS.OPEN_EDITOR],
  );

  const handleExportTaskToImage = useCallback(() => {
    taskViewRef.current?.exportMessagesToImage();
  }, []);

  useEffect(() => {
    if (!isProjectActive) {
      clearItems(`project:${projectDir}`);
      return;
    }

    const tasks = [...optimisticTasks]
      .sort((first, second) => (second.updatedAt || second.createdAt || '').localeCompare(first.updatedAt || first.createdAt || ''))
      .map((task) => ({
        id: `task.switch.${projectDir}.${task.id}`,
        label: task.name,
        state: task.state,
        archived: task.archived,
        type: PaletteItemType.Task,
        action: () => handleTaskSelect(task.id),
      }));
    const files = activeTaskFiles.map((filePath) => ({
      id: `file.open.${projectDir}.${filePath}`,
      label: filePath.split('/').pop() || filePath,
      description: filePath,
      type: PaletteItemType.File,
      action: () => {
        if (activeTaskId) {
          openFile(projectDir, filePath, activeTaskId);
        }
      },
    }));
    replaceItems(`project:${projectDir}`, [...tasks, ...files]);
  }, [isProjectActive, replaceItems, clearItems, activeTaskFiles, activeTaskId, handleTaskSelect, optimisticTasks, openFile, projectDir]);

  useEffect(() => {
    return () => clearItems(`project:${projectDir}`);
  }, [clearItems, projectDir]);

  const handleExportTaskToMarkdown = useCallback(
    async (taskId: string) => {
      try {
        await api.exportTaskToMarkdown(projectDir, taskId);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to export task to markdown:', error);
      }
    },
    [api, projectDir],
  );

  const handleCopyTaskAsMarkdown = useCallback(
    async (taskId: string) => {
      try {
        const markdown = await api.exportTaskToMarkdown(projectDir, taskId, true);
        if (markdown) {
          await api.writeToClipboard(markdown);
          showInfoNotification(t('taskSidebar.copiedAsMarkdown'));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy task as markdown:', error);
      }
    },
    [api, projectDir, t],
  );

  const handleDuplicateTask = useCallback(
    async (taskId: string) => {
      try {
        const duplicatedTask = await api.duplicateTask(projectDir, taskId);
        // Optionally switch to the new task
        handleTaskSelect(duplicatedTask.id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to duplicate task:', error);
      }
    },
    [api, projectDir, handleTaskSelect],
  );

  const handleUpdateOptimisticTaskState = useCallback(
    (taskId: string, taskState: string) => {
      startTransition(() => {
        setOptimisticTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  state: taskState,
                }
              : task,
          ),
        );
      });
    },
    [setOptimisticTasks],
  );

  useEffect(() => {
    if (!isProjectActive) {
      return;
    }

    const actions: Record<string, () => void> = {
      'task.new': () => void createNewTask(),
      'task.focusPrompt': focusActiveTaskPrompt,
      'editor.open': () => openEditor(projectDir),
      'task.modelSelector': () => taskViewRef.current?.openMainModelSelector(),
      'task.agentProfileSelector': () => taskViewRef.current?.openAgentProfileSelector(),
      'task.autonomy.manual': () => {
        if (activeTaskId) {
          void handleUpdateTask(activeTaskId, { autonomyMode: AutonomyMode.Manual });
        }
      },
      'task.autonomy.guided': () => {
        if (activeTaskId) {
          void handleUpdateTask(activeTaskId, { autonomyMode: AutonomyMode.Guided });
        }
      },
      'task.autonomy.autonomous': () => {
        if (activeTaskId) {
          void handleUpdateTask(activeTaskId, { autonomyMode: AutonomyMode.Autonomous });
        }
      },
      'task.archive': () => void handleArchiveActiveTask(),
      'task.unarchive': () => void handleUnarchiveActiveTask(),
      'task.delete': () => void handleDeleteActiveTask(),
      'task.duplicate': () => {
        if (activeTaskId) {
          void handleDuplicateTask(activeTaskId);
        }
      },
      'task.exportImage': handleExportTaskToImage,
      'task.exportMarkdown': () => {
        if (activeTaskId) {
          void handleExportTaskToMarkdown(activeTaskId);
        }
      },
      'task.copyMarkdown': () => {
        if (activeTaskId) {
          void handleCopyTaskAsMarkdown(activeTaskId);
        }
      },
      'task.interrupt': () => {
        if (activeTaskId) {
          void api.interruptResponse(projectDir, activeTaskId);
          handleUpdateOptimisticTaskState(activeTaskId, DefaultTaskState.Interrupted);
        }
      },
      'task.restartConnector': () => {
        if (activeTaskId) {
          api.restartAiderConnector(projectDir, activeTaskId);
        }
      },
      'task.togglePin': () => {
        if (activeTaskId) {
          const task = optimisticTasks.find((t) => t.id === activeTaskId);
          if (task) {
            void handleUpdateTask(activeTaskId, { pinned: !task.pinned });
          }
        }
      },
      'task.moveToTop': () => {
        if (activeTaskId) {
          void handleUpdateTask(activeTaskId, { updatedAt: new Date().toISOString() });
        }
      },
    };

    for (const [id, handler] of Object.entries(actions)) {
      registerAction(id, handler);
    }
    return () => {
      for (const id of Object.keys(actions)) {
        unregisterAction(id);
      }
    };
  }, [
    isProjectActive,
    createNewTask,
    focusActiveTaskPrompt,
    openEditor,
    projectDir,
    activeTaskId,
    handleUpdateTask,
    handleArchiveActiveTask,
    handleUnarchiveActiveTask,
    handleDeleteActiveTask,
    handleDuplicateTask,
    handleExportTaskToImage,
    handleExportTaskToMarkdown,
    handleCopyTaskAsMarkdown,
    api,
    handleUpdateOptimisticTaskState,
    optimisticTasks,
  ]);

  if (!projectSettings || !settingsLoaded) {
    return <LoadingOverlay message={t('common.loadingProjectSettings')} />;
  }

  return (
    <TasksProvider baseDir={projectDir} tasks={tasks} activeTaskId={activeTaskId}>
      <ExtensionsProvider projectDir={projectDir} agentProfile={agentProfile} activateTask={activateTask}>
        <div className="h-full w-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative">
          {isProjectActive && (
            <title>
              {(() => {
                const projectName = projectDir.split(/[\\/]/).pop() || '';
                const taskName = activeTask?.name || '';
                const template = windowTitleTemplate ?? 'AiderDesk - {project}';
                return template.replace('{project}', projectName).replace('{task}', taskName);
              })()}
            </title>
          )}
          {starting && <LoadingOverlay message={t('common.startingUp')} />}

          {(isTaskSidebarOpen || !isMobile) && (
            <TaskSidebar
              loading={tasksLoading}
              tasks={optimisticTasks}
              activeTaskId={activeTaskId}
              onTaskSelect={handleTaskSelect}
              createNewTask={createNewTask}
              className="h-full"
              isCollapsed={!!isTaskBarCollapsed}
              onToggleCollapse={handleToggleCollapse}
              updateTask={handleUpdateTask}
              deleteTask={handleDeleteTask}
              onCopyAsMarkdown={handleCopyTaskAsMarkdown}
              onExportToMarkdown={handleExportTaskToMarkdown}
              onExportToImage={handleExportTaskToImage}
              onDuplicateTask={handleDuplicateTask}
              isMobile={isMobile}
              onClose={hideTaskSidebar}
              width={taskSidebarWidth ?? EXPANDED_WIDTH}
              onResize={handleTaskSidebarResize}
              contentRef={taskContentRef}
            />
          )}

          <div
            ref={taskContentRef}
            className={clsx('absolute top-0 h-full transition-all duration-300 ease-in-out', isMobile ? 'left-0 right-0' : 'right-0')}
            style={{
              left: isMobile ? 0 : isTaskBarCollapsed ? COLLAPSED_WIDTH : (taskSidebarWidth ?? EXPANDED_WIDTH),
            }}
          >
            {isProjectActive && <FloatingExtensionPanels placement="project-floating" />}
            {activeTask && (
              <Activity mode={isProjectActive ? 'visible' : 'hidden'}>
                <ExtensionsProvider projectDir={projectDir} task={activeTask} agentProfile={agentProfile}>
                  <TaskView
                    key={activeTask.id}
                    ref={taskViewRef}
                    projectDir={projectDir}
                    task={activeTask}
                    updateTask={handleUpdateTask}
                    updateOptimisticTaskState={handleUpdateOptimisticTaskState}
                    inputHistory={inputHistory}
                    isActive={activeTaskId === activeTask.id}
                    shouldFocusPrompt={shouldFocusNewTask}
                    onArchiveTask={handleArchiveActiveTask}
                    onUnarchiveTask={handleUnarchiveActiveTask}
                    onDeleteTask={handleDeleteActiveTask}
                    onToggleTaskSidebar={isMobile ? toggleTaskSidebar : undefined}
                  />
                  <FloatingExtensionPanels placement="task-floating" />
                </ExtensionsProvider>
              </Activity>
            )}
          </div>
          {isEditorOpen && editorOpenFiles.length > 0 && <FileEditorModal baseDir={projectDir} onClose={() => closeEditor(projectDir)} />}
        </div>
      </ExtensionsProvider>
    </TasksProvider>
  );
};
