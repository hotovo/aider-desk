import fs from 'fs/promises';
import path from 'path';

import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';
import { Mode, ResponseCompletedData, ContextFile, TaskData, QuestionData, ContextMessage } from '@common/types';

import { HookContext, HookContextImpl } from './hook-context';

import type { FinishReason } from 'ai';

import { Task } from '@/task/task';
import { Project } from '@/project/project';
import { AIDER_DESK_HOOKS_DIR, AIDER_DESK_GLOBAL_HOOKS_DIR } from '@/constants';
import logger from '@/logger';
import { ResponseMessage } from '@/messages';

export interface HookEventMap {
  onTaskCreated: {
    task: TaskData;
  };
  onTaskInitialized: {
    task: TaskData;
  };
  onTaskClosed: {
    task: TaskData;
  };
  onPromptSubmitted: {
    prompt: string;
    mode: Mode;
  };
  onPromptStarted: {
    prompt: string | null;
    mode: Mode;
  };
  onPromptFinished: {
    responses: ResponseCompletedData[];
  };
  onAgentStarted: {
    prompt: string | null;
    contextMessages: ContextMessage[];
    contextFiles: ContextFile[];
  };
  onAgentFinished: {
    contextMessages: ContextMessage[];
    resultMessages: ContextMessage[];
    aborted: boolean;
  };
  onAgentStepFinished: {
    stepResult: unknown;
    finishReason: FinishReason;
    responseMessages: ContextMessage[];
  };
  onToolCalled: {
    toolName: string;
    args: Record<string, unknown> | undefined;
  };
  onToolFinished: {
    toolName: string;
    args: Record<string, unknown> | undefined;
    result: unknown;
  };
  onFileAdded: {
    file: ContextFile;
  };
  onFileDropped: {
    filePath: string;
  };
  onCommandExecuted: {
    command: string;
  };
  onAiderPromptStarted: {
    prompt: string;
    mode: Mode;
  };
  onAiderPromptFinished: {
    responses: ResponseCompletedData[];
  };
  onQuestionAsked: {
    question: QuestionData;
  };
  onQuestionAnswered: {
    question: QuestionData;
    answer: string;
    userInput?: string;
  };
  onHandleApproval: {
    key: string;
    text: string;
    subject?: string;
  };
  onSubagentStarted: {
    subagentId: string;
    prompt: string;
  };
  onSubagentFinished: {
    subagentId: string;
    resultMessages: ContextMessage[];
  };
  onResponseMessageProcessed: {
    message: ResponseMessage;
  };
}

export type HookFunctions = {
  [K in keyof HookEventMap]?: (event: HookEventMap[K], context: HookContext) => Promise<unknown> | unknown;
};

export class HookManager {
  private globalHooks: HookFunctions[] = [];
  private projectHooksCache: Map<string, HookFunctions[]> = new Map();
  private globalInitialized = false;

  private globalWatcher: FSWatcher | null = null;
  private projectWatchers: Map<string, FSWatcher> = new Map();

  constructor() {}

  public async init() {
    if (this.globalInitialized) {
      return;
    }
    this.globalHooks = await this.loadHooksFromDir(AIDER_DESK_GLOBAL_HOOKS_DIR);
    await this.setupGlobalWatcher();
    this.globalInitialized = true;
  }

  private async setupGlobalWatcher() {
    if (this.globalWatcher) {
      await this.globalWatcher.close();
    }

    this.globalWatcher = await this.setupWatcherForDir(AIDER_DESK_GLOBAL_HOOKS_DIR, async () => {
      logger.info('Global hooks changed, reloading...');
      this.globalHooks = await this.loadHooksFromDir(AIDER_DESK_GLOBAL_HOOKS_DIR);
    });
  }

  public async reloadProjectHooks(projectDir: string) {
    const projectHooksDir = path.join(projectDir, AIDER_DESK_HOOKS_DIR);
    const hooks = await this.loadHooksFromDir(projectHooksDir);
    this.projectHooksCache.set(projectDir, hooks);

    if (!this.projectWatchers.has(projectDir)) {
      const watcher = await this.setupWatcherForDir(projectHooksDir, async () => {
        logger.info(`Project hooks changed for ${projectDir}, reloading...`);
        const updatedHooks = await this.loadHooksFromDir(projectHooksDir);
        this.projectHooksCache.set(projectDir, updatedHooks);
      });
      if (watcher) {
        this.projectWatchers.set(projectDir, watcher);
      }
    }

    logger.info(`Reloaded hooks for project: ${projectDir}`);
  }

