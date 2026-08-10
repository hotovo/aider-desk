import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TreeItemRenderer } from '../TreeItemRenderer';

import type { UpdatedFile } from '@common/types';
import type { TreeItem } from '../types';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const item: TreeItem = {
  index: 'src/file.ts',
  data: 'file.ts',
  file: { path: 'src/file.ts' },
};

const createProps = () => ({
  item,
  title: 'file.ts',
  children: null,
  type: 'updated' as const,
  treeData: { 'src/file.ts': item },
  expandedItems: [],
  setExpandedItems: vi.fn(),
  contextFilesMap: new Map(),
  updatedFiles: [{ path: 'src/file.ts', additions: 1, deletions: 0 } as UpdatedFile],
  os: null,
  onFileDiffClick: vi.fn(),
  onRevertFile: vi.fn(),
  onDropFile: vi.fn(() => vi.fn()),
  onAddFile: vi.fn(() => vi.fn()),
});

describe('TreeItemRenderer updated files', () => {
  it('shows a muted add-to-Git action for untracked files', () => {
    const props = createProps();
    const onAddFileToGit = vi.fn();
    props.updatedFiles[0].isUntracked = true;

    render(<TreeItemRenderer {...props} onAddFileToGit={onAddFileToGit} />);

    expect(screen.getByText('file.ts')).toHaveClass('text-text-muted-light');
    fireEvent.click(screen.getByRole('button'));
    expect(onAddFileToGit).toHaveBeenCalledWith('src/file.ts');
    expect(props.onRevertFile).not.toHaveBeenCalled();
  });

  it('keeps the original revert action for tracked unstaged files', () => {
    const props = createProps();
    const onAddFileToGit = vi.fn();

    render(<TreeItemRenderer {...props} onAddFileToGit={onAddFileToGit} />);

    expect(screen.getByText('file.ts')).toHaveClass('text-text-primary');
    fireEvent.click(screen.getByRole('button'));
    expect(props.onRevertFile).toHaveBeenCalledWith('src/file.ts');
    expect(onAddFileToGit).not.toHaveBeenCalled();
  });
});
