import path, { join } from 'path';
import { mkdir } from 'fs/promises';

import { execWithShellPath, withLock } from '@/utils';
import { AIDER_DESK_TASKS_DIR } from '@/constants';
import logger from '@/logger';
import { MergeState, Worktree } from '@/worktrees/types';

export interface GitError extends Error {
  gitCommands?: string[];
  gitOutput?: string;
  workingDirectory?: string;
  projectPath?: string;
  originalError?: Error;
}

// Interface for raw commit data
interface RawCommitData {
  hash: string;
  message: string;
  date: string | Date;
  author?: string;
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export class WorktreeManager {
  private getWorktreePath(projectPath: string, taskId: string): string {
    return join(projectPath, AIDER_DESK_TASKS_DIR, taskId, 'worktree');
  }

  private async initializeWorktree(projectPath: string, taskId: string): Promise<void> {
    const worktreePath = this.getWorktreePath(projectPath, taskId);
    try {
      await mkdir(worktreePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create worktree directory:', error);
    }
  }

  async createWorktree(projectPath: string, taskId: string, branch?: string, baseBranch = 'HEAD'): Promise<Worktree> {
    return await withLock(`worktree-create-${projectPath}-${taskId}`, async () => {
      await this.initializeWorktree(projectPath, taskId);

      const worktreePath = this.getWorktreePath(projectPath, taskId);

      try {
        // 1. Initialize repository if necessary
        try {
          await execWithShellPath('git rev-parse --is-inside-work-tree', { cwd: projectPath });
        } catch {
          // Initialize git repository
          await execWithShellPath('git init', { cwd: projectPath });
        }

        // 2. Clean up any existing worktree directory first
        try {
          await execWithShellPath(`git worktree remove "${worktreePath}" --force`, { cwd: projectPath });
        } catch {
          // Ignore cleanup errors
        }

        // 3. Ensure the repository has at least one commit
        try {
          await execWithShellPath('git rev-parse HEAD', { cwd: projectPath });
        } catch {
          // Repository has no commits yet, create initial commit
          try {
            await execWithShellPath('git add -A', { cwd: projectPath });
          } catch {
            // Ignore add errors (no files to add)
          }
          await execWithShellPath('git commit -m "Initial commit" --allow-empty', { cwd: projectPath });
        }

        // 4. Logic for creating the worktree
        let baseCommit: string;
        let actualBaseBranch: string;
        const baseRef = baseBranch; // Will be 'HEAD' if not provided

        if (branch) {
          // A. Branch name provided: Check if branch exists or create it
          let branchExists = false;
          try {
            // Check if it's an actual branch (not just a commit SHA)
            await execWithShellPath(`git show-ref --verify --quiet refs/heads/${branch}`, { cwd: projectPath });
            branchExists = true;
          } catch {
            // Branch doesn't exist
          }

          if (branchExists) {
            // A1. Use existing branch
            await execWithShellPath(`git worktree add "${worktreePath}" ${branch}`, { cwd: projectPath });

            // Get the base commit (the tip of the existing branch)
            baseCommit = (await execWithShellPath(`git rev-parse ${branch}`, { cwd: projectPath })).stdout.trim();
            actualBaseBranch = branch;
          } else {
            // A2. Create new branch from baseRef (which defaults to 'HEAD')

            // Verify that the base branch exists if specified and is a branch name
            if (baseBranch !== 'HEAD') {
              try {
                await execWithShellPath(`git show-ref --verify --quiet refs/heads/${baseBranch}`, { cwd: projectPath });
              } catch {
                throw new Error(`Base branch '${baseBranch}' does not exist`);
              }
            }

            // Capture the base commit before creating the worktree
            baseCommit = (await execWithShellPath(`git rev-parse ${baseRef}`, { cwd: projectPath })).stdout.trim();

            // Create the new branch and checkout the worktree
            await execWithShellPath(`git worktree add -b ${branch} "${worktreePath}" ${baseRef}`, { cwd: projectPath });
            actualBaseBranch = branch; // Use the newly created branch name
          }
        } else {
          // B. No branch name provided: Create detached worktree from current HEAD (or specified baseRef)

          // Note: git worktree add <path> defaults to current HEAD
          await execWithShellPath(`git worktree add "${worktreePath}" ${baseRef}`, { cwd: projectPath });

          // Capture the base commit (the commit it's detached at)
          baseCommit = (await execWithShellPath(`git rev-parse ${baseRef}`, { cwd: projectPath })).stdout.trim();

          // Use the baseRef for the branch name, or resolve the current branch if baseRef is 'HEAD'
          if (baseRef === 'HEAD') {
            try {
              actualBaseBranch = (await execWithShellPath('git rev-parse --abbrev-ref HEAD', { cwd: projectPath })).stdout.trim();
              if (actualBaseBranch === 'HEAD') {
                actualBaseBranch = 'DETACHED HEAD';
              }
            } catch {
              actualBaseBranch = 'DETACHED HEAD';
            }
          } else {
            actualBaseBranch = `${baseRef} (DETACHED)`;
          }
          logger.info(`Worktree created in DETACHED HEAD mode from commit: ${baseCommit}`);
        }

        logger.info(`Worktree created successfully at: ${worktreePath}`);

        return { path: worktreePath, baseCommit, baseBranch: actualBaseBranch };
      } catch (error) {
        logger.error('Failed to create worktree:', error);
        throw new Error(`Failed to create worktree: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  async removeWorktree(projectDir: string, worktree: Worktree): Promise<void> {
    return await withLock(`worktree-remove-${projectDir}-${worktree.path}`, async () => {
      try {
        await execWithShellPath(`git worktree remove "${worktree.path}" --force`, { cwd: projectDir });
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        const errorMessage = err.stderr || err.stdout || err.message || String(err);

        // If the worktree is not found, that's okay - it might have been manually deleted
        if (errorMessage.includes('is not a working tree') || errorMessage.includes('does not exist') || errorMessage.includes('No such file or directory')) {
          logger.debug(`Worktree ${worktree.path} already removed or doesn't exist, skipping...`);
          return;
        }

        // For other errors, still throw
        throw new Error(`Failed to remove worktree: ${errorMessage}`);
      }
    });
  }

  async listWorktrees(projectDir: string): Promise<Worktree[]> {
    try {
      const { stdout } = await execWithShellPath('git worktree list --porcelain', { cwd: projectDir });

      const worktrees: Worktree[] = [];
      const lines = stdout.split('\n');

      let currentWorktree: Worktree | null = null;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (currentWorktree?.path) {
            worktrees.push({
              ...currentWorktree,
            });
          }
          currentWorktree = { path: line.substring(9), baseBranch: '' };
        } else if (line.startsWith('branch ')) {
          currentWorktree = {
            ...(currentWorktree || {}),
            path: currentWorktree ? currentWorktree.path : '',
            baseBranch: line.substring(7).replace('refs/heads/', ''),
          };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree = {
            ...(currentWorktree || {}),
            path: currentWorktree ? currentWorktree.path : '',
            baseCommit: line.substring(5),
          };
        } else if (line.startsWith('detached')) {
          currentWorktree = {
            ...(currentWorktree || {}),
            path: currentWorktree ? currentWorktree.path : '',
            baseBranch: undefined,
          };
        } else if (line.startsWith('prunable')) {
          currentWorktree = {
            ...(currentWorktree || {}),
            path: currentWorktree ? currentWorktree.path : '',
            prunable: true,
          };
        }
      }

      if (currentWorktree?.path) {
        worktrees.push({
          ...currentWorktree,
        });
      }

      return worktrees;
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listBranches(projectPath: string): Promise<Array<{ name: string; isCurrent: boolean; hasWorktree: boolean }>> {
    try {
      // Get all local branches
      const { stdout: branchOutput } = await execWithShellPath('git branch', { cwd: projectPath });

      // Get all worktrees to identify which branches have worktrees
      const worktrees = await this.listWorktrees(projectPath);
      const worktreeBranches = new Set(worktrees.map((w) => w.baseBranch));

      const branches: Array<{ name: string; isCurrent: boolean; hasWorktree: boolean }> = [];
      const lines = branchOutput.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const isCurrent = line.startsWith('*');
        // Remove leading *, +, and spaces. The + indicates uncommitted changes
        const name = line.replace(/^[*+]?\s*[+]?\s*/, '').trim();
        if (name) {
          branches.push({
            name,
            isCurrent,
            hasWorktree: worktreeBranches.has(name),
          });
        }
      }

      // Sort branches: worktree branches first, then the rest
      branches.sort((a, b) => {
        if (a.hasWorktree && !b.hasWorktree) {
          return -1;
        }
        if (!a.hasWorktree && b.hasWorktree) {
          return 1;
        }
        // Within each group, sort alphabetically
        return a.name.localeCompare(b.name);
      });

      return branches;
    } catch (error) {
      logger.error('Error listing branches:', error);
      return [];
    }
  }

  async getProjectMainBranch(projectPath: string): Promise<string> {
    try {
      // ONLY check the current branch in the project root directory
      const currentBranchResult = await execWithShellPath('git branch --show-current', { cwd: projectPath });
      const currentBranch = currentBranchResult.stdout.trim();

      if (currentBranch) {
        return currentBranch;
      }

      // Throw error if we're in detached HEAD state
      throw new Error(`Cannot determine main branch: repository at ${projectPath} is in detached HEAD state`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('detached HEAD')) {
        throw error;
      }
      throw new Error(`Failed to get main branch for project at ${projectPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Deprecated: Use getProjectMainBranch instead
  async detectMainBranch(projectPath: string): Promise<string> {
    logger.warn('detectMainBranch is deprecated, use getProjectMainBranch instead');
    return await this.getProjectMainBranch(projectPath);
  }

  // Deprecated: Use getProjectMainBranch instead
  async getEffectiveMainBranch(project: { path: string; main_branch?: string }): Promise<string> {
    logger.warn('getEffectiveMainBranch is deprecated, use getProjectMainBranch instead');
    return await this.getProjectMainBranch(project.path);
  }

  async hasChangesToRebase(worktreePath: string, mainBranch: string): Promise<boolean> {
    try {
      // Check if main branch has commits that the current branch doesn't have
      // Use cross-platform approach
      let stdout = '0';
      try {
        const result = await execWithShellPath(`git rev-list --count HEAD..${mainBranch}`, { cwd: worktreePath });
        stdout = result.stdout;
      } catch {
        // Error checking, assume no changes
        stdout = '0';
      }
      const commitCount = parseInt(stdout.trim());
      return commitCount > 0;
    } catch (error) {
      logger.error('Error checking for changes to rebase:', error);
      return false;
    }
  }

  async checkForRebaseConflicts(
    worktreePath: string,
    mainBranch: string,
  ): Promise<{
    hasConflicts: boolean;
    conflictingFiles?: string[];
    conflictingCommits?: { ours: string[]; theirs: string[] };
    canAutoMerge?: boolean;
  }> {
    try {
      // First check if there are any changes to rebase
      const hasChanges = await this.hasChangesToRebase(worktreePath, mainBranch);
      if (!hasChanges) {
        return { hasConflicts: false, canAutoMerge: true };
      }

      // Get the merge base
      const { stdout: mergeBase } = await execWithShellPath(`git merge-base HEAD ${mainBranch}`, { cwd: worktreePath });
      const base = mergeBase.trim();

      // Try a dry-run merge to detect conflicts
      // We use merge-tree to check for conflicts without modifying the working tree
      try {
        const { stdout: mergeTreeOutput } = await execWithShellPath(`git merge-tree ${base} HEAD ${mainBranch}`, { cwd: worktreePath });

        // Parse merge-tree output for conflicts
        const conflictMarkers = mergeTreeOutput.match(/<<<<<<< /g);
        const hasConflicts = conflictMarkers && conflictMarkers.length > 0;

        if (hasConflicts) {
          // Get list of files that would conflict
          const { stdout: diffOutput } = await execWithShellPath(`git diff --name-only ${base}...HEAD`, { cwd: worktreePath });
          const ourFiles = diffOutput
            .trim()
            .split('\n')
            .filter((f) => f);

          const { stdout: theirDiffOutput } = await execWithShellPath(`git diff --name-only ${base}...${mainBranch}`, { cwd: worktreePath });
          const theirFiles = theirDiffOutput
            .trim()
            .split('\n')
            .filter((f) => f);

          // Find files modified in both branches
          const conflictingFiles = ourFiles.filter((f) => theirFiles.includes(f));

          // Get commit info for better error reporting
          const { stdout: ourCommits } = await execWithShellPath(`git log --oneline ${base}..HEAD`, { cwd: worktreePath });
          const { stdout: theirCommits } = await execWithShellPath(`git log --oneline ${base}..${mainBranch}`, { cwd: worktreePath });

          logger.info(`Found conflicts in files: ${conflictingFiles.join(', ')}`);

          return {
            hasConflicts: true,
            conflictingFiles,
            conflictingCommits: {
              ours: ourCommits
                .trim()
                .split('\n')
                .filter((c) => c),
              theirs: theirCommits
                .trim()
                .split('\n')
                .filter((c) => c),
            },
            canAutoMerge: false,
          };
        }

        return { hasConflicts: false, canAutoMerge: true };
      } catch (error) {
        // If merge-tree is not available (older git), fall back to checking modified files
        logger.debug('merge-tree not available, using fallback conflict detection', {
          error: error instanceof Error ? error.message : String(error),
        });

        // Get files changed in both branches
        const { stdout: diffOutput } = await execWithShellPath(`git diff --name-only ${base}...HEAD`, { cwd: worktreePath });
        const ourFiles = diffOutput
          .trim()
          .split('\n')
          .filter((f) => f);

        const { stdout: theirDiffOutput } = await execWithShellPath(`git diff --name-only ${base}...${mainBranch}`, { cwd: worktreePath });
        const theirFiles = theirDiffOutput
          .trim()
          .split('\n')
          .filter((f) => f);

        // Find files modified in both branches (potential conflicts)
        const conflictingFiles = ourFiles.filter((f) => theirFiles.includes(f));

        if (conflictingFiles.length > 0) {
          // Get commit info
          const { stdout: ourCommits } = await execWithShellPath(`git log --oneline ${base}..HEAD`, { cwd: worktreePath });
          const { stdout: theirCommits } = await execWithShellPath(`git log --oneline ${base}..${mainBranch}`, { cwd: worktreePath });

          logger.info(`Potential conflicts in files: ${conflictingFiles.join(', ')}`);

          return {
            hasConflicts: true,
            conflictingFiles,
            conflictingCommits: {
              ours: ourCommits
                .trim()
                .split('\n')
                .filter((c) => c),
              theirs: theirCommits
                .trim()
                .split('\n')
                .filter((c) => c),
            },
            canAutoMerge: false,
          };
        }

        return { hasConflicts: false, canAutoMerge: true };
      }
    } catch (error: unknown) {
      logger.error('Error checking for rebase conflicts:', error);
      // On error, return unknown status
      return {
        hasConflicts: false,
        canAutoMerge: false,
      };
    }
  }

  async rebaseMainIntoWorktree(worktreePath: string, mainBranch: string): Promise<void> {
    return await withLock(`git-rebase-${worktreePath}`, async () => {
      const executedCommands: string[] = [];
      let lastOutput = '';

      try {
        // Rebase the current worktree branch onto local main branch
        const command = `git rebase ${mainBranch}`;
        executedCommands.push(`${command} (in ${worktreePath})`);
        const rebaseResult = await execWithShellPath(command, { cwd: worktreePath });
        lastOutput = rebaseResult.stdout || rebaseResult.stderr || '';
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        logger.error(`Failed to rebase ${mainBranch} into worktree:`, err);

        // Create detailed error with git command output
        const gitError: GitError = new Error(`Failed to rebase ${mainBranch} into worktree`);
        gitError.gitCommands = executedCommands;
        gitError.gitOutput = err.stderr || err.stdout || lastOutput || err.message || '';
        gitError.workingDirectory = worktreePath;
        gitError.originalError = err;

        throw gitError;
      }
    });
  }

  async abortRebase(worktreePath: string): Promise<void> {
    try {
      // Check if we're in the middle of a rebase
      const statusCommand = 'git status --porcelain=v1';
      await execWithShellPath(statusCommand, { cwd: worktreePath });

      // Abort the rebase
      const command = 'git rebase --abort';
      const { stderr } = await execWithShellPath(command, { cwd: worktreePath });

      if (stderr && !stderr.includes('No rebase in progress')) {
        throw new Error(`Failed to abort rebase: ${stderr}`);
      }
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Error aborting rebase:', err);
      throw new Error(`Failed to abort rebase: ${err.message}`);
    }
  }

  private async squashAndMergeWorktreeToMain(projectPath: string, worktreePath: string, mainBranch: string, commitMessage: string): Promise<void> {
    const executedCommands: string[] = [];
    let lastOutput = '';

    try {
      logger.info(`Squashing and merging worktree to ${mainBranch}: ${worktreePath}`);

      // Get current branch name in worktree (for logging purposes)
      let command = 'git branch --show-current';
      executedCommands.push(`git branch --show-current (in ${worktreePath})`);
      const { stdout: currentBranch, stderr: stderr1 } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = currentBranch || stderr1 || '';
      const branchName = currentBranch.trim() || 'detached HEAD';

      // Check if there are any changes to merge (before rebase)
      command = `git log --oneline ${mainBranch}..HEAD`;
      const { stdout: commits, stderr: stderr2 } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = commits || stderr2 || '';
      if (!commits.trim()) {
        return;
      }

      // SAFETY CHECK 1: Rebase worktree onto main FIRST before squashing
      command = `git rebase ${mainBranch}`;
      executedCommands.push(`git rebase ${mainBranch} (in ${worktreePath})`);
      try {
        const rebaseWorktreeResult = await execWithShellPath(command, { cwd: worktreePath });
        lastOutput = rebaseWorktreeResult.stdout || rebaseWorktreeResult.stderr || '';
        logger.debug(`Successfully rebased worktree onto ${mainBranch} before squashing`);
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        // If rebase fails, abort it in the worktree
        try {
          await execWithShellPath('git rebase --abort', { cwd: worktreePath });
        } catch {
          // Ignore abort errors
        }

        throw new Error(
          `Failed to rebase worktree onto ${mainBranch} before squashing. Conflicts must be resolved first.\n\n` +
            `Git output: ${err.stderr || err.stdout || err.message}`,
        );
      }

      // Get the HEAD commit hash from worktree AFTER rebase (but before squashing)
      // This preserves the worktree's commit history
      command = 'git rev-parse HEAD';
      executedCommands.push(`git rev-parse HEAD (in ${worktreePath})`);
      const { stdout: worktreeHead, stderr: stderr3 } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = worktreeHead || stderr3 || '';
      const worktreeCommitHash = worktreeHead.trim();

      // Switch to main branch in the main repository
      command = `git checkout ${mainBranch}`;
      executedCommands.push(`git checkout ${mainBranch} (in ${projectPath})`);
      const checkoutResult = await execWithShellPath(command, { cwd: projectPath });
      lastOutput = checkoutResult.stdout || checkoutResult.stderr || '';

      // SQUASH MERGE: Use git merge --squash to create a squashed staging of all changes
      // This keeps the worktree branch history intact while creating a single commit in main
      command = `git merge --squash ${worktreeCommitHash}`;
      executedCommands.push(`git merge --squash ${worktreeCommitHash} (in ${projectPath})`);
      try {
        const squashResult = await execWithShellPath(command, { cwd: projectPath });
        lastOutput = squashResult.stdout || squashResult.stderr || '';
        logger.debug(`Successfully squashed changes from ${branchName}`);
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        throw new Error(`Failed to squash merge from ${branchName}.\n\n` + `Git output: ${err.stderr || err.stdout || err.message}`);
      }

      // Check if there are staged changes to commit
      command = 'git diff --cached --quiet';
      const hasStagedChanges = await execWithShellPath(command, { cwd: projectPath })
        .then(() => false)
        .catch(() => true);

      if (!hasStagedChanges) {
        logger.info('No changes to commit after squash merge (worktree was already up to date with main)');
        return;
      }

      // Commit the squashed changes with the provided message
      const escapedMessage = commitMessage.replace(/"/g, '\\"');
      command = `git commit -m "${escapedMessage}"`;
      executedCommands.push(`git commit -m "..." (in ${projectPath})`);
      try {
        const commitResult = await execWithShellPath(command, { cwd: projectPath });
        lastOutput = commitResult.stdout || commitResult.stderr || '';
        logger.debug(`Successfully committed squashed changes to ${mainBranch}`);
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        throw new Error(`Failed to commit squashed changes to ${mainBranch}.\n\n` + `Git output: ${err.stderr || err.stdout || err.message}`);
      }

      logger.info(`Successfully squashed and merged worktree to ${mainBranch} (worktree history preserved)`);
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string; stdout?: string };
      logger.error(`Failed to squash and merge worktree to ${mainBranch}:`, err);

      // Create detailed error with git command output
      const gitError: GitError = new Error(`Failed to squash and merge worktree to ${mainBranch}`);
      gitError.gitCommands = executedCommands;
      // Prioritize actual error messages over lastOutput (which may contain unrelated data like commit counts)
      gitError.gitOutput = err.stderr || err.stdout || err.message || lastOutput || '';
      gitError.workingDirectory = worktreePath;
      gitError.projectPath = projectPath;
      gitError.originalError = err;

      throw gitError;
    }
  }

  private async mergeWorktreeToMain(projectPath: string, worktreePath: string, mainBranch: string): Promise<void> {
    const executedCommands: string[] = [];
    let lastOutput = '';

    try {
      logger.info(`Merging worktree to ${mainBranch} (without squashing): ${worktreePath}`);

      // Get current branch name in worktree (for logging purposes)
      let command = 'git branch --show-current';
      executedCommands.push(`git branch --show-current (in ${worktreePath})`);
      const { stdout: currentBranch, stderr: stderr1 } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = currentBranch || stderr1 || '';
      const branchName = currentBranch.trim() || 'detached HEAD';

      // Check if there are any changes to merge
      command = `git log --oneline ${mainBranch}..HEAD`;
      const { stdout: commits, stderr: stderr2 } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = commits || stderr2 || '';
      if (!commits.trim()) {
        return;
      }

      // SAFETY CHECK 1: Rebase worktree onto main FIRST (resolves conflicts in worktree, not main)
      command = `git rebase ${mainBranch}`;
      executedCommands.push(`git rebase ${mainBranch} (in ${worktreePath})`);
      try {
        const rebaseWorktreeResult = await execWithShellPath(command, { cwd: worktreePath });
        lastOutput = rebaseWorktreeResult.stdout || rebaseWorktreeResult.stderr || '';
        logger.debug(`Successfully rebased worktree onto ${mainBranch}`);
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        // If rebase fails, abort it in the worktree
        try {
          await execWithShellPath('git rebase --abort', { cwd: worktreePath });
        } catch {
          // Ignore abort errors
        }

        throw new Error(
          `Failed to rebase worktree onto ${mainBranch}. Conflicts must be resolved first.\n\n` + `Git output: ${err.stderr || err.stdout || err.message}`,
        );
      }

      // Get the HEAD commit hash from worktree AFTER rebase
      command = 'git rev-parse HEAD';
      executedCommands.push(`git rev-parse HEAD (in ${worktreePath})`);
      const { stdout: worktreeHead, stderr: stderr1b } = await execWithShellPath(command, { cwd: worktreePath });
      lastOutput = worktreeHead || stderr1b || '';
      const worktreeCommitHash = worktreeHead.trim();

      // Switch to main branch in the main repository
      command = `git checkout ${mainBranch}`;
      executedCommands.push(`git checkout ${mainBranch} (in ${projectPath})`);
      const checkoutResult = await execWithShellPath(command, { cwd: projectPath });
      lastOutput = checkoutResult.stdout || checkoutResult.stderr || '';

      // SAFETY CHECK 2: Use --ff-only merge to prevent history rewriting
      // This will fail if local main has diverged from the worktree branch
      command = `git merge --ff-only ${worktreeCommitHash}`;
      executedCommands.push(`git merge --ff-only ${worktreeCommitHash} (in ${projectPath})`);
      try {
        const mergeResult = await execWithShellPath(command, { cwd: projectPath });
        lastOutput = mergeResult.stdout || mergeResult.stderr || '';
        logger.debug(`Successfully fast-forwarded ${mainBranch} to ${branchName} (${worktreeCommitHash})`);
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string; stdout?: string };
        throw new Error(
          `Failed to fast-forward ${mainBranch} to ${branchName}.\n\n` +
            `This usually means ${mainBranch} has commits that ${branchName} doesn't have.\n` +
            `You may need to rebase the worktree onto ${mainBranch} first, or reset ${mainBranch} to match origin.\n\n` +
            `Git output: ${err.stderr || err.stdout || err.message}`,
        );
      }

      logger.info(`Successfully merged worktree to ${mainBranch} (without squashing)`);
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string; stdout?: string };
      logger.error(`Failed to merge worktree to ${mainBranch}:`, err);

      // Create detailed error with git command output
      const gitError: GitError = new Error(`Failed to merge worktree to ${mainBranch}`);
      gitError.gitCommands = executedCommands;
      // Prioritize actual error messages over lastOutput (which may contain unrelated data like commit counts)
      gitError.gitOutput = err.stderr || err.stdout || err.message || lastOutput || '';
      gitError.workingDirectory = worktreePath;
      gitError.projectPath = projectPath;
      gitError.originalError = err;

      throw gitError;
    }
  }

  generateRebaseCommands(mainBranch: string): string[] {
    return [`git rebase ${mainBranch}`];
  }

  generateSquashCommands(mainBranch: string, branchName: string): string[] {
    return [
      `# In worktree: Rebase onto ${mainBranch} to get latest changes`,
      `git rebase ${mainBranch}`,
      `# In main repo: Switch to ${mainBranch}`,
      `git checkout ${mainBranch}`,
      '# In main repo: Squash merge the worktree branch (preserves worktree history)',
      `git merge --squash ${branchName}`,
      'git commit -m "Your commit message"',
    ];
  }

  generateMergeCommands(mainBranch: string, branchName: string): string[] {
    return [
      `# In worktree: Rebase onto ${mainBranch} to get latest changes`,
      `git rebase ${mainBranch}`,
      `# In main repo: Switch to ${mainBranch}`,
      `git checkout ${mainBranch}`,
      '# In main repo: Merge the worktree branch',
      `git merge --ff-only ${branchName}`,
    ];
  }

  async gitPull(worktreePath: string): Promise<{ output: string }> {
    try {
      const { stdout, stderr } = await execWithShellPath('git pull', { cwd: worktreePath });
      const output = stdout || stderr || 'Pull completed successfully';

      return { output };
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string; stdout?: string };
      const gitError: GitError = new Error(err.message || 'Git pull failed');
      gitError.gitOutput = err.stderr || err.stdout || err.message || '';
      gitError.workingDirectory = worktreePath;
      throw gitError;
    }
  }

  async gitPush(worktreePath: string): Promise<{ output: string }> {
    try {
      const { stdout, stderr } = await execWithShellPath('git push', { cwd: worktreePath });
      const output = stdout || stderr || 'Push completed successfully';

      return { output };
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string; stdout?: string };
      const gitError: GitError = new Error(err.message || 'Git push failed');
      gitError.gitOutput = err.stderr || err.stdout || err.message || '';
      gitError.workingDirectory = worktreePath;
      throw gitError;
    }
  }

  async getLastCommits(worktreePath: string, count: number = 20): Promise<RawCommitData[]> {
    try {
      const { stdout } = await execWithShellPath(`git log -${count} --pretty=format:'%H|%s|%ai|%an' --shortstat`, { cwd: worktreePath });

      const commits: RawCommitData[] = [];
      const lines = stdout.split('\n');
      let i = 0;

      while (i < lines.length) {
        const commitLine = lines[i];
        if (!commitLine || !commitLine.includes('|')) {
          i++;
          continue;
        }

        const parts = commitLine.split('|');
        const hash = parts.shift() || '';
        const author = (parts.pop() || '').trim();
        const date = (parts.pop() || '').trim();
        const message = parts.join('|');

        const commit: RawCommitData = {
          hash: hash.trim(),
          message: message.trim(),
          date,
          author: author || 'Unknown',
        };

        if (i + 1 < lines.length && lines[i + 1].trim()) {
          const statsLine = lines[i + 1].trim();
          const statsMatch = statsLine.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);

          if (statsMatch) {
            commit.filesChanged = parseInt(statsMatch[1]) || 0;
            commit.additions = parseInt(statsMatch[2]) || 0;
            commit.deletions = parseInt(statsMatch[3]) || 0;
            i++;
          }
        }

        commits.push(commit);
        i++;
      }

      return commits;
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string; stdout?: string };
      const gitError: GitError = new Error(err.message || 'Failed to get commits');
      gitError.gitOutput = err.stderr || err.stdout || err.message || '';
      gitError.workingDirectory = worktreePath;
      throw gitError;
    }
  }

  async getOriginBranch(worktreePath: string, branch: string): Promise<string | null> {
    try {
      await execWithShellPath(`git rev-parse --verify origin/${branch}`, { cwd: worktreePath });
      return `origin/${branch}`;
    } catch {
      return null;
    }
  }

  async getTaskWorktree(projectPath: string, taskId: string): Promise<Worktree | null> {
    try {
      const worktrees = await this.listWorktrees(projectPath);
      const taskWorktreePath = this.getWorktreePath(projectPath, taskId);

      // Find worktree that matches our task's worktree path
      const taskWorktree = worktrees.find((w) => w.path === taskWorktreePath);

      if (taskWorktree) {
        return taskWorktree;
      }

      // If no worktree exists for this task, return null
      return null;
    } catch (error) {
      logger.error('Failed to get task worktree:', error);
      return null;
    }
  }

  /**
   * Check if there are uncommitted changes in the given path
   */
  async hasUncommittedChanges(path: string): Promise<boolean> {
    try {
      const { stdout } = await execWithShellPath('git status --porcelain=v1', { cwd: path });
      return stdout.trim().length > 0;
    } catch (error) {
      logger.error('Failed to check for uncommitted changes:', error);
      return false;
    }
  }

  /**
   * Stash uncommitted changes with a unique identifier
   * Returns the stash identifier or null if no changes to stash
   */
  async stashUncommittedChanges(stashId: string, path: string, message: string): Promise<string | null> {
    try {
      const hasChanges = await this.hasUncommittedChanges(path);
      if (!hasChanges) {
        return null;
      }

      const fullMessage = `${stashId}: ${message}`;
      await execWithShellPath(`git stash push -u -m "${fullMessage}"`, { cwd: path });
      logger.info(`Stashed changes with ID: ${stashId}`);
      return stashId;
    } catch (error) {
      logger.error('Failed to stash changes:', error);
      throw new Error(`Failed to stash uncommitted changes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Apply a stash by its identifier
   */
  async applyStash(path: string, stashId: string): Promise<void> {
    try {
      // Find the stash entry that matches our identifier
      const { stdout: stashList } = await execWithShellPath('git stash list', { cwd: path });
      const stashEntry = stashList.split('\n').find((line) => line.includes(stashId));

      if (!stashEntry) {
        logger.warn(`Stash with ID ${stashId} not found, skipping apply`);
        return;
      }

      // Extract stash reference (e.g., "stash@{0}")
      const stashRef = stashEntry.split(':')[0];
      await execWithShellPath(`git stash apply ${stashRef}`, { cwd: path });
      logger.info(`Applied stash: ${stashRef}`);
    } catch (error) {
      logger.error(`Failed to apply stash ${stashId}:`, error);
      throw new Error(`Failed to apply stash: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Drop a stash by its identifier
   */
  async dropStash(path: string, stashId: string): Promise<void> {
    try {
      // Find the stash entry that matches our identifier
      const { stdout: stashList } = await execWithShellPath('git stash list', { cwd: path });
      const stashEntry = stashList.split('\n').find((line) => line.includes(stashId));

      if (!stashEntry) {
        logger.warn(`Stash with ID ${stashId} not found, skipping drop`);
        return;
      }

      // Extract stash reference (e.g., "stash@{0}")
      const stashRef = stashEntry.split(':')[0];
      await execWithShellPath(`git stash drop ${stashRef}`, { cwd: path });
      logger.info(`Dropped stash: ${stashRef}`);
    } catch (error) {
      logger.error(`Failed to drop stash ${stashId}:`, error);
      // Don't throw - dropping stash is not critical
    }
  }

  /**
   * Merge worktree to main branch with uncommitted changes support
   * Returns MergeState for potential revert
   */
  async mergeWorktreeToMainWithUncommitted(
    projectPath: string,
    taskId: string,
    worktreePath: string,
    squash: boolean,
    commitMessage?: string,
  ): Promise<MergeState> {
    return await withLock(`git-merge-worktree-${worktreePath}`, async () => {
      const timestamp = Date.now();
      const worktreeStashId = `worktree-${taskId.length > 24 ? taskId.substring(24) : taskId}-merge-${timestamp}`;
      const mainStashId = `main-${taskId.length > 24 ? taskId.substring(24) : taskId}-merge-${timestamp}`;
      let beforeMergeCommitHash = '';
      let worktreeBranchCommitHash = '';
      let mainOriginalStashId: string | undefined;

      const mainBranch = await this.getProjectMainBranch(projectPath);

      try {
        logger.info(`Starting ${squash ? 'squash' : 'merge'} operation with uncommitted changes support`);

        // 1. Track initial state
        const { stdout: mainCommit } = await execWithShellPath(`git rev-parse ${mainBranch}`, { cwd: projectPath });
        beforeMergeCommitHash = mainCommit.trim();

        const { stdout: worktreeCommit } = await execWithShellPath('git rev-parse HEAD', { cwd: worktreePath });
        worktreeBranchCommitHash = worktreeCommit.trim();

        logger.info('Initial state tracked', { beforeMergeCommitHash, worktreeBranchCommitHash });

        // 2. Stash uncommitted changes in worktree
        await this.stashUncommittedChanges(worktreeStashId, worktreePath, 'Worktree uncommitted changes before merge');

        // 3. Stash uncommitted changes in main branch if any
        const mainStashResult = await this.stashUncommittedChanges(mainStashId, projectPath, 'Main branch uncommitted changes before merge');
        if (mainStashResult) {
          mainOriginalStashId = mainStashResult;
        }

        // 4. Perform the merge operation (existing methods handle the actual merge)
        if (squash) {
          if (!commitMessage) {
            throw new Error('Commit message is required for squash merge');
          }
          await this.squashAndMergeWorktreeToMain(projectPath, worktreePath, mainBranch, commitMessage);
        } else {
          await this.mergeWorktreeToMain(projectPath, worktreePath, mainBranch);
        }

        // 5. Apply worktree stash to both branches (keeping changes uncommitted)
        if (worktreeStashId) {
          logger.info('Applying worktree stash to main branch');
          await this.applyStash(projectPath, worktreeStashId);

          logger.info('Applying worktree stash back to worktree');
          await this.applyStash(worktreePath, worktreeStashId);

          // Drop the worktree stash after successful application
          await this.dropStash(worktreePath, worktreeStashId);
        }

        // 6. Restore main branch's original uncommitted changes if any
        // DO NOT drop this stash - we need it for potential revert
        if (mainOriginalStashId) {
          logger.info('Restoring main branch original uncommitted changes');
          await this.applyStash(projectPath, mainOriginalStashId);
        }

        logger.info('Merge operation completed successfully');

        // Return merge state for potential revert
        const mergeState: MergeState = {
          beforeMergeCommitHash,
          worktreeBranchCommitHash,
          mainOriginalStashId,
          timestamp,
        };

        return mergeState;
      } catch (error) {
        logger.error('Merge operation failed:', { error });

        // Recovery: try to restore stashes
        if (worktreeStashId) {
          try {
            await this.applyStash(worktreePath, worktreeStashId);
            await this.dropStash(worktreePath, worktreeStashId);
          } catch (recoveryError) {
            logger.error('Failed to recover worktree stash:', {
              error: recoveryError,
            });
          }
        }

        if (mainOriginalStashId) {
          try {
            await this.applyStash(projectPath, mainOriginalStashId);
            await this.dropStash(projectPath, mainOriginalStashId);
          } catch (recoveryError) {
            logger.error('Failed to recover main branch stash:', {
              error: recoveryError,
            });
          }
        }

        throw error;
      }
    });
  }

  /**
   * Check if worktree has uncommitted changes or unmerged commits
   * Returns information about unsaved work in the worktree
   */
  async checkWorktreeForUnmergedWork(
    projectPath: string,
    worktreePath: string,
  ): Promise<{
    hasUncommittedChanges: boolean;
    hasUnmergedCommits: boolean;
    unmergedCommitCount: number;
    unmergedCommits: string[];
  }> {
    try {
      // 1. Check for uncommitted changes
      const hasUncommittedChanges = await this.hasUncommittedChanges(worktreePath);

      // 2. Get the main branch name
      const mainBranch = await this.getProjectMainBranch(projectPath);

      // 3. Check for commits in worktree that are not in main branch
      let unmergedCommitCount = 0;
      let unmergedCommits: string[] = [];

      try {
        const { stdout: commits } = await execWithShellPath(`git log --oneline ${mainBranch}..HEAD`, { cwd: worktreePath });
        const commitLines = commits
          .trim()
          .split('\n')
          .filter((line) => line.trim());

        unmergedCommitCount = commitLines.length;
        unmergedCommits = commitLines;
      } catch (error) {
        // If we can't get commits, log but don't fail
        logger.warn('Failed to check for unmerged commits:', error);
      }

      const hasUnmergedCommits = unmergedCommitCount > 0;

      return {
        hasUncommittedChanges,
        hasUnmergedCommits,
        unmergedCommitCount,
        unmergedCommits,
      };
    } catch (error) {
      logger.error('Failed to check worktree for unmerged work:', error);
      // On error, return safe defaults (assume there might be work)
      return {
        hasUncommittedChanges: false,
        hasUnmergedCommits: false,
        unmergedCommitCount: 0,
        unmergedCommits: [],
      };
    }
  }

  /**
   * Apply uncommitted changes from worktree to main branch without merging commits
   * This transfers work-in-progress changes while keeping them uncommitted in both branches
   */
  async applyUncommittedChangesToMain(projectPath: string, taskId: string, worktreePath: string): Promise<void> {
    return await withLock(`git-apply-uncommitted-${worktreePath}`, async () => {
      const timestamp = Date.now();
      const worktreeStashId = `worktree-${taskId.length > 24 ? taskId.substring(24) : taskId}-uncommitted-${timestamp}`;

      try {
        logger.info('Starting apply uncommitted changes operation');

        // 1. Check if there are uncommitted changes in worktree
        const hasChanges = await this.hasUncommittedChanges(worktreePath);
        if (!hasChanges) {
          logger.info('No uncommitted changes to apply');
          return;
        }

        // 2. Stash uncommitted changes from worktree
        const stashResult = await this.stashUncommittedChanges(worktreeStashId, worktreePath, 'Uncommitted changes to apply to main');
        if (!stashResult) {
          logger.info('No changes were stashed');
          return;
        }

        // 3. Apply stash to main branch (keeping uncommitted)
        logger.info('Applying uncommitted changes to main branch');
        await this.applyStash(projectPath, worktreeStashId);

        // 4. Apply stash back to worktree (keeping uncommitted)
        logger.info('Applying uncommitted changes back to worktree');
        await this.applyStash(worktreePath, worktreeStashId);

        // 5. Clean up stash
        await this.dropStash(worktreePath, worktreeStashId);

        logger.info('Successfully applied uncommitted changes to main branch');
      } catch (error) {
        logger.error('Failed to apply uncommitted changes:', error);

        // Recovery: try to restore stash to worktree
        if (worktreeStashId) {
          try {
            await this.applyStash(worktreePath, worktreeStashId);
            await this.dropStash(worktreePath, worktreeStashId);
          } catch (recoveryError) {
            logger.error('Failed to recover worktree stash:', recoveryError);
          }
        }

        throw new Error(`Failed to apply uncommitted changes: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Revert a merge operation using the stored MergeState
   * Restores the main branch to its pre-merge state while preserving uncommitted changes
   */
  async revertMerge(projectPath: string, taskId: string, worktreePath: string, mergeState: MergeState): Promise<void> {
    return await withLock(`git-revert-merge-${worktreePath}`, async () => {
      const timestamp = Date.now();
      const currentWorktreeStashId = `worktree-${taskId.length > 24 ? taskId.substring(24) : taskId}-revert-${timestamp}`;

      try {
        logger.info('Starting merge revert operation', { mergeState });

        // 1. Stash current uncommitted changes in worktree
        await this.stashUncommittedChanges(currentWorktreeStashId, worktreePath, 'Current uncommitted changes before revert');

        // 2. Reset main branch to previous state (this removes worktree-originated uncommitted changes)
        logger.info(`Resetting main branch to ${mergeState.beforeMergeCommitHash}`);
        await execWithShellPath(`git reset --hard ${mergeState.beforeMergeCommitHash}`, { cwd: projectPath });

        // 3. Reset worktree branch to previous state
        logger.info(`Resetting worktree branch to ${mergeState.worktreeBranchCommitHash}`);
        await execWithShellPath(`git reset --hard ${mergeState.worktreeBranchCommitHash}`, { cwd: worktreePath });

        // 4. Restore main's original uncommitted changes if they were preserved
        if (mergeState.mainOriginalStashId) {
          logger.info('Restoring main branch original uncommitted changes');
          await this.applyStash(projectPath, mergeState.mainOriginalStashId);
          // Clean up the stash after successful revert
          await this.dropStash(projectPath, mergeState.mainOriginalStashId);
        }

        // 5. Restore uncommitted changes in worktree
        if (currentWorktreeStashId) {
          logger.info('Restoring uncommitted changes in worktree');
          await this.applyStash(worktreePath, currentWorktreeStashId);
          await this.dropStash(worktreePath, currentWorktreeStashId);
        }

        logger.info('Merge revert completed successfully');
      } catch (error) {
        logger.error('Failed to revert merge:', error);

        // Recovery: try to restore worktree stash
        if (currentWorktreeStashId) {
          try {
            await this.applyStash(worktreePath, currentWorktreeStashId);
            await this.dropStash(worktreePath, currentWorktreeStashId);
          } catch (recoveryError) {
            logger.error('Failed to recover worktree stash:', recoveryError);
          }
        }

        throw new Error(`Failed to revert merge: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private async pruneDeleted(projectDir: string): Promise<void> {
    logger.info('Pruning deleted worktrees', {
      projectDir,
    });
    const worktrees = await this.listWorktrees(projectDir);
    logger.debug('Found worktrees', {
      worktrees,
    });
    for (const worktree of worktrees) {
      if (worktree.path.startsWith(path.join(projectDir, AIDER_DESK_TASKS_DIR)) && worktree.prunable) {
        try {
          logger.debug(`Pruning deleted worktree: ${worktree.path}`);
          await execWithShellPath(`git worktree remove ${worktree.path}`, { cwd: projectDir });
        } catch (error) {
          logger.warn('Failed to prune worktree:', {
            worktree,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  async close(projectDir: string) {
    logger.info('Closing worktree manager');
    await this.pruneDeleted(projectDir);
  }
}
