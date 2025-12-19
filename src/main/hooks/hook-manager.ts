import fs from 'fs/promises';
import path from 'path';

import { Mode, ResponseCompletedData, ContextFile, TaskData, QuestionData } from '@common/types';

import { HookContext, HookContextImpl } from './hook-context';

import { Task } from '@/task/task';
import { Project } from '@/project/project';
import { AIDER_DESK_HOOKS_DIR, AIDER_DESK_GLOBAL_HOOKS_DIR } from '@/constants';
import logger from '@/logger';
import { ResponseMessage } from '@/messages';

export interface HookEventMap {
  onTaskCreated: { task: TaskData };
  onTaskInitialized: { task: TaskData };
  onTaskClosed: { task: TaskData };
  onPromptSubmitted: { prompt: string; mode: Mode };
  onPromptStarted: { prompt: string; mode: Mode };
  onPromptFinished: { responses: ResponseCompletedData[] };
  onAgentStarted: { prompt: string };
  onAgentFinished: { resultMessages: unknown[] };
  onAgentStepFinished: { stepResult: unknown };
  onToolCalled: { toolName: string; args: Record<string, unknown> | undefined };
  onToolFinished: { toolName: string; args: Record<string, unknown> | undefined; result: unknown };
  onFileAdded: { file: ContextFile };
  onFileDropped: { filePath: string };
  onCommandExecuted: { command: string };
  onAiderPromptStarted: { prompt: string; mode: Mode };
  onAiderPromptFinished: { responses: ResponseCompletedData[] };
  onQuestionAsked: { question: QuestionData };
  onQuestionAnswered: { question: QuestionData; answer: string; userInput?: string };
  onHandleApproval: { key: string; text: string; subject?: string };
  onSubagentStarted: { subagentId: string; prompt: string };
  onSubagentFinished: { subagentId: string; resultMessages: unknown[] };
  onResponseMessageProcessed: { message: ResponseMessage };
}

export type HookFunctions = {
  [K in keyof HookEventMap]?: (event: HookEventMap[K], context: HookContext) => Promise<unknown> | unknown;
};

export class HookManager {
  private globalHooks: HookFunctions[] = [];
  private projectHooksCache: Map<string, HookFunctions[]> = new Map();
  private globalInitialized = false;

  constructor() {}

  public async init() {
    if (this.globalInitialized) {
      return;
    }
    this.globalHooks = await this.loadHooksFromDir(AIDER_DESK_GLOBAL_HOOKS_DIR);
    this.globalInitialized = true;
  }

  public async reloadProjectHooks(projectDir: string) {
    const projectHooksDir = path.join(projectDir, AIDER_DESK_HOOKS_DIR);
    const hooks = await this.loadHooksFromDir(projectHooksDir);
    this.projectHooksCache.set(projectDir, hooks);
    logger.info(`Reloaded hooks for project: ${projectDir}`);
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
      const hookFn = hook[hookName];
      if (typeof hookFn === 'function') {
        try {
          const result = await hookFn(currentEvent, context);

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
        } catch (error) {
          logger.error(`Error executing hook ${hookName}:`, error);
        }
      }
    }

    return { event: currentEvent, blocked, result: hookResult };
  }
}
