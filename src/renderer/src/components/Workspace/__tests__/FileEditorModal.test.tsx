import { Activity, type ChangeEvent, type ComponentProps, type ReactNode } from 'react';
import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileEditorModal } from '../FileEditorModal';

import type CodeMirror from '@uiw/react-codemirror';
import type { TaskData } from '@common/types';

import { useProjectStore } from '@/stores/projectStore';
import { setTaskAllFiles, useTaskFilesStore } from '@/stores/taskFilesStore';
import { useFileEditorStore } from '@/stores/fileEditorStore';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { ContextMenuProvider } from '@/contexts/ContextMenuContext';
import { showSuccessNotification } from '@/utils/notifications';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const hotkeysMock = vi.hoisted(() => ({ enableScope: vi.fn(), disableScope: vi.fn() }));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
  useHotkeysContext: () => hotkeysMock,
}));

vi.mock('@codemirror/language-data', () => ({
  languages: [],
}));

const editorMock = vi.hoisted(() => ({ useRealEditor: false }));

vi.mock('@uiw/react-codemirror', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uiw/react-codemirror')>();
  return {
    ...actual,
    default: (props: ComponentProps<typeof CodeMirror>) => {
      if (editorMock.useRealEditor) {
        return <actual.default {...props} />;
      }
      const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        props.onChange?.(event.target.value, { docChanged: false } as Parameters<NonNullable<typeof props.onChange>>[1]);
      };
      return <textarea aria-label="code-editor" value={props.value} onChange={handleChange} />;
    },
  };
});

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/utils/notifications', () => ({
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
  showWarningNotification: vi.fn(),
}));

vi.mock('@/components/common/DiffViewer', () => ({
  DiffLineCommentPanel: () => null,
}));

vi.mock('../CommentsPanel', () => ({
  CommentsPanel: () => null,
}));

