import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationAPI } from '@common/api';
import { BranchInfo } from '@common/types';

import { WorktreeActionDialog } from '../WorktreeActionDialog';

import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

const makeBranch = (overrides: Partial<BranchInfo> = {}): BranchInfo => ({
  name: 'feature-x',
  isCurrent: false,
  hasWorktree: false,
  ...overrides,
});

const defaultProps = {
  baseDir: '/base/dir',
  title: 'Merge into branch',
  confirmButtonText: 'Merge',
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

const mockApiWithBranches = (branches: BranchInfo[]) => {
  const api = createMockApi({ listBranches: vi.fn(() => Promise.resolve(branches)) });
  vi.mocked(useApi).mockReturnValue(api as unknown as ApplicationAPI);
  return api;
};

describe('WorktreeActionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openDropdown = async (triggerValue: string | RegExp) => {
    const input = await screen.findByDisplayValue(triggerValue);
    fireEvent.focus(input);
    await screen.findByRole('listbox');
    return input;
  };

  it('lists branches and marks the currently checked out branch', async () => {
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'feature-x', hasWorktree: true })]);
    render(<WorktreeActionDialog {...defaultProps} />);

    await openDropdown(/main \(worktree.branchCurrent\)/);

    expect(screen.getByRole('option', { name: 'main (worktree.branchCurrent)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'feature-x' })).toBeInTheDocument();
  });

  it('defaults the selection to the currently checked out branch', async () => {
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'feature-x' })]);
    render(<WorktreeActionDialog {...defaultProps} />);

    expect(await screen.findByDisplayValue(/main \(worktree.branchCurrent\)/)).toBeInTheDocument();
  });

  it('filters branches through the search input', async () => {
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'feature-x' })]);
    render(<WorktreeActionDialog {...defaultProps} />);

    const input = await openDropdown(/main \(worktree.branchCurrent\)/);
    fireEvent.change(input, { target: { value: 'feature-x' } });

    expect(screen.getByRole('option', { name: 'feature-x' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'main (worktree.branchCurrent)' })).not.toBeInTheDocument();
  });

  it('confirms with the selected branch', async () => {
    const onConfirm = vi.fn();
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'feature-x' })]);
    render(<WorktreeActionDialog {...defaultProps} onConfirm={onConfirm} />);

    await openDropdown(/main \(worktree.branchCurrent\)/);
    fireEvent.click(screen.getByRole('option', { name: 'feature-x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('feature-x', undefined));
  });

  it('passes the commit message when enabled', async () => {
    const onConfirm = vi.fn();
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'feature-x' })]);
    render(<WorktreeActionDialog {...defaultProps} onConfirm={onConfirm} showCommitMessage={true} />);

    await openDropdown(/main \(worktree.branchCurrent\)/);
    fireEvent.click(screen.getByRole('option', { name: 'feature-x' }));
    fireEvent.change(screen.getByPlaceholderText('worktree.commitMessagePlaceholder'), { target: { value: 'Squashed changes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('feature-x', 'Squashed changes'));
  });

  it('prefers the default branch over the current branch', async () => {
    mockApiWithBranches([makeBranch({ name: 'main', isCurrent: true }), makeBranch({ name: 'develop' })]);
    render(<WorktreeActionDialog {...defaultProps} defaultBranch="develop" />);

    expect(await screen.findByDisplayValue('develop')).toBeInTheDocument();
  });
});
