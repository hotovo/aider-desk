import { useShallow } from 'zustand/react/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { devtools } from 'zustand/middleware';

interface TaskFilesStore {
  allFilesMap: Map<string, string[]>;
  autocompletionWordsMap: Map<string, string[]>;
  usageMap: Map<string, Set<string>>;
  taskDirByTaskIdMap: Map<string, string>;

  setAllFiles: (taskId: string, taskDir: string, allFiles: string[]) => void;
  setAutocompletionWords: (taskId: string, taskDir: string, autocompletionWords: string[]) => void;
  releaseTaskFiles: (taskId: string) => void;
}

const EMPTY_ALL_FILES: string[] = [];
const EMPTY_AUTOCOMPLETION_WORDS: string[] = [];

const DEVTOOLS_OPTIONS = {
  name: 'TaskFilesStore',
  enabled: import.meta.env.DEV,
  serialize: {
    options: {
      map: true,
      set: true,
    },
  },
};

const updateTaskDirTracking = (
  state: TaskFilesStore,
  taskId: string,
  newTaskDir: string,
): Pick<TaskFilesStore, 'allFilesMap' | 'autocompletionWordsMap' | 'usageMap' | 'taskDirByTaskIdMap'> => {
  const taskDirByTaskIdMap = new Map(state.taskDirByTaskIdMap);
  const usageMap = new Map(state.usageMap);
  const allFilesMap = new Map(state.allFilesMap);
  const autocompletionWordsMap = new Map(state.autocompletionWordsMap);

  const oldTaskDir = taskDirByTaskIdMap.get(taskId);
  if (oldTaskDir && oldTaskDir !== newTaskDir) {
    taskDirByTaskIdMap.delete(taskId);
    const oldUsers = usageMap.get(oldTaskDir);
    if (oldUsers) {
      const updatedOldUsers = new Set(oldUsers);
      updatedOldUsers.delete(taskId);
      if (updatedOldUsers.size === 0) {
        usageMap.delete(oldTaskDir);
        allFilesMap.delete(oldTaskDir);
        autocompletionWordsMap.delete(oldTaskDir);
      } else {
        usageMap.set(oldTaskDir, updatedOldUsers);
      }
    }
  }

  taskDirByTaskIdMap.set(taskId, newTaskDir);
  const currentUsers = usageMap.get(newTaskDir);
  if (!currentUsers) {
    usageMap.set(newTaskDir, new Set([taskId]));
  } else if (!currentUsers.has(taskId)) {
    usageMap.set(newTaskDir, new Set(currentUsers).add(taskId));
  }

  return { taskDirByTaskIdMap, usageMap, allFilesMap, autocompletionWordsMap };
};

export const useTaskFilesStore = createWithEqualityFn<TaskFilesStore>()(
  devtools(
    (set) => ({
      allFilesMap: new Map(),
      autocompletionWordsMap: new Map(),
      usageMap: new Map(),
      taskDirByTaskIdMap: new Map(),

      setAllFiles: (taskId, taskDir, allFiles) =>
        set((state) => {
          const tracking = updateTaskDirTracking(state, taskId, taskDir);
          const newAllFilesMap = new Map(tracking.allFilesMap);
          newAllFilesMap.set(taskDir, allFiles);
          return {
            ...tracking,
            allFilesMap: newAllFilesMap,
          };
        }),

      setAutocompletionWords: (taskId, taskDir, autocompletionWords) =>
        set((state) => {
          const tracking = updateTaskDirTracking(state, taskId, taskDir);
          const newAutocompletionWordsMap = new Map(tracking.autocompletionWordsMap);
          newAutocompletionWordsMap.set(taskDir, autocompletionWords);
          return {
            ...tracking,
            autocompletionWordsMap: newAutocompletionWordsMap,
          };
        }),

      releaseTaskFiles: (taskId) =>
        set((state) => {
          const taskDir = state.taskDirByTaskIdMap.get(taskId);
          if (!taskDir) {
            return state;
          }

          const taskDirByTaskIdMap = new Map(state.taskDirByTaskIdMap);
          taskDirByTaskIdMap.delete(taskId);

          const users = state.usageMap.get(taskDir);
          if (!users) {
            return { ...state, taskDirByTaskIdMap };
          }

          const updatedUsers = new Set(users);
          updatedUsers.delete(taskId);
          if (updatedUsers.size > 0) {
            return {
              ...state,
              taskDirByTaskIdMap,
              usageMap: new Map(state.usageMap).set(taskDir, updatedUsers),
            };
          }

          const usageMap = new Map(state.usageMap);
          usageMap.delete(taskDir);
          const allFilesMap = new Map(state.allFilesMap);
          allFilesMap.delete(taskDir);
          const autocompletionWordsMap = new Map(state.autocompletionWordsMap);
          autocompletionWordsMap.delete(taskDir);
          return {
            ...state,
            taskDirByTaskIdMap,
            usageMap,
            allFilesMap,
            autocompletionWordsMap,
          };
        }),
    }),
    DEVTOOLS_OPTIONS,
  ),
  shallow,
);

export const setTaskAllFiles = (taskId: string, taskDir: string, allFiles: string[]) => useTaskFilesStore.getState().setAllFiles(taskId, taskDir, allFiles);

export const setTaskAutocompletionWords = (taskId: string, taskDir: string, autocompletionWords: string[]) =>
  useTaskFilesStore.getState().setAutocompletionWords(taskId, taskDir, autocompletionWords);

export const releaseTaskFiles = (taskId: string) => useTaskFilesStore.getState().releaseTaskFiles(taskId);

export const useTaskAllFiles = (taskDir: string | undefined) =>
  useTaskFilesStore(useShallow((state) => (taskDir ? state.allFilesMap.get(taskDir) : undefined) ?? EMPTY_ALL_FILES));

export const useTaskAutocompletionWords = (taskDir: string | undefined) =>
  useTaskFilesStore(useShallow((state) => (taskDir ? state.autocompletionWordsMap.get(taskDir) : undefined) ?? EMPTY_AUTOCOMPLETION_WORDS));
