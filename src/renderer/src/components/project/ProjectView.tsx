import { InputHistoryData, ProjectStartMode, TaskCreatedData, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { Activity, startTransition, useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { useLocalStorage } from '@reactuses/core';
import { useHotkeys } from 'react-hotkeys-hook';
import { clsx } from 'clsx';

import { COLLAPSED_WIDTH, EXPANDED_WIDTH, TaskSidebar } from './TaskSidebar/TaskSidebar';

import { useProjectTasks, useProjectStore } from '@/stores/projectStore';
import { useSettings } from '@/contexts/SettingsContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { TaskView, TaskViewRef } from '@/components/project/TaskView';
import { useApi } from '@/contexts/ApiContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { getSortedVisibleTasks } from '@/utils/task-utils';
import { useResponsive } from '@/hooks/useResponsive';
import { useBooleanState } from '@/hooks/useBooleanState';
import { showNotification } from '@/utils/browser-notifications';

type Props = {
  projectDir: string;
  isProjectActive?: boolean;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
  initialTaskId?: string;
};

export const ProjectView = ({ projectDir, isProjectActive = false, showSettingsPage, initialTaskId }: Props) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { projectSettings } = useProjectSettings();
  const api = useApi();
  const { TASK_HOTKEYS } = useConfiguredHotkeys();
  const { isMobile } = useResponsive();

  const { setProjectTasks, updateProjectTask, addProjectTask, removeProjectTask, clearProjectTasks } = useProjectStore();
  const tasks = useProjectTasks(projectDir);
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(tasks);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [starting, setStarting] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [isTaskBarCollapsed, setIsTaskBarCollapsed] = useLocalStorage(`task-sidebar-collapsed-${projectDir}`, false);
  const [isTaskSidebarOpen, , hideTaskSidebar, toggleTaskSidebar] = useBooleanState();
  const [shouldFocusNewTask, setShouldFocusNewTask] = useState(false);
  const taskViewRef = useRef<TaskViewRef>(null);
  const creatingTaskRef = useRef(false);
  const activeTask = activeTaskId ? optimisticTasks.find((task) => task.id === activeTaskId) : null;
  const [isActiveTaskSwitching, startActiveTaskTransition] = useTransition();

  const focusActiveTaskPrompt = useCallback(() => {
    taskViewRef.current?.focusPromptField();
  }, []);

  const activateTask = useCallback(
    (taskId: string, shouldFocusActiveTaskPrompt = true, shouldFocusNewTask = false) => {
      startActiveTaskTransition(() => {
        setActiveTaskId(taskId);
        setShouldFocusNewTask(shouldFocusNewTask);
        if (shouldFocusActiveTaskPrompt) {
          focusActiveTaskPrompt();
        }
      });
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

      const mode = settings?.startupMode ?? ProjectStartMode.Empty;
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
      clearProjectTasks(projectDir);
    };
  }, [
    activateTask,
    api,
    projectDir,
    settings?.startupMode,
    clearProjectTasks,
    setProjectTasks,
    updateProjectTask,
    addProjectTask,
    removeProjectTask,
    initialTaskId,
  ]);

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
      const sortedTasks = getSortedVisibleTasks(optimisticTasks);
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

  const handleRunPrompt = useCallback(
    (prompt = 'Proceed.') => {
      if (!activeTask) {
        return;
      }
      api.runPrompt(projectDir, activeTask.id, prompt, activeTask.currentMode || 'code');
    },
    [activeTask, api, projectDir],
  );

  const handleArchiveActiveTask = useCallback(async () => {
    if (activeTaskId) {
      await handleUpdateTask(activeTaskId, { archived: true });
    }
  }, [activeTaskId, handleUpdateTask]);

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

  const handleExportTaskToImage = useCallback(() => {
    taskViewRef.current?.exportMessagesToImage();
  }, []);

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

  if (!projectSettings || !settings) {
    return <LoadingOverlay message={t('common.loadingProjectSettings')} />;
  }

  return (
    <TaskProvider baseDir={projectDir} tasks={tasks}>
      <div className="h-full w-full bg-gradient-to-b from-bg-primary to-bg-primary-light relative">
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
            onExportToMarkdown={handleExportTaskToMarkdown}
            onExportToImage={handleExportTaskToImage}
            onDuplicateTask={handleDuplicateTask}
            isMobile={isMobile}
            onClose={hideTaskSidebar}
          />
        )}

        <div
          className={clsx('absolute top-0 h-full transition-all duration-300 ease-in-out', isMobile ? 'left-0 right-0' : 'right-0')}
          style={{
            left: isMobile ? 0 : isTaskBarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
          }}
        >
          {isActiveTaskSwitching && <LoadingOverlay message={t('common.loadingTask')} animateOpacity />}
          {activeTask && (
            <Activity mode={isProjectActive ? 'visible' : 'hidden'}>
              <TaskView
                ref={taskViewRef}
                projectDir={projectDir}
                task={activeTask}
                updateTask={handleUpdateTask}
                updateOptimisticTaskState={handleUpdateOptimisticTaskState}
                inputHistory={inputHistory}
                isActive={activeTaskId === activeTask.id}
                shouldFocusPrompt={shouldFocusNewTask}
                showSettingsPage={showSettingsPage}
                onRunPrompt={handleRunPrompt}
                onArchiveTask={handleArchiveActiveTask}
                onUnarchiveTask={handleUnarchiveActiveTask}
                onDeleteTask={handleDeleteActiveTask}
                onToggleTaskSidebar={isMobile ? toggleTaskSidebar : undefined}
              />
            </Activity>
          )}
        </div>
      </div>
    </TaskProvider>
  );
};
