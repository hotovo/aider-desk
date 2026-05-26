import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type {
  Extension,
  ExtensionContext,
  ToolCalledEvent,
  ToolFinishedEvent,
  UIComponentDefinition,
} from '@aiderdesk/extensions';
import { createCheckpoint, restoreCheckpoint, deleteCheckpointRef, isGitRepo, getRepoRoot, git, MUTATING_TOOLS, type CheckpointData } from './core';
import { addCheckpointEntry, removeCheckpointEntry } from './storage';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REVERT_BUTTON_COMPONENT_ID = 'revert-checkpoint-button';

interface PendingCheckpoint {
  checkpointData: CheckpointData;
  checkpointId: string;
  filePath: string;
  toolName: string;
  workingDir: string;
  projectDir: string;
  taskId: string;
  messageId: string;
  timestamp: number;
}

function getFilePath(input: Record<string, unknown> | undefined): string {
  if (!input) return '';
  return (input.filePath as string) || (input.path as string) || '';
}

export default class CheckpointsExtension implements Extension {
  static metadata = {
    name: 'Checkpoints',
    version: '1.0.0',
    description: 'Git-based checkpoints for file edits — revert to the state before any edit',
    author: 'AiderDesk',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/checkpoints/icon.png',
    capabilities: ['events', 'ui'],
  };

  private pendingCheckpoints = new Map<string, PendingCheckpoint>();
  private gitAvailable = new Map<string, boolean>();
  private repoRoots = new Map<string, string>();
  private initializedDirs = new Set<string>();
  private checkpointCounter = 0;

  /** Working directory — worktree path in worktree mode, project dir otherwise */
  private getWorkingDir(context: ExtensionContext): string | null {
    const taskContext = context.getTaskContext();
    if (taskContext) {
      return taskContext.getTaskDir();
    }
    return context.getProjectDir() || null;
  }

  /** Project root directory — always the main project, used for storage */
  private getProjectDir(context: ExtensionContext): string | null {
    return context.getProjectDir() || null;
  }

  private getTaskId(context: ExtensionContext): string | null {
    const taskContext = context.getTaskContext();
    return taskContext?.data?.id ?? null;
  }

