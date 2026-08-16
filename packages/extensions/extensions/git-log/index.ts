import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Extension, ExtensionContext, ProjectStartedEvent, ProjectStoppedEvent, UIComponentDefinition } from '@aiderdesk/extensions';

import { getBranches, getCommitDetail, getFileDiff, getLog, isGitRepo } from './core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMPONENT_ID = 'git-log';
const DEFAULT_PAGE_SIZE = 200;

const gitLogJsx = readFileSync(join(__dirname, './ui/GitLog.jsx'), 'utf-8');

export default class GitLogExtension implements Extension {
  static metadata = {
    name: 'Git Log',
    version: '1.0.0',
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
      default:
        return undefined;
    }
  }
}
