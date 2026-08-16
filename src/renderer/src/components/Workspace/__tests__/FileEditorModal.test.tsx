import { type ChangeEvent, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileEditorModal } from '../FileEditorModal';

import { useFileEditorStore } from '@/stores/fileEditorStore';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { showSuccessNotification } from '@/utils/notifications';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
  useHotkeysContext: () => ({ enableScope: vi.fn(), disableScope: vi.fn() }),
}));

vi.mock('@codemirror/language-data', () => ({
  languages: [],
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string, update: { docChanged: boolean }) => void }) => {
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value, { docChanged: false });
    };

    return <textarea aria-label="code-editor" value={value} onChange={handleChange} />;
  },
}));

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

const FileOpener = ({ paths }: { paths: Array<{ path: string; taskId: string }> }) => {
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
  if (!isEditorOpen || openFiles.length === 0) {
    return null;
  }
  return <FileEditorModal baseDir="/project" onClose={() => closeEditor('/project')} />;
};

const renderEditor = (files: Array<{ path: string; taskId: string }>) => {
  return render(
    <>
      <FileOpener paths={files} />
      <ConditionalEditor />
    </>,
  );
};

describe('FileEditorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useFileEditorStore.setState({ projectsMap: new Map() });
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

    await waitFor(() => expect(screen.queryByLabelText('code-editor')).not.toBeInTheDocument());
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
});
