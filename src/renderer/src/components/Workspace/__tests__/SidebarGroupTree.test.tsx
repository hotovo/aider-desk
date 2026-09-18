import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SidebarGroupTree } from '../SidebarGroupTree';

import type { UpdatedFile } from '@common/types';
import type { GroupTree, TreeItem } from '../types';

import { render } from '@/__tests__/render';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const fileA: UpdatedFile = { path: 'src/a.ts', additions: 1, deletions: 0 } as UpdatedFile;
const fileB: UpdatedFile = { path: 'b.ts', additions: 2, deletions: 0 } as UpdatedFile;

const initialTree: GroupTree = {
  group: { id: null, files: [fileA] },
  files: [fileA],
  treeData: {
    root: { index: 'root', isFolder: true, data: 'root', children: ['src'] },
    src: { index: 'src', isFolder: true, data: 'src', children: ['src/a.ts'] },
    'src/a.ts': { index: 'src/a.ts', data: 'a.ts', file: fileA },
  } as Record<string, TreeItem>,
};

const updatedTree: GroupTree = {
  group: { id: null, files: [fileB] },
  files: [fileB],
  treeData: {
    root: { index: 'root', isFolder: true, data: 'root', children: ['b.ts'] },
    'b.ts': { index: 'b.ts', data: 'b.ts', file: fileB },
  } as Record<string, TreeItem>,
};

const createProps = () => ({
  showCheckboxes: false,
  currentFilePath: undefined,
  selectedFilePaths: new Set<string>(),
  onFileSelect: vi.fn(),
  onToggleFileSelection: vi.fn(),
  onToggleFolderSelection: vi.fn(),
});

describe('SidebarGroupTree', () => {
  it('renders folders and files', () => {
    const props = createProps();

    render(<SidebarGroupTree groupTree={initialTree} {...props} />);

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('a.ts')).toBeInTheDocument();
  });

  it('expands a folder when its row is clicked', () => {
    const props = createProps();

    render(<SidebarGroupTree groupTree={initialTree} {...props} />);

    expect(screen.getByText('a.ts')).toBeInTheDocument();
    fireEvent.click(screen.getByText('src').closest('div')!);
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('src').closest('div')!);
    expect(screen.getByText('a.ts')).toBeInTheDocument();
  });

  it('auto-expands newly introduced folders while keeping user collapse state', () => {
    const props = createProps();

    const { rerender } = render(<SidebarGroupTree groupTree={initialTree} {...props} />);

    fireEvent.click(screen.getByText('src').closest('div')!);
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();

    const treeWithNewFolder: GroupTree = {
      ...initialTree,
      files: [fileA, fileB],
      treeData: {
        root: { index: 'root', isFolder: true, data: 'root', children: ['src', 'lib'] },
        src: { index: 'src', isFolder: true, data: 'src', children: ['src/a.ts'] },
        'src/a.ts': { index: 'src/a.ts', data: 'a.ts', file: fileA },
        lib: { index: 'lib', isFolder: true, data: 'lib', children: ['b.ts'] },
        'b.ts': { index: 'b.ts', data: 'b.ts', file: fileB },
      },
    };

    rerender(<SidebarGroupTree groupTree={treeWithNewFolder} {...props} />);

    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();
    expect(screen.getByText('b.ts')).toBeInTheDocument();
  });

  it('keeps collapse/expand working when the parent re-renders with new treeData identity', () => {
    const props = createProps();

    const { rerender } = render(<SidebarGroupTree groupTree={initialTree} {...props} />);

    const sameContentTree: GroupTree = {
      ...initialTree,
      treeData: {
        ...initialTree.treeData,
      },
    };

    rerender(<SidebarGroupTree groupTree={sameContentTree} {...props} />);

    fireEvent.click(screen.getByText('src').closest('div')!);
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();

    rerender(<SidebarGroupTree groupTree={initialTree} {...props} />);

    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();
  });

  it('does not throw when an expanded folder is removed by a treeData update', () => {
    const props = createProps();

    const { rerender } = render(<SidebarGroupTree groupTree={initialTree} {...props} />);

    expect(screen.getByText('a.ts')).toBeInTheDocument();

    rerender(<SidebarGroupTree groupTree={updatedTree} {...props} />);

    expect(screen.getByText('b.ts')).toBeInTheDocument();
    expect(screen.queryByText('src')).not.toBeInTheDocument();
  });
});
