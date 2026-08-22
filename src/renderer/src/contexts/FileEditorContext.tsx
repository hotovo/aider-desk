import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@reactuses/core';

export type OpenEditorFile = {
  path: string;
  taskId: string;
};

type FileEditorContextValue = {
  openFiles: OpenEditorFile[];
  activeFilePath: string | null;
  isEditorOpen: boolean;
  openFile: (path: string, taskId: string) => void;
  closeTab: (path: string) => void;
  closeTabs: (paths: string[]) => void;
  setActiveFile: (path: string) => void;
  openEditor: () => void;
  closeEditor: () => void;
};

const FileEditorContext = createContext<FileEditorContextValue | null>(null);

export const FileEditorProvider = ({ projectDir, children }: { projectDir: string; children: ReactNode }) => {
  const [openFiles, setOpenFiles] = useLocalStorage<OpenEditorFile[]>(`file-editor-open-files-${projectDir}`, []);
  const [activeFilePath, setActiveFilePath] = useLocalStorage<string | null>(`file-editor-active-file-${projectDir}`, null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const files = useMemo(() => openFiles ?? [], [openFiles]);

  useEffect(() => {
    if (files.length === 0) {
      if (activeFilePath !== null) {
        setActiveFilePath(null);
      }
      return;
    }
    if (!activeFilePath || !files.some((file) => file.path === activeFilePath)) {
      setActiveFilePath(files[files.length - 1].path);
    }
  }, [files, activeFilePath, setActiveFilePath]);

  const openFile = useCallback(
    (path: string, taskId: string) => {
      setOpenFiles((prev) => [...(prev ?? []).filter((file) => file.path !== path), { path, taskId }]);
      setActiveFilePath(path);
      setIsEditorOpen(true);
    },
    [setActiveFilePath, setOpenFiles],
  );

  const closeTab = useCallback(
    (path: string) => {
      setOpenFiles((prev) => (prev ?? []).filter((file) => file.path !== path));
    },
    [setOpenFiles],
  );

  const closeTabs = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) {
        return;
      }
      const pathsSet = new Set(paths);
      setOpenFiles((prev) => (prev ?? []).filter((file) => !pathsSet.has(file.path)));
    },
    [setOpenFiles],
  );

  const setActiveFile = useCallback(
    (path: string) => {
      setActiveFilePath(path);
      setIsEditorOpen(true);
    },
    [setActiveFilePath],
  );

  const openEditor = useCallback(() => {
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      openFiles: files,
      activeFilePath,
      isEditorOpen,
      openFile,
      closeTab,
      closeTabs,
      setActiveFile,
      openEditor,
      closeEditor,
    }),
    [files, activeFilePath, isEditorOpen, openFile, closeTab, closeTabs, setActiveFile, openEditor, closeEditor],
  );

  return <FileEditorContext.Provider value={value}>{children}</FileEditorContext.Provider>;
};

export const useFileEditor = () => {
  const context = useContext(FileEditorContext);
  if (!context) {
    throw new Error('useFileEditor must be used within FileEditorProvider');
  }
  return context;
};
