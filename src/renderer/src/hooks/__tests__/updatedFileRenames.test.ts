import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdatedFile } from '@common/types';

import { useUpdatedFileDiff } from '../useUpdatedFileDiff';
import { useUpdatedFileContents } from '../useUpdatedFileContents';

const api = vi.hoisted(() => ({
  getUpdatedFileDiff: vi.fn(),
  getUpdatedFileContents: vi.fn(),
}));

vi.mock('@/contexts/ApiContext', () => ({ useApi: () => api }));

const renamedFile: UpdatedFile = { path: 'new.ts', previousPath: 'old.ts', additions: 0, deletions: 0 };

describe('Updated Files rename hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getUpdatedFileDiff.mockResolvedValue('rename patch');
    api.getUpdatedFileContents.mockResolvedValue({ oldContent: 'original', newContent: 'original' });
  });

  it('passes both paths when loading a pure rename diff', async () => {
    const { result } = renderHook(() => useUpdatedFileDiff('/project', 'task', renamedFile));

    await waitFor(() => expect(result.current.diff).toBe('rename patch'));
    expect(api.getUpdatedFileDiff).toHaveBeenCalledWith('/project', 'task', 'new.ts', undefined, 'old.ts');
  });

  it('invalidates the cached diff when the rename source changes', async () => {
    const { result, rerender } = renderHook(({ file }) => useUpdatedFileDiff('/project', 'task', file), { initialProps: { file: renamedFile } });
    await waitFor(() => expect(result.current.diff).toBe('rename patch'));
    api.getUpdatedFileDiff.mockResolvedValue('other patch');

    rerender({ file: { ...renamedFile, previousPath: 'other.ts' } });

    await waitFor(() => expect(result.current.diff).toBe('other patch'));
    expect(api.getUpdatedFileDiff).toHaveBeenLastCalledWith('/project', 'task', 'new.ts', undefined, 'other.ts');
  });

  it('loads original content using the previous path and invalidates it when the source changes', async () => {
    const { result, rerender } = renderHook(({ file }) => useUpdatedFileContents('/project', 'task', file), { initialProps: { file: renamedFile } });

    act(() => result.current.load());
    await waitFor(() => expect(result.current.contents).toEqual({ oldContent: 'original', newContent: 'original' }));
    expect(api.getUpdatedFileContents).toHaveBeenCalledWith('/project', 'task', 'new.ts', undefined, 'old.ts');

    rerender({ file: { ...renamedFile, previousPath: 'other.ts' } });

    expect(result.current.contents).toBeNull();
  });
});