  private async ensureGitInitialized(workingDir: string, context: ExtensionContext): Promise<boolean> {
    if (this.initializedDirs.has(workingDir)) {
      return this.gitAvailable.get(workingDir) ?? false;
    }

    this.initializedDirs.add(workingDir);

    const isRepo = await isGitRepo(workingDir).catch(() => false);
    this.gitAvailable.set(workingDir, isRepo);

    if (isRepo) {
      const root = await getRepoRoot(workingDir).catch(() => workingDir);
      this.repoRoots.set(workingDir, root);
      context.log(`Git repo detected at ${root} (workingDir: ${workingDir})`, 'info');
    } else {
      context.log(`Not a git repo, checkpoints disabled (workingDir: ${workingDir})`, 'info');
    }

    return isRepo;
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Checkpoints extension loaded', 'info');
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void> {
    if (!MUTATING_TOOLS.has(event.toolName)) return;

    const workingDir = this.getWorkingDir(context);
    if (!workingDir) return;

    const projectDir = this.getProjectDir(context);
    if (!projectDir) return;

    const taskId = this.getTaskId(context);
    if (!taskId) return;

    const filePath = getFilePath(event.input);
    if (!filePath) return;

    const isAvailable = await this.ensureGitInitialized(workingDir, context);
    if (!isAvailable) return;

    const repoRoot = this.repoRoots.get(workingDir)!;
    const timestamp = Date.now();
    const counter = ++this.checkpointCounter;
    const checkpointId = `cp-${counter}-${timestamp}-${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;

    context.log(`Creating checkpoint before ${event.toolName} → ${filePath} (messageId: ${event.toolCallId})`, 'info');

    try {
      const cpData = await createCheckpoint({
        root: repoRoot,
        id: checkpointId,
        toolName: event.toolName,
        filePath,
      });

      this.pendingCheckpoints.set(event.toolCallId, {
        checkpointData: cpData,
        checkpointId,
        filePath,
        toolName: event.toolName,
        workingDir,
        projectDir,
        taskId,
        messageId: event.toolCallId,
        timestamp,
      });

      context.log(`Checkpoint created: ${checkpointId} (ref: ${cpData.ref}) for ${event.toolName} → ${filePath}`, 'info');
    } catch (err) {
      context.log(`Failed to create checkpoint: ${err instanceof Error ? err.message : err}`, 'warn');
    }
  }

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void> {
    if (!MUTATING_TOOLS.has(event.toolName)) return;

    const workingDir = this.getWorkingDir(context);
    if (!workingDir) return;

    const taskId = this.getTaskId(context);
    if (!taskId) return;

    const filePath = getFilePath(event.input);
    if (!filePath) return;

    const output = typeof event.output === 'string' ? event.output : JSON.stringify(event.output ?? '');
    const isSuccess = output.startsWith('Successfully');

    context.log(`Tool finished: ${event.toolName} → ${filePath} (success: ${isSuccess}, messageId: ${event.toolCallId})`, 'info');

    const pending = this.pendingCheckpoints.get(event.toolCallId);
    if (!pending) {
      context.log(`No pending checkpoint found for ${event.toolName} → ${filePath} (messageId: ${event.toolCallId})`, 'warn');
      return;
    }

    this.pendingCheckpoints.delete(event.toolCallId);

    if (isSuccess) {
      try {
        await addCheckpointEntry(pending.projectDir, taskId, event.toolCallId, pending.checkpointData);
        context.log(`Checkpoint persisted for ${pending.toolName} → ${filePath} (key: ${event.toolCallId}, storage: ${pending.projectDir})`, 'info');
        context.triggerUIDataRefresh(REVERT_BUTTON_COMPONENT_ID);
      } catch (err) {
        context.log(`Failed to persist checkpoint: ${err instanceof Error ? err.message : err}`, 'error');
      }
    } else {
      const repoRoot = this.repoRoots.get(pending.workingDir);
      if (repoRoot) {
        await deleteCheckpointRef(repoRoot, pending.checkpointId).catch(() => {});
      }
      context.log(`Checkpoint discarded (tool did not succeed) for ${pending.toolName} → ${filePath}`, 'info');
    }
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: REVERT_BUTTON_COMPONENT_ID,
        placement: 'task-message-above',
        loadData: true,
        noDataCache: true,
        jsx: readFileSync(join(__dirname, 'ResetToCheckpoint.jsx'), 'utf-8'),
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== REVERT_BUTTON_COMPONENT_ID) return null;

    const projectDir = this.getProjectDir(context);
    if (!projectDir) return { checkpoints: {} };

    const workingDir = this.getWorkingDir(context);
    if (!workingDir) return { checkpoints: {} };

    const taskId = this.getTaskId(context);
    if (!taskId) return { checkpoints: {} };

    const isAvailable = await this.ensureGitInitialized(workingDir, context);
    if (!isAvailable) return { checkpoints: {} };

    try {
      const { loadCheckpointIndex } = await import('./storage');
      const index = await loadCheckpointIndex(projectDir, taskId);
      const count = Object.keys(index.checkpoints).length;
      if (count > 0) {
        context.log(`Loaded ${count} checkpoint(s) for task ${taskId}`, 'info');
      }
      return { checkpoints: index.checkpoints };
    } catch {
      return { checkpoints: {} };
    }
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== REVERT_BUTTON_COMPONENT_ID) return null;

    const projectDir = this.getProjectDir(context);
    if (!projectDir) return null;

    const workingDir = this.getWorkingDir(context);
    if (!workingDir) return null;

    const taskId = this.getTaskId(context);
    if (!taskId) return null;

    const isAvailable = await this.ensureGitInitialized(workingDir, context);
    if (!isAvailable) {
      context.log('Cannot revert: not a git repo', 'error');
      return null;
    }

    const repoRoot = this.repoRoots.get(workingDir)!;

    if (action === 'revert' && args[0]) {
      const messageId = args[0] as string;
      if (!messageId) {
        context.log('Revert: missing messageId', 'error');
        return null;
      }

      context.log(`Revert requested for message ${messageId}`, 'info');

      const { loadCheckpointIndex } = await import('./storage');
      const index = await loadCheckpointIndex(projectDir, taskId);
      const entry = index.checkpoints[messageId];

      if (!entry) {
        context.log(`No checkpoint found for message ${messageId}`, 'warn');
        return null;
      }

      try {
        const commitSha = await git(
          `rev-parse --verify ${entry.ref}`,
          repoRoot,
        ).catch(() => null);

        if (!commitSha) {
          context.log(`Checkpoint ref ${entry.ref} no longer exists`, 'warn');
          await removeCheckpointEntry(projectDir, taskId, messageId);
          return null;
        }

        const msg = await git(`cat-file commit ${commitSha}`, repoRoot).catch(() => '');

        const getHeader = (key: string) =>
          msg.match(new RegExp(`^${key} (.+)$`, 'm'))?.[1]?.trim();

        const headSha = getHeader('head') || '0'.repeat(40);
        const indexTreeSha = getHeader('index-tree') || '';
        const worktreeTreeSha = getHeader('worktree-tree') || '';
        const untrackedRaw = getHeader('untracked');
        let preexistingUntrackedFiles: string[] | undefined;
        try {
          const parsed = untrackedRaw ? JSON.parse(untrackedRaw) : [];
          preexistingUntrackedFiles = parsed.length > 0 ? parsed : undefined;
        } catch { /* empty */ }

        const cpData: CheckpointData = {
          ref: entry.ref,
          toolName: entry.toolName,
          filePath: entry.filePath,
          timestamp: entry.timestamp,
          branch: getHeader('branch') || 'unknown',
          headSha,
          indexTreeSha,
          worktreeTreeSha,
          preexistingUntrackedFiles,
        };

        context.log(`Restoring checkpoint ${entry.ref} for ${entry.toolName} → ${entry.filePath} (repoRoot: ${repoRoot})`, 'info');

        await restoreCheckpoint(repoRoot, cpData);

        // Remove the reverted checkpoint and all subsequent ones
        // (those edits no longer exist in the codebase)
        const { loadCheckpointIndex } = await import('./storage');
        const currentIndex = await loadCheckpointIndex(projectDir, taskId);
        const revertedTimestamp = entry.timestamp;
        for (const [key, cp] of Object.entries(currentIndex.checkpoints)) {
          if (cp.timestamp >= revertedTimestamp) {
            await removeCheckpointEntry(projectDir, taskId, key);
          }
        }

        context.triggerUIDataRefresh(REVERT_BUTTON_COMPONENT_ID);
        context.log(`Reverted to checkpoint: ${entry.toolName} → ${entry.filePath}`, 'info');
        return { success: true };
      } catch (err) {
        context.log(`Revert failed: ${err instanceof Error ? err.message : err}`, 'error');
        return null;
      }
    }

    return null;
  }
}
