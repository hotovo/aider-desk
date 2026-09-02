import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BranchInfo } from '@common/types';

import { GitBranchesPopup } from '../GitBranchesPopup';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const makeBranch = (overrides: Partial<BranchInfo> = {}): BranchInfo => ({
  name: 'feature-x',
  isCurrent: false,
  hasWorktree: false,
  ...overrides,
});

const defaultProps = {
  branches: [makeBranch()],
  currentBranch: 'main',
  loading: false,
  recentBranches: [],
  onSelect: vi.fn(),
  onNewBranchFrom: vi.fn(),
  onMergeIntoCurrent: vi.fn(),
  onRebaseOnto: vi.fn(),
  onDelete: vi.fn(),
};

type PopupProps = typeof defaultProps & {
  worktreeMode?: boolean;
  onRebaseWorktreeOnto?: (branch: BranchInfo) => void;
  onUpdateBranch?: (branch: BranchInfo) => void;
};

const openSubmenuFor = (branchName: string) => {
  fireEvent.click(screen.getByText(branchName));
};

describe('GitBranchesPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPopup = (props: Partial<PopupProps> = {}) => render(<GitBranchesPopup {...defaultProps} {...props} />);

  describe('local mode', () => {
    it('shows checkout actions in the branch submenu', () => {
      renderPopup();
      openSubmenuFor('feature-x');

      expect(screen.getByText('git.checkoutBranch')).toBeInTheDocument();
      expect(screen.getByText('git.newBranchFrom')).toBeInTheDocument();
      expect(screen.getByText('git.rebaseOnto')).toBeInTheDocument();
      expect(screen.getByText('git.mergeBranchInto')).toBeInTheDocument();
    });

    it('calls onSelect when checkout is clicked', () => {
      const onSelect = vi.fn();
      renderPopup({ onSelect });
      openSubmenuFor('feature-x');

      fireEvent.click(screen.getByText('git.checkoutBranch'));

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'feature-x' }));
    });
  });

  describe('worktree mode', () => {
    it('replaces checkout with worktree rebase in the branch submenu', () => {
      renderPopup({ worktreeMode: true, onRebaseWorktreeOnto: vi.fn() });
      openSubmenuFor('feature-x');

      expect(screen.getByText('git.rebaseWorktreeOnto')).toBeInTheDocument();
      expect(screen.queryByText('git.checkoutBranch')).not.toBeInTheDocument();
      expect(screen.queryByText('git.newBranchFrom')).not.toBeInTheDocument();
      expect(screen.queryByText('git.rebaseOnto')).not.toBeInTheDocument();
    });

    it('removes merge into current and keeps delete action in worktree mode', () => {
      renderPopup({ worktreeMode: true, onRebaseWorktreeOnto: vi.fn() });
      openSubmenuFor('feature-x');

      expect(screen.queryByText('git.mergeBranchInto')).not.toBeInTheDocument();
      expect(screen.getByText('git.deleteBranchName')).toBeInTheDocument();
    });

    it('shows update from remote when branch has upstream', () => {
      const onUpdateBranch = vi.fn();
      renderPopup({
        worktreeMode: true,
        onRebaseWorktreeOnto: vi.fn(),
        onUpdateBranch,
        branches: [makeBranch({ upstream: 'origin/feature-x' })],
      });
      openSubmenuFor('feature-x');

      expect(screen.getByText('git.updateFromRemote')).toBeInTheDocument();

      fireEvent.click(screen.getByText('git.updateFromRemote'));
      expect(onUpdateBranch).toHaveBeenCalledWith(expect.objectContaining({ name: 'feature-x' }));
    });

    it('calls onRebaseWorktreeOnto with the branch when clicked', () => {
      const onRebaseWorktreeOnto = vi.fn();
      renderPopup({ worktreeMode: true, onRebaseWorktreeOnto });
      openSubmenuFor('feature-x');

      fireEvent.click(screen.getByText('git.rebaseWorktreeOnto'));

      expect(onRebaseWorktreeOnto).toHaveBeenCalledWith(expect.objectContaining({ name: 'feature-x' }));
    });

    it('disables the rebase action for the current branch', () => {
      renderPopup({
        worktreeMode: true,
        onRebaseWorktreeOnto: vi.fn(),
        branches: [makeBranch({ isCurrent: true })],
        currentBranch: 'feature-x',
      });
      openSubmenuFor('feature-x');

      expect(screen.getByText('git.rebaseWorktreeOnto').closest('button')).toBeDisabled();
    });

    it('hides delete for branches checked out in another worktree', () => {
      renderPopup({
        worktreeMode: true,
        onRebaseWorktreeOnto: vi.fn(),
        branches: [makeBranch({ hasWorktree: true })],
      });
      openSubmenuFor('feature-x');

      expect(screen.queryByText('git.deleteBranchName')).not.toBeInTheDocument();
    });
  });
});
