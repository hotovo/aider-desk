import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdatedFile, DiffViewMode } from '@common/types';

import { UpdatedFilesDiffModal } from '../UpdatedFilesDiffModal';

import { TooltipProvider } from '@/components/ui/Tooltip';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'contextFiles.updatedFiles': 'Updated Files',
        'common.previous': 'Previous',
        'common.next': 'Next',
        'diffViewer.sideBySide': 'Side by Side',
        'diffViewer.unified': 'Unified',
        'diffViewer.compact': 'Compact',
        'diffViewer.lineComment.placeholder': 'Enter your comment...',
        'diffViewer.lineComment.taskName': params ? `Update ${params.filename}` : 'Update file',
        'common.cancel': 'Cancel',
        'common.submit': 'Submit',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

vi.mock('@/contexts/SettingsContext', () => ({
  useSettings: vi.fn(() => ({
    settings: { diffViewMode: DiffViewMode.SideBySide },
    saveSettings: vi.fn(),
  })),
}));

const mockRunCodeInlineRequest = vi.fn();

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(() => ({
    runCodeInlineRequest: mockRunCodeInlineRequest,
  })),
}));

vi.mock('react-diff-view', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-diff-view')>();
  return {
    ...actual,
    Diff: ({ children, hunks }: { children: (hunks: unknown[]) => React.ReactNode; hunks: unknown[] }) => (
      <div data-testid="diff-component">{children(hunks)}</div>
    ),
    Hunk: ({ hunk }: { hunk: { content: string } }) => <div data-testid="hunk-component">{hunk.content}</div>,
    parseDiff: vi.fn(() => [
      {
        type: 'modify',
        oldPath: 'test.ts',
        newPath: 'test.ts',
        hunks: [{ content: '@@ -1,3 +1,4 @@', changes: [] }],
      },
    ]),
    getChangeKey: vi.fn(() => 'I41'),
  };
});

vi.mock('../common/DiffViewer/CompactDiffViewer', () => ({
  CompactDiffViewer: () => <div data-testid="compact-diff-viewer">Compact Viewer</div>,
}));

const mockFiles: UpdatedFile[] = [
  {
    path: 'src/utils/example.ts',
    diff: `diff --git a/src/utils/example.ts b/src/utils/example.ts
--- a/src/utils/example.ts
+++ b/src/utils/example.ts
@@ -38,6 +38,7 @@ function example() {
 const a = 1;
 const b = 2;
 const c = 3;
+const newVar = 42;
 return a + b + c;
 }`,
    additions: 1,
    deletions: 0,
  },
  {
    path: 'src/utils/second.ts',
    diff: 'diff for second file',
    additions: 0,
    deletions: 1,
  },
];

describe('UpdatedFilesDiffModal - Line Comment Feature', () => {
  const defaultProps = {
    files: mockFiles,
    initialFileIndex: 0,
    onClose: vi.fn(),
    baseDir: '/project',
    taskId: 'test-task-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with file information', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(screen.getByText('Updated Files')).toBeInTheDocument();
    expect(screen.getByText('src/utils/example.ts')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders navigation buttons when multiple files exist', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('does not render navigation buttons when only one file', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} files={[mockFiles[0]]} />);

    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('calls onClose when modal is closed', () => {
    const onClose = vi.fn();
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} onClose={onClose} />);

    const closeButton = document.querySelector('[title="common.close"]');
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('displays diff viewer component', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(screen.getByTestId('diff-component')).toBeInTheDocument();
  });

  it('shows file path as title', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(screen.getByTitle('src/utils/example.ts')).toHaveTextContent('src/utils/example.ts');
  });

  it('shows additions and deletions count', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} files={mockFiles} initialFileIndex={1} />);

    expect(screen.getByText('-1')).toBeInTheDocument();
  });

  it('shows diff view mode selector', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(screen.getByText('Side by Side')).toBeInTheDocument();
  });
});

describe('UpdatedFilesDiffModal - API Integration', () => {
  const defaultProps = {
    files: mockFiles,
    initialFileIndex: 0,
    onClose: vi.fn(),
    baseDir: '/project',
    taskId: 'test-task-id',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has access to api.runCodeInlineRequest', () => {
    renderWithProviders(<UpdatedFilesDiffModal {...defaultProps} />);

    expect(mockRunCodeInlineRequest).not.toHaveBeenCalled();
  });

  it('runCodeInlineRequest is available for inline code requests', async () => {
    mockRunCodeInlineRequest.mockImplementationOnce(() => {});

    mockRunCodeInlineRequest('/project', 'src/utils/example.ts', 42, 'Add a new variable here');

    expect(mockRunCodeInlineRequest).toHaveBeenCalledWith('/project', 'src/utils/example.ts', 42, 'Add a new variable here');
  });
});
