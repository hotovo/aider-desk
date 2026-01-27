import { useShallow } from 'zustand/react/shallow';
import { TaskData, DefaultTaskState } from '@common/types';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

const EMPTY_TASKS: TaskData[] = [];

interface ProjectStore {
  projectTasksMap: Map<string, TaskData[]>;

  setProjectTasks: (projectBaseDir: string, tasks: TaskData[]) => void;
  updateProjectTask: (projectBaseDir: string, taskData: TaskData) => void;
  addProjectTask: (projectBaseDir: string, taskData: TaskData) => void;
  removeProjectTask: (projectBaseDir: string, taskId: string) => void;
  clearProjectTasks: (projectBaseDir: string) => void;
}

export const useProjectStore = createWithEqualityFn<ProjectStore>(
  (set) => ({
    projectTasksMap: new Map(),

    setProjectTasks: (projectBaseDir, tasks) =>
      set((state) => {
        const newMap = new Map(state.projectTasksMap);
        newMap.set(projectBaseDir, tasks);
        return { projectTasksMap: newMap };
      }),

    updateProjectTask: (projectBaseDir, taskData) =>
      set((state) => {
        const newMap = new Map(state.projectTasksMap);
        const tasks = newMap.get(projectBaseDir) || [];
        newMap.set(
          projectBaseDir,
          tasks.map((task) => (task.id === taskData.id ? taskData : task)),
        );
        return { projectTasksMap: newMap };
      }),

    addProjectTask: (projectBaseDir, taskData) =>
      set((state) => {
        const newMap = new Map(state.projectTasksMap);
        const tasks = newMap.get(projectBaseDir) || [];
        newMap.set(projectBaseDir, [...tasks, taskData]);
        return { projectTasksMap: newMap };
      }),

    removeProjectTask: (projectBaseDir, taskId) =>
      set((state) => {
        const newMap = new Map(state.projectTasksMap);
        const tasks = newMap.get(projectBaseDir) || [];
        newMap.set(
          projectBaseDir,
          tasks.filter((task) => task.id !== taskId),
        );
        return { projectTasksMap: newMap };
      }),

    clearProjectTasks: (projectBaseDir) =>
      set((state) => {
        const newMap = new Map(state.projectTasksMap);
        newMap.delete(projectBaseDir);
        return { projectTasksMap: newMap };
      }),
  }),
  shallow,
);

export const useProjectTasks = (projectBaseDir: string) => useProjectStore(useShallow((state) => state.projectTasksMap.get(projectBaseDir) || EMPTY_TASKS));

export const useProjectProcessingState = (projectBaseDir: string) =>
  useProjectStore(
    useShallow((state) => {
      const tasks = state.projectTasksMap.get(projectBaseDir) || [];
      return tasks.some((task) => task.state === DefaultTaskState.InProgress);
    }),
  );