vi.mock('../FileEditorFileTree', () => ({
  FileEditorFileTree: ({ allFiles, onOpenFile }: { allFiles: string[]; onOpenFile: (path: string) => void }) => (
    <div>
      {allFiles.map((path) => (
        <button key={path} type="button" onClick={() => onOpenFile(path)}>
          tree-{path}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/common/ModalOverlayLayout', () => ({
  ModalOverlayLayout: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({ children, onConfirm, onCancel }: { children: ReactNode; onConfirm: () => void; onCancel: () => void }) => (
    <div>
      {children}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" onClick={onConfirm}>
        Discard
      </button>
    </div>
  ),
}));

vi.mock('@/components/common/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

type Props = { paths: Array<{ path: string; taskId: string }> };

const FileOpener = ({ paths }: Props) => {
  const openFile = useFileEditorStore((state) => state.openFile);
  return (
    <>
      {paths.map(({ path, taskId }) => (
        <button key={path} type="button" onClick={() => openFile('/project', path, taskId)}>
          open-{path}
        </button>
      ))}
    </>
  );
};

const ConditionalEditor = () => {
  const openFiles = useFileEditorStore((state) => state.projectsMap.get('/project')?.openFiles ?? []);
  const isEditorOpen = useFileEditorStore((state) => state.projectsMap.get('/project')?.isEditorOpen ?? false);
  const closeEditor = useFileEditorStore((state) => state.closeEditor);
  if (!isEditorOpen && openFiles.length === 0) {
    return null;
  }
  return (
    <Activity mode={isEditorOpen ? 'visible' : 'hidden'}>
      <FileEditorModal baseDir="/project" activeTaskId="task-1" onClose={() => closeEditor('/project')} />
    </Activity>
  );
};

const renderEditor = (files: Array<{ path: string; taskId: string }>) => {
  return render(
    <ContextMenuProvider>
      <FileOpener paths={files} />
      <ConditionalEditor />
    </ContextMenuProvider>,
  );
};

describe('FileEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorMock.useRealEditor = false;
    localStorage.clear();
    useFileEditorStore.setState({ projectsMap: new Map() });
    useProjectStore.setState({ projectTasksMap: new Map() });
    useTaskFilesStore.setState({ allFilesMap: new Map(), autocompletionWordsMap: new Map(), usageMap: new Map(), taskDirByTaskIdMap: new Map() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the current task file sidebar with no tabs and opens a file from it', async () => {
    const api = createMockApi({
      getAllFiles: vi.fn().mockResolvedValue(['file.ts']),
      readFile: vi.fn().mockResolvedValue('content'),
    });
    vi.mocked(useApi).mockReturnValue(api);
    useProjectStore.getState().setProjectTasks('/project', [{ id: 'task-1', baseDir: '/project', worktree: { path: '/worktree' } } as TaskData]);
    useFileEditorStore.getState().openEditor('/project');

    const { container } = renderEditor([]);

    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('code-editor')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
    expect(api.readFile).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'tree-file.ts' }));

    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('content'));
    expect(api.getAllFiles).toHaveBeenCalledWith('/project', 'task-1');
    expect(api.readFile).toHaveBeenCalledWith('/project', 'task-1', 'file.ts');
    expect(useTaskFilesStore.getState().allFilesMap.get('/worktree')).toEqual(['file.ts']);

    fireEvent.click(screen.getByLabelText('fileEditor.closeTab'));
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tree-file.ts' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'tree-file.ts' }));
    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('content'));
  });

  it('loads the missing file list for a restored worktree tab without loading its task', async () => {
    const api = createMockApi({
      readFile: vi.fn().mockResolvedValue('content'),
      getAllFiles: vi.fn().mockResolvedValue(['src/worktree.ts']),
    });
    vi.mocked(useApi).mockReturnValue(api);
    useProjectStore.getState().setProjectTasks('/project', [{ id: 'worktree-task', baseDir: '/project', worktree: { path: '/worktree' } } as TaskData]);
    setTaskAllFiles('main-task', '/project', ['src/main.ts']);
    useFileEditorStore.setState({
      projectsMap: new Map([
        ['/project', { openFiles: [{ path: 'src/worktree.ts', taskId: 'worktree-task' }], activeFilePath: 'src/worktree.ts', isEditorOpen: true }],
      ]),
    });

    renderEditor([]);

    await waitFor(() => expect(useTaskFilesStore.getState().allFilesMap.get('/worktree')).toEqual(['src/worktree.ts']));
    expect(api.getAllFiles).toHaveBeenCalledWith('/project', 'worktree-task');
    expect(api.loadTask).not.toHaveBeenCalled();
    expect(useTaskFilesStore.getState().allFilesMap.get('/project')).toEqual(['src/main.ts']);
    expect(screen.getByText('/worktree')).toBeInTheDocument();
    expect(screen.queryByText('workingMode.worktree')).not.toBeInTheDocument();

    act(() => {
      useProjectStore
        .getState()
        .setProjectTasks('/project', [{ id: 'worktree-task', baseDir: '/project', worktree: { path: '/project/.worktrees/fix-sidebar' } } as TaskData]);
    });
    expect(screen.getByText('.worktrees/fix-sidebar')).toBeInTheDocument();
    await waitFor(() => expect(useTaskFilesStore.getState().allFilesMap.has('/project/.worktrees/fix-sidebar')).toBe(true));
  });

  it('does not fetch an already cached empty file list', async () => {
    const api = createMockApi({ readFile: vi.fn().mockResolvedValue('content') });
    vi.mocked(useApi).mockReturnValue(api);
    useProjectStore.getState().setProjectTasks('/project', [{ id: 'task-1', baseDir: '/project' } as TaskData]);
    setTaskAllFiles('task-1', '/project', []);

    renderEditor([{ path: 'src/file.ts', taskId: 'task-1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));

    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('content'));
    expect(api.getAllFiles).not.toHaveBeenCalled();
    expect(screen.getByText('project')).toBeInTheDocument();
    expect(screen.queryByText('workingMode.worktree')).not.toBeInTheDocument();
  });

  it('restores real CodeMirror selection and scroll after closing and reopening', async () => {
    editorMock.useRealEditor = true;
    const content = Array.from({ length: 200 }, (_, index) => `line ${index}`).join('\n');
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve(content)) });
    vi.mocked(useApi).mockReturnValue(api);
    const createRange = document.createRange.bind(document);
    vi.spyOn(document, 'createRange').mockImplementation(() =>
      Object.assign(createRange(), {
        getClientRects: () => [],
        getBoundingClientRect: () => new DOMRect(),
      }),
    );

    const { container } = renderEditor([{ path: 'src/file.ts', taskId: 'task-1' }]);
    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    await waitFor(() => expect(container.querySelector('.cm-editor')).not.toBeNull());
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
    act(() => {
      view.dispatch({ selection: { anchor: 5, head: 20 } });
    });
    view.scrollDOM.scrollTop = 240;
    fireEvent.scroll(view.scrollDOM);
    for (let cycle = 0; cycle < 2; cycle++) {
      hotkeysMock.enableScope.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(hotkeysMock.enableScope).toHaveBeenCalledWith('home');

      hotkeysMock.disableScope.mockClear();
      fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
      await waitFor(() => {
        const reopened = EditorView.findFromDOM(container.querySelector('.cm-editor')!)!;
        expect(reopened.state.selection.main.anchor).toBe(5);
        expect(reopened.state.selection.main.head).toBe(20);
        expect(reopened.scrollDOM.scrollTop).toBe(240);
      });
      expect(hotkeysMock.disableScope).toHaveBeenCalledWith('home');
    }
    expect(api.readFile).toHaveBeenCalledTimes(1);
  });

  it('saves edited file content through saveFile', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([{ path: 'src/file.ts', taskId: 'task-1' }]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    const editor = await screen.findByLabelText('code-editor');
    fireEvent.change(editor, { target: { value: 'updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(api.saveFile).toHaveBeenCalledWith('/project', 'task-1', 'src/file.ts', 'updated');
    });
    expect(showSuccessNotification).toHaveBeenCalledWith('fileEditor.saved');
  });

  it('requires confirmation before closing with unsaved changes', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([{ path: 'src/file.ts', taskId: 'task-1' }]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    const editor = await screen.findByLabelText('code-editor');
    fireEvent.change(editor, { target: { value: 'updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('fileEditor.discardMessage')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('fileEditor.discardMessage')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.getByLabelText('code-editor')).not.toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('original'));
    expect(screen.queryByText('fileEditor.discardMessage')).not.toBeInTheDocument();
  });

  it('shows multiple tabs and keeps unsaved content when switching tabs', async () => {
    const api = createMockApi({
      readFile: vi.fn((_baseDir: string, _taskId: string, path: string) => Promise.resolve(`content of ${path}`)),
    });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([
      { path: 'src/file.ts', taskId: 'task-1' },
      { path: 'src/other.ts', taskId: 'task-1' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-src/other.ts' }));

    const editor = await screen.findByLabelText('code-editor');
    expect(editor).toHaveValue('content of src/other.ts');

    fireEvent.change(editor, { target: { value: 'edited other' } });

    const firstTab = screen.getByRole('tab', { selected: false });
    expect(firstTab).toHaveTextContent('file.ts');
    fireEvent.click(firstTab);

    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('content of src/file.ts'));

    fireEvent.click(screen.getByRole('tab', { selected: false }));
    await waitFor(() => expect(screen.getByLabelText('code-editor')).toHaveValue('edited other'));
  });

  it('drops tabs for files unavailable in the task worktree', async () => {
    const api = createMockApi({
      readFile: vi.fn((_baseDir: string, _taskId: string, path: string) =>
        path === 'src/missing.ts' ? Promise.reject(new Error('File not found')) : Promise.resolve('content'),
      ),
    });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([
      { path: 'src/file.ts', taskId: 'task-1' },
      { path: 'src/missing.ts', taskId: 'task-2' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/missing.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('file.ts');
    });
    await waitFor(() => {
      expect(screen.queryByRole('tab', { selected: false })).not.toBeInTheDocument();
    });
  });

  it('requires confirmation before closing a dirty tab and keeps other tabs', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([
      { path: 'src/file.ts', taskId: 'task-1' },
      { path: 'src/other.ts', taskId: 'task-1' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-src/other.ts' }));

    const editor = await screen.findByLabelText('code-editor');
    fireEvent.change(editor, { target: { value: 'edited other' } });

    const getOtherTabCloseButton = () => screen.getAllByLabelText('fileEditor.closeTab').at(-1);

    fireEvent.click(getOtherTabCloseButton()!);

    expect(screen.getByText('fileEditor.discardMessage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('code-editor')).toBeInTheDocument();

    fireEvent.click(getOtherTabCloseButton()!);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('file.ts');
      expect(screen.queryByRole('tab', { selected: false })).not.toBeInTheDocument();
    });
  });

  it('closes other tabs from the tab context menu', async () => {
    const api = createMockApi({ readFile: vi.fn((_baseDir: string, _taskId: string, path: string) => Promise.resolve(`content of ${path}`)) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([
      { path: 'src/file.ts', taskId: 'task-1' },
      { path: 'src/other.ts', taskId: 'task-1' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-src/other.ts' }));
    await screen.findByLabelText('code-editor');

    const fileTab = screen.getByText('file.ts').closest('[role="tab"]')!;
    fireEvent.contextMenu(fileTab);
    fireEvent.click(screen.getByRole('button', { name: 'contextMenu.closeOtherTabs' }));

    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent('file.ts');
    });
  });

  it('closes all tabs from the tab context menu', async () => {
    const api = createMockApi({ readFile: vi.fn((_baseDir: string, _taskId: string, path: string) => Promise.resolve(`content of ${path}`)) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([
      { path: 'src/file.ts', taskId: 'task-1' },
      { path: 'src/other.ts', taskId: 'task-1' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-src/other.ts' }));
    await screen.findByLabelText('code-editor');

    const fileTab = screen.getByText('file.ts').closest('[role="tab"]')!;
    fireEvent.contextMenu(fileTab);
    fireEvent.click(screen.getByRole('button', { name: 'contextMenu.closeAllTabs' }));

    await waitFor(() => expect(screen.queryByRole('tab')).not.toBeInTheDocument());
  });

  it('copies the absolute file path from the tab context menu', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    renderEditor([{ path: 'src/file.ts', taskId: 'task-1' }]);

    fireEvent.click(screen.getByRole('button', { name: 'open-src/file.ts' }));
    await screen.findByLabelText('code-editor');

    const fileTab = screen.getByText('file.ts').closest('[role="tab"]')!;
    fireEvent.contextMenu(fileTab);
    fireEvent.click(screen.getByRole('button', { name: 'fileEditor.copyAbsolutePath' }));

    await waitFor(() => expect(api.writeToClipboard).toHaveBeenCalledWith('/project/src/file.ts'));
  });
});
