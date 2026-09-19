import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Extension, ExtensionContext, ProjectStartedEvent, ProjectStoppedEvent, UIComponentDefinition } from '@aiderdesk/extensions';

import {
  amendCommitMessage,
  cherryPick,
  checkoutRevision,
  createBranch,
  createPatch,
  createTag,
  getBranches,
  getCommitDetail,
  getCommitDiffToLocal,
  getContextInfo,
  getFileDiff,
  getLog,
  getNeighbors,
  isGitRepo,
  pushUpTo,
  remoteUrlToWebUrl,
  resetBranch,
  revertCommit,
  undoCommit,
  type GitResetMode,
} from './core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPONENT_ID = 'git-log';
const DEFAULT_PAGE_SIZE = 200;

const gitLogJsx = readFileSync(join(__dirname, './ui/GitLog.jsx'), 'utf-8');

export default class GitLogExtension implements Extension {
  static metadata = {
    name: 'Git Log',
    version: '1.1.1',
    description: 'Browse the git history of open projects with an IntelliJ IDEA-style log viewer',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/git-log/icon.png',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Git Log Extension loaded', 'info');
  }

  async onProjectStarted(_event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  async onProjectStopped(_event: ProjectStoppedEvent, context: ExtensionContext): Promise<void> {
    context.triggerUIDataRefresh(COMPONENT_ID);
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: COMPONENT_ID,
        placement: 'header-right',
        jsx: gitLogJsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) return undefined;

    return {
      openProjectDirs: this.getOpenProjectDirsSafe(context),
      currentProjectDir: context.getProjectDir(),
    };
  }

  private getOpenProjectDirsSafe(context: ExtensionContext): string[] | null {
    try {
      if (typeof context.getOpenProjectDirs !== 'function') return null;
      return context.getOpenProjectDirs();
    } catch (err) {
      context.log(`getOpenProjectDirs is unavailable: ${err instanceof Error ? err.message : String(err)}`, 'warn');
      return null;
    }
  }

  private getError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== COMPONENT_ID) return undefined;

    switch (action) {
      case 'get-log': {
        const projectDir = String(args[0] ?? '');
        const branch = String(args[1] ?? 'all');
        const skip = Number(args[2] ?? 0);
        const limit = Number(args[3] ?? DEFAULT_PAGE_SIZE);

        if (!projectDir) return { commits: [], hasMore: false, error: 'No project selected' };
        if (skip < 0 || limit <= 0) return { commits: [], hasMore: false, error: 'Invalid pagination' };

        try {
          if (!(await isGitRepo(projectDir))) {
            return { commits: [], hasMore: false, error: 'Not a git repository' };
          }
          return await getLog(projectDir, branch, skip, limit);
        } catch (err) {
          context.log(`get-log failed: ${this.getError(err)}`, 'error');
          return { commits: [], hasMore: false, error: this.getError(err) };
        }
      }
      case 'get-branches': {
        const projectDir = String(args[0] ?? '');
        if (!projectDir) return { branches: [], currentBranch: null, error: 'No project selected' };

        try {
          if (!(await isGitRepo(projectDir))) {
            return { branches: [], currentBranch: null, error: 'Not a git repository' };
          }
          const branches = await getBranches(projectDir);
          const currentBranch = branches.find((b) => b.current)?.name ?? null;
          return { branches, currentBranch };
        } catch (err) {
          context.log(`get-branches failed: ${this.getError(err)}`, 'error');
          return { branches: [], currentBranch: null, error: this.getError(err) };
        }
      }
      case 'get-commit-detail': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { files: [], diff: '', error: 'Missing project or commit' };

        try {
          return await getCommitDetail(projectDir, hash);
        } catch (err) {
          context.log(`get-commit-detail failed: ${this.getError(err)}`, 'error');
          return { files: [], diff: '', error: this.getError(err) };
        }
      }
      case 'get-file-diff': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        const path = String(args[2] ?? '');
        if (!projectDir || !hash || !path) return { diff: '', error: 'Missing project, commit or file' };

        try {
          return { diff: await getFileDiff(projectDir, hash, path) };
        } catch (err) {
          context.log(`get-file-diff failed: ${this.getError(err)}`, 'error');
          return { diff: '', error: this.getError(err) };
        }
      }
      case 'git-context': {
        const projectDir = String(args[0] ?? '');
        if (!projectDir) return { error: 'No project selected' };

        try {
          if (!(await isGitRepo(projectDir))) {
            return { error: 'Not a git repository' };
          }
          return await getContextInfo(projectDir);
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'create-patch': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          const patchPath = await createPatch(projectDir, hash);
          context.log(`Created patch ${patchPath}`, 'info');
          return { patchPath };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'cherry-pick': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          await cherryPick(projectDir, hash);
          context.log(`Cherry-picked ${hash} into current branch`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'checkout-revision': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          await checkoutRevision(projectDir, hash);
          context.log(`Checked out revision ${hash}`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'reset-branch': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        const mode = String(args[2] ?? 'mixed') as GitResetMode;
        if (!projectDir || !hash) return { error: 'Missing project or commit' };
        if (!['soft', 'mixed', 'hard'].includes(mode)) return { error: `Invalid reset mode: ${mode}` };

        try {
          await resetBranch(projectDir, hash, mode);
          context.log(`Reset branch to ${hash} (${mode})`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'revert-commit': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          await revertCommit(projectDir, hash);
          context.log(`Reverted commit ${hash}`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'undo-commit': {
        const projectDir = String(args[0] ?? '');
        const mode = String(args[1] ?? 'mixed') as 'soft' | 'mixed';
        if (!projectDir) return { error: 'Missing project' };
        if (!['soft', 'mixed'].includes(mode)) return { error: `Invalid undo mode: ${mode}` };

        try {
          await undoCommit(projectDir, mode);
          context.log(`Undo commit (${mode})`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'amend-message': {
        const projectDir = String(args[0] ?? '');
        const subject = String(args[1] ?? '');
        const body = String(args[2] ?? '');
        if (!projectDir) return { error: 'Missing project' };

        try {
          await amendCommitMessage(projectDir, subject, body);
          context.log('Amended commit message', 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'push-up-to': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        const force = Boolean(args[2] ?? false);
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          await pushUpTo(projectDir, hash, force);
          context.log(`Pushed commits up to ${hash}`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'create-branch': {
        const projectDir = String(args[0] ?? '');
        const name = String(args[1] ?? '').trim();
        const hash = String(args[2] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };
        if (!name) return { error: 'Branch name is required' };

        try {
          await createBranch(projectDir, name, hash);
          context.log(`Created branch ${name} at ${hash}`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'create-tag': {
        const projectDir = String(args[0] ?? '');
        const name = String(args[1] ?? '').trim();
        const hash = String(args[2] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };
        if (!name) return { error: 'Tag name is required' };

        try {
          await createTag(projectDir, name, hash);
          context.log(`Created tag ${name} at ${hash}`, 'info');
          return { ok: true };
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'compare-local': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { diff: '', error: 'Missing project or commit' };

        try {
          return { diff: await getCommitDiffToLocal(projectDir, hash) };
        } catch (err) {
          return { diff: '', error: this.getError(err) };
        }
      }
      case 'get-neighbors': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { error: 'Missing project or commit' };

        try {
          return await getNeighbors(projectDir, hash);
        } catch (err) {
          return { error: this.getError(err) };
        }
      }
      case 'open-commit-url': {
        const projectDir = String(args[0] ?? '');
        const hash = String(args[1] ?? '');
        if (!projectDir || !hash) return { opened: false };

        try {
          const info = await getContextInfo(projectDir);
          const url = info.remoteUrl ? remoteUrlToWebUrl(info.remoteUrl, hash) : null;
          if (!url) return { opened: false, error: 'Could not infer web URL from origin remote' };
          await context.openUrl(url, 'external');
          return { opened: true };
        } catch (err) {
          return { opened: false, error: this.getError(err) };
        }
      }
      default:
        return undefined;
    }
  }
}
