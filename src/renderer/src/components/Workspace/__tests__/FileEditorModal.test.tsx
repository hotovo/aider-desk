import { type ChangeEvent, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileEditorModal } from '../FileEditorModal';

import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { showSuccessNotification } from '@/utils/notifications';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
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

describe('FileEditorModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves edited file content through applyEdits', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    render(<FileEditorModal filePath="src/file.ts" baseDir="/project" taskId="task-1" onClose={onClose} />);

    const editor = await screen.findByLabelText('code-editor');
    fireEvent.change(editor, { target: { value: 'updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));

    expect(api.applyEdits).toHaveBeenCalledWith('/project', 'task-1', [
      {
        path: 'src/file.ts',
        original: 'original',
        updated: 'updated',
      },
    ]);
    expect(showSuccessNotification).toHaveBeenCalledWith('fileEditor.saved');
  });

  it('requires confirmation before closing with unsaved changes', async () => {
    const api = createMockApi({ readFile: vi.fn(() => Promise.resolve('original')) });
    vi.mocked(useApi).mockReturnValue(api);

    render(<FileEditorModal filePath="src/file.ts" baseDir="/project" taskId="task-1" onClose={onClose} />);

    const editor = await screen.findByLabelText('code-editor');
    fireEvent.change(editor, { target: { value: 'updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('fileEditor.discardMessage')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
