import { beforeEach, describe, expect, it } from 'vitest';

import { useFileEditorStore } from '../fileEditorStore';

const PROJECT_DIR = '/project';

describe('fileEditorStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useFileEditorStore.setState({ projectsMap: new Map() });
  });

  it('opens and closes the editor with no files', () => {
    useFileEditorStore.getState().openEditor(PROJECT_DIR);
    expect(useFileEditorStore.getState().projectsMap.get(PROJECT_DIR)).toEqual({
      openFiles: [],
      activeFilePath: null,
      isEditorOpen: true,
    });

    useFileEditorStore.getState().closeEditor(PROJECT_DIR);
    expect(useFileEditorStore.getState().projectsMap.get(PROJECT_DIR)?.isEditorOpen).toBe(false);
  });

  it.each(['closeTab', 'closeTabs'] as const)('keeps the editor open when %s removes the last file', (action) => {
    const store = useFileEditorStore.getState();
    store.openFile(PROJECT_DIR, 'file.ts', 'task-1');
    if (action === 'closeTab') {
      store.closeTab(PROJECT_DIR, 'file.ts');
    } else {
      store.closeTabs(PROJECT_DIR, ['file.ts']);
    }
    expect(useFileEditorStore.getState().projectsMap.get(PROJECT_DIR)).toEqual({
      openFiles: [],
      activeFilePath: null,
      isEditorOpen: true,
    });
  });

  it('selects an existing file without moving or replacing its tab', () => {
    const { openFile, closeEditor } = useFileEditorStore.getState();
    openFile(PROJECT_DIR, 'first.ts', 'task-1');
    openFile(PROJECT_DIR, 'second.ts', 'task-1');
    const openFiles = useFileEditorStore.getState().projectsMap.get(PROJECT_DIR)?.openFiles;
    closeEditor(PROJECT_DIR);

    openFile(PROJECT_DIR, 'first.ts', 'task-2');

    const projectState = useFileEditorStore.getState().projectsMap.get(PROJECT_DIR);
    expect(projectState?.openFiles).toBe(openFiles);
    expect(projectState?.openFiles).toEqual([
      { path: 'first.ts', taskId: 'task-1' },
      { path: 'second.ts', taskId: 'task-1' },
    ]);
    expect(projectState?.activeFilePath).toBe('first.ts');
    expect(projectState?.isEditorOpen).toBe(true);
  });

  it('appends and selects a file that is not already open', () => {
    const { openFile } = useFileEditorStore.getState();
    openFile(PROJECT_DIR, 'first.ts', 'task-1');
    openFile(PROJECT_DIR, 'second.ts', 'task-2');

    const projectState = useFileEditorStore.getState().projectsMap.get(PROJECT_DIR);
    expect(projectState?.openFiles).toEqual([
      { path: 'first.ts', taskId: 'task-1' },
      { path: 'second.ts', taskId: 'task-2' },
    ]);
    expect(projectState?.activeFilePath).toBe('second.ts');
    expect(projectState?.isEditorOpen).toBe(true);
  });
});