  public async stopWatchingProject(projectDir: string) {
    const watcher = this.projectWatchers.get(projectDir);
    if (watcher) {
      await watcher.close();
      this.projectWatchers.delete(projectDir);
    }
    this.projectHooksCache.delete(projectDir);
    logger.info(`Stopped watching hooks for project: ${projectDir}`);
  }

  private async setupWatcherForDir(dir: string, onChange: () => Promise<void>): Promise<FSWatcher | null> {
    try {
      const dirExists = await fs
        .access(dir)
        .then(() => true)
        .catch(() => false);
      if (!dirExists) {
        await fs.mkdir(dir, { recursive: true });
      }

      const debouncedOnChange = debounce(onChange, 1000);

      const watcher = watch(dir, {
        persistent: true,
        usePolling: true,
        ignoreInitial: true,
      });

      watcher
        .on('add', debouncedOnChange)
        .on('change', debouncedOnChange)
        .on('unlink', debouncedOnChange)
        .on('error', (error) => {
          logger.error(`Watcher error for hooks directory ${dir}:`, error);
        });

      return watcher;
    } catch (error) {
      logger.error(`Failed to setup watcher for hooks directory ${dir}:`, error);
      return null;
    }
  }

  private async loadHooksFromDir(dir: string): Promise<HookFunctions[]> {
    const hooks: HookFunctions[] = [];
    try {
      const dirExists = await fs
        .access(dir)
        .then(() => true)
        .catch(() => false);
      if (!dirExists) {
        return hooks;
      }

      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const filePath = path.join(dir, file);
          try {
            // Clear cache to allow reloading
            const resolvedPath = require.resolve(filePath);
            delete require.cache[resolvedPath];
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const hookFile = require(filePath);
            hooks.push(hookFile);
            logger.info(`Loaded hook file: ${filePath}`);
          } catch (error) {
            logger.error(`Failed to load hook file ${filePath}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to load hooks from ${dir}:`, error);
    }
    return hooks;
  }

  public async trigger<K extends keyof HookEventMap>(
    hookName: K,
    event: HookEventMap[K],
    task: Task,
    project: Project,
  ): Promise<{ event: HookEventMap[K]; blocked: boolean; result?: unknown }> {
    if (!this.globalInitialized) {
      await this.init();
    }

    let projectHooks = this.projectHooksCache.get(project.baseDir);
    if (projectHooks === undefined) {
      await this.reloadProjectHooks(project.baseDir);
      projectHooks = this.projectHooksCache.get(project.baseDir) || [];
    }

    const allHooks = [...this.globalHooks, ...projectHooks];
    const context = new HookContextImpl(task, project);
    let currentEvent = { ...event };
    let blocked = false;
    let hookResult: unknown = undefined;

    for (const hook of allHooks) {
      logger.debug(`Executing hook ${hookName}`, {
        hookName,
        event,
        hook,
      });
      const hookFn = hook[hookName];
      if (typeof hookFn === 'function') {
        logger.debug(`Hook function found for ${hookName}`, {
          hookName,
          event,
          hook,
        });

        try {
          const result = await hookFn(currentEvent, context);
          logger.debug(`Hook function result for ${hookName}`, {
            hookName,
            event,
            hook,
            result,
          });

          if (result === false) {
            if (hookName === 'onHandleApproval') {
              hookResult = false;
            } else {
              blocked = true;
            }
            break;
          }

          if (result === true && hookName === 'onHandleApproval') {
            hookResult = true;
            break;
          }

          if (typeof result === 'string' && hookName === 'onQuestionAsked') {
            hookResult = result;
            break;
          }

          if (result && typeof result === 'object') {
            if (hookName === 'onResponseMessageProcessed') {
              hookResult = result;
            } else {
              currentEvent = { ...currentEvent, ...result };
            }
          }

          if (result && hookName === 'onToolFinished') {
            hookResult = result;
            currentEvent = { ...currentEvent, result };
          }
        } catch (error) {
          logger.error(`Error executing hook ${hookName}:`, error);
        }
      }
    }

    return { event: currentEvent, blocked, result: hookResult };
  }

  public async dispose() {
    if (this.globalWatcher) {
      await this.globalWatcher.close();
      this.globalWatcher = null;
    }
    for (const watcher of this.projectWatchers.values()) {
      await watcher.close();
    }
    this.projectWatchers.clear();
    this.projectHooksCache.clear();
    logger.info('HookManager disposed');
  }
}
