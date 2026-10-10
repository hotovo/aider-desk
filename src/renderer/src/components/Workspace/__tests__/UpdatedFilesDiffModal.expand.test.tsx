import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Activity } from 'react';

import { UpdatedFilesDiffModal, type DiffModalGroup } from '../UpdatedFilesDiffModal';

import type { UpdatedFile } from '@common/types';

import { render } from '@/__tests__/render';

vi.mock('@/contexts/ApiContext', () => ({
  useApi: () => ({ openUrlInWindow: vi.fn() }) as unknown as Record<string, never>,
}));

const mkFile = (path: string): UpdatedFile => ({ path, additions: 1, deletions: 0 }) as UpdatedFile;

const files: UpdatedFile[] = [mkFile('src/a.ts'), mkFile('src/sub/deep.ts'), mkFile('lib/c.ts')];

const groups: DiffModalGroup[] = [{ id: null, files }];

const Harness = ({ open }: { open: boolean }) => (
  <Activity mode={open ? 'visible' : 'hidden'}>
    <UpdatedFilesDiffModal groups={groups} initialFile={files[0]} onClose={vi.fn()} baseDir="/base" taskId="task-1" />
  </Activity>
);

describe('UpdatedFilesDiffModal folder expand/collapse (Activity-wrapped like the app)', () => {
  it('collapses a folder immediately and keeps the state through selection-change re-renders', async () => {
    const { rerender } = render(<Harness open={false} />);

    act(() => {
      rerender(<Harness open={true} />);
    });

    await vi.waitFor(() => {
      expect(screen.getByText('a.ts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('src')!.closest('div')!);
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();
    expect(screen.queryByText('deep.ts')).not.toBeInTheDocument();
    expect(screen.getByText('c.ts')).toBeInTheDocument();

    // re-render with new props, like a selection toggle does in the modal
    act(() => {
      rerender(<Harness open={true} />);
    });
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('src')!.closest('div')!);
    expect(screen.getByText('a.ts')).toBeInTheDocument();
  });
});
