import { devtools } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

import type { OpenEditorFile } from '@/components/Workspace/FileEditorTabs';

type ProjectEditorState = {
  openFiles: OpenEditorFile[];
  activeFilePath: string | null;
  isEditorOpen: boolean;
};

type FileEditorStore = {
  projectsMap: Map<string, ProjectEditorState>;

  openFile: (projectDir: string, path: string, taskId: string) => void;
  openEditor: (projectDir: string) => void;
  closeTab: (projectDir: string, path: string) => void;
  closeTabs: (projectDir: string, paths: string[]) => void;
  setActiveFile: (projectDir: string, path: string) => void;
  closeEditor: (projectDir: string) => void;
  cleanupProject: (projectDir: string) => void;
};

const PERSIST_KEY = 'file-editor-open-files';

type PersistedState = Record<string, Pick<ProjectEditorState, 'openFiles' | 'activeFilePath'>>;

const loadPersistedState = (): PersistedState => {
  try {
    const stored = localStorage.getItem(PERSIST_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const savePersistedState = (state: PersistedState) => {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
};

const normalizeState = (state: ProjectEditorState): ProjectEditorState => {
  if (state.openFiles.length === 0) {
    return { ...state, activeFilePath: null };
  }
  if (!state.activeFilePath || !state.openFiles.some((file) => file.path === state.activeFilePath)) {
    return { ...state, activeFilePath: state.openFiles[state.openFiles.length - 1].path };
  }
  return state;
};

const getProjectState = (projectsMap: Map<string, ProjectEditorState>, projectDir: string): ProjectEditorState =>
  projectsMap.get(projectDir) ?? { openFiles: [], activeFilePath: null, isEditorOpen: false };

const withProjectState = (projectsMap: Map<string, ProjectEditorState>, projectDir: string, projectState: ProjectEditorState) => {
  const nextMap = new Map(projectsMap);
  nextMap.set(projectDir, projectState);
  const persisted: PersistedState = {};
  for (const [dir, state] of nextMap) {
    persisted[dir] = { openFiles: state.openFiles, activeFilePath: state.activeFilePath };
  }
  savePersistedState(persisted);
  return nextMap;
};

const initialProjectsMap = new Map<string, ProjectEditorState>(
  Object.entries(loadPersistedState()).map(([projectDir, persisted]) => [
    projectDir,
    normalizeState({ openFiles: persisted.openFiles ?? [], activeFilePath: persisted.activeFilePath ?? null, isEditorOpen: false }),
  ]),
);

const DEVTOOLS_OPTIONS = {
  name: 'FileEditorStore',
  enabled: import.meta.env.DEV,
  serialize: {
    options: {
      map: true,
      set: true,
    },
  },
};

export const useFileEditorStore = createWithEqualityFn<FileEditorStore>()(
  devtools(
    (set) => ({
      projectsMap: initialProjectsMap,

      openFile: (projectDir, path, taskId) =>
        set((state) => {
          const projectState = getProjectState(state.projectsMap, projectDir);
          const openFiles = [...projectState.openFiles.filter((file) => file.path !== path), { path, taskId }];
          return {
            projectsMap: withProjectState(
              state.projectsMap,
              projectDir,
              normalizeState({ ...projectState, openFiles, activeFilePath: path, isEditorOpen: true }),
            ),
          };
        }),

      openEditor: (projectDir) =>
        set((state) => {
          const projectState = getProjectState(state.projectsMap, projectDir);
          if (projectState.openFiles.length === 0) {
            return state;
          }
          return {
            projectsMap: withProjectState(state.projectsMap, projectDir, { ...projectState, isEditorOpen: true }),
          };
        }),

      closeTab: (projectDir, path) =>
        set((state) => {
          const projectState = getProjectState(state.projectsMap, projectDir);
          if (!projectState.openFiles.some((file) => file.path === path)) {
            return state;
          }
          const openFiles = projectState.openFiles.filter((file) => file.path !== path);
          const isEditorOpen = openFiles.length > 0 && projectState.isEditorOpen;
          return {
            projectsMap: withProjectState(state.projectsMap, projectDir, normalizeState({ ...projectState, openFiles, isEditorOpen })),
          };
        }),

      closeTabs: (projectDir, paths) =>
        set((state) => {
          if (paths.length === 0) {
            return state;
          }
          const projectState = getProjectState(state.projectsMap, projectDir);
          const pathsSet = new Set(paths);
          const openFiles = projectState.openFiles.filter((file) => !pathsSet.has(file.path));
          if (openFiles.length === projectState.openFiles.length) {
            return state;
          }
          const isEditorOpen = openFiles.length > 0 && projectState.isEditorOpen;
          return {
            projectsMap: withProjectState(state.projectsMap, projectDir, normalizeState({ ...projectState, openFiles, isEditorOpen })),
          };
        }),

      setActiveFile: (projectDir, path) =>
        set((state) => {
          const projectState = getProjectState(state.projectsMap, projectDir);
          return {
            projectsMap: withProjectState(state.projectsMap, projectDir, { ...projectState, activeFilePath: path, isEditorOpen: true }),
          };
        }),

      closeEditor: (projectDir) =>
        set((state) => {
          const projectState = getProjectState(state.projectsMap, projectDir);
          if (!projectState.isEditorOpen) {
            return state;
          }
          return {
            projectsMap: withProjectState(state.projectsMap, projectDir, { ...projectState, isEditorOpen: false }),
          };
        }),

      cleanupProject: (projectDir) =>
        set((state) => {
          if (!state.projectsMap.has(projectDir)) {
            return state;
          }
          const nextMap = new Map(state.projectsMap);
          nextMap.delete(projectDir);
          const persisted: PersistedState = {};
          for (const [dir, projectState] of nextMap) {
            persisted[dir] = { openFiles: projectState.openFiles, activeFilePath: projectState.activeFilePath };
          }
          savePersistedState(persisted);
          return { projectsMap: nextMap };
        }),
    }),
    DEVTOOLS_OPTIONS,
  ),
);

export const useProjectEditorState = (projectDir: string): ProjectEditorState => useFileEditorStore((state) => getProjectState(state.projectsMap, projectDir));

export const useFileEditorActions = () => useFileEditorStore.getState();
