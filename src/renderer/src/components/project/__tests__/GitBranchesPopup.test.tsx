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
  onRequestClose?: () => void;
};

const openSubmenuFor = (branchName: string) => {
  fireEvent.click(screen.getByText(branchName));
};

const pressKey = (key: string, target?: Node | null) => {
  fireEvent.keyDown(target ?? window, { key });
};

const getSearchInput = () => screen.getByPlaceholderText('git.searchBranches');

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
      expect(screen.getByText('git.newBranchFrom').closest('button')).toBeInTheDocument();
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

      expect(screen.getByText('git.updateFromRemote').closest('button')).toBeInTheDocument();

      fireEvent.click(screen.getByText('git.updateFromRemote').closest('button')!);
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

  describe('keyboard navigation', () => {
    it('filters branches from the search field and opens the submenu with Enter', () => {
      renderPopup({ branches: [makeBranch({ name: 'feature-x' }), makeBranch({ name: 'main' })] });

      const input = getSearchInput();
      fireEvent.change(input, { target: { value: 'main' } });

      pressKey('ArrowDown', input);
      pressKey('Enter', input);

      expect(screen.getByText('git.checkoutBranch')).toBeInTheDocument();
    });

    it('clears the highlight when the filter changes', () => {
      renderPopup({ branches: [makeBranch({ name: 'feature-a' }), makeBranch({ name: 'feature-b' })] });

      const input = getSearchInput();
      pressKey('ArrowDown', input);
      expect(screen.getByText('feature-a').closest('div[class*="cursor-pointer"]')).toHaveClass('bg-bg-tertiary');

      fireEvent.change(input, { value: 'a', target: { value: 'a' } });
      expect(screen.getByText('feature-a').closest('div[class*="cursor-pointer"]')).not.toHaveClass('bg-bg-tertiary');
    });

    it('navigates the submenu with arrows and invokes the action with Enter', () => {
      const onSelect = vi.fn();
      renderPopup({ onSelect, branches: [makeBranch({ name: 'main' }), makeBranch({ name: 'feat' })] });

      const input = getSearchInput();
      fireEvent.change(input, { target: { value: 'feat' } });
      pressKey('ArrowDown', input);
      pressKey('Enter', input);
      expect(screen.getByText('git.checkoutBranch').closest('button')).toHaveClass('bg-bg-tertiary');
      pressKey('ArrowDown');
      expect(screen.getByText('git.newBranchFrom').closest('button')).toHaveClass('bg-bg-tertiary');

      pressKey('ArrowUp');
      expect(screen.getByText('git.checkoutBranch').closest('button')).toHaveClass('bg-bg-tertiary');

      pressKey('Enter');

      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'feat' }));
      expect(screen.queryByText('git.newBranchFrom')).not.toBeInTheDocument();
    });

    it('skips disabled submenu items when navigating', () => {
      renderPopup({
        branches: [makeBranch({ name: 'feature-x', upstream: 'origin/feature-x' })],
        currentBranch: 'feature-x',
        onUpdateBranch: vi.fn(),
      });

      const input = getSearchInput();
      pressKey('ArrowDown', input);
      pressKey('Enter', input);

      // checkout is disabled (current branch), so the highlight starts on the first enabled item
      expect(screen.getByText('git.newBranchFrom').closest('button')).toHaveClass('bg-bg-tertiary');
      pressKey('ArrowDown');
      expect(screen.getByText('git.updateFromRemote').closest('button')).toHaveClass('bg-bg-tertiary');
    });

    it('closes the submenu with Escape and the dropdown with another Escape', () => {
      const onRequestClose = vi.fn();
      renderPopup({ onRequestClose, branches: [makeBranch({ name: 'main' })] });

      const input = getSearchInput();
      pressKey('ArrowDown', input);
      pressKey('Enter', input);
      expect(screen.getByText('git.checkoutBranch')).toBeInTheDocument();

      pressKey('Escape');
      expect(screen.queryByText('git.checkoutBranch')).not.toBeInTheDocument();

      pressKey('Escape');
      expect(onRequestClose).toHaveBeenCalledTimes(1);
    });

    it('moves the highlight with arrow keys and back', () => {
      renderPopup({ branches: [makeBranch({ name: 'feature-a' }), makeBranch({ name: 'feature-b' })] });

      const input = getSearchInput();
      pressKey('ArrowDown', input);
      expect(screen.getByText('feature-a').closest('div[class*="cursor-pointer"]')).toHaveClass('bg-bg-tertiary');

      pressKey('ArrowDown');
      expect(screen.getByText('feature-b').closest('div[class*="cursor-pointer"]')).toHaveClass('bg-bg-tertiary');
      expect(screen.getByText('feature-a').closest('div[class*="cursor-pointer"]')).not.toHaveClass('bg-bg-tertiary');

      pressKey('ArrowUp');
      expect(screen.getByText('feature-a').closest('div[class*="cursor-pointer"]')).toHaveClass('bg-bg-tertiary');
    });
  });
});
