import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  Extension,
  ExtensionContext,
  ProjectContext,
  TaskClosedEvent,
  TaskContext,
  TaskUpdatedEvent,
  UIComponentDefinition,
} from '@aiderdesk/extensions';

interface VerifierConfig {
  maxRetries: number;
}

const DEFAULT_CONFIG: VerifierConfig = {
  maxRetries: 3,
};

interface WatchedTask {
  initialUserMessage: string;
  planMessage: string;
  reviewCount: number;
}

const TASK_ACTIONS_COMPONENT_ID = 'verifier-task-actions';

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && 'type' in c && c.type === 'text' && 'text' in c) {
          return (c as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'object' && content !== null && 'content' in content) {
    return extractText((content as { content: unknown }).content);
  }
  return '';
}

const taskActionsJsx = readFileSync(join(__dirname, 'TaskActions.jsx'), 'utf-8');
const configComponentJsx = readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8');

export default class VerifierExtension implements Extension {
  static metadata = {
    name: 'Verifier',
    version: '1.0.0',
    description:
      'Adds "Proceed & Verify" button to start implementation with automatic review against the plan. Configurable max retries.',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/verifier/icon.png',
    capabilities: ['workflows', 'ui'],
  };

  private configPath: string;
  private watchedTasks = new Map<string, WatchedTask>();

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  private loadConfig(): VerifierConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch {
      // Ignore errors, return defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<VerifierConfig> {
    return this.loadConfig();
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as Partial<VerifierConfig>;
    const merged = { ...DEFAULT_CONFIG, ...config };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }

  getUIComponents(): UIComponentDefinition[] {
    return [
      {
        id: TASK_ACTIONS_COMPONENT_ID,
        placement: 'task-state-actions',
        jsx: taskActionsJsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async getUIExtensionData(
    componentId: string,
    _context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== TASK_ACTIONS_COMPONENT_ID) {
      return undefined;
    }
    return { isWatching: false };
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== TASK_ACTIONS_COMPONENT_ID || action !== 'proceed-and-verify') {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No task context available for proceed-and-verify action', 'warn');
      return undefined;
    }

    const taskId = taskContext.data.id;

    try {
      const messages = await taskContext.getContextMessages();

      const firstUserMsg = messages.find((m) => m.role === 'user');
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

      const userText = firstUserMsg ? extractText(firstUserMsg.content) : '';
      const planText = lastAssistantMsg ? extractText(lastAssistantMsg.content) : '';

      if (userText || planText) {
        this.watchedTasks.set(taskId, {
          initialUserMessage: userText,
          planMessage: planText,
          reviewCount: 0,
        });
        context.log(`Started watching task "${taskContext.data.name}" for verification`, 'info');
      } else {
        context.log('No user or plan text found, skipping verification watch', 'warn');
      }
    } catch (error) {
      context.log(`Failed to capture plan: ${error}`, 'error');
    }

    await taskContext.runPrompt('Proceed.');
    return { success: true };
  }

  async onTaskClosed(event: TaskClosedEvent, context: ExtensionContext): Promise<void> {
    const wasWatched = this.watchedTasks.has(event.task.id);
    this.watchedTasks.delete(event.task.id);
    if (wasWatched) {
      context.log(`Task "${event.task.name}" closed, removed from watch list`, 'info');
    }
  }

  async onTaskUpdated(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void> {
    const { task } = event;
    const taskId = task.id;

    if (!this.watchedTasks.has(taskId)) {
      return;
    }

    if (task.state === 'READY_FOR_REVIEW') {
      const watched = this.watchedTasks.get(taskId)!;
      const config = this.loadConfig();

      if (watched.reviewCount >= config.maxRetries) {
        context.log(`Max retries (${config.maxRetries}) reached for "${task.name}", unwatching`, 'warn');
        this.watchedTasks.delete(taskId);
        return;
      }

      const projectContext = context.getProjectContext();
      const taskContext = context.getTaskContext();
      if (!taskContext) {
        context.log('No taskContext available for READY_FOR_REVIEW task', 'warn');
        return;
      }

      watched.reviewCount++;
      context.log(`Starting review #${watched.reviewCount} for "${task.name}"`, 'info');

      const capturedWatched = { ...watched };
      setImmediate(() => {
        void this.performReview(taskId, capturedWatched, projectContext, taskContext, context);
      });
    }
  }

  private async performReview(
    taskId: string,
    watched: WatchedTask,
    projectContext: ProjectContext,
    originalTaskContext: TaskContext,
    context: ExtensionContext,
  ): Promise<void> {
    try {
      const taskName = originalTaskContext.data.name || 'Task';
      const parentId = originalTaskContext.data.parentId || taskId;

      const updatedFiles = await originalTaskContext.getUpdatedFiles();
      const updatedFilesList =
        updatedFiles.length > 0
          ? updatedFiles.map((f) => `- ${f.path}`).join('\n')
          : 'No files were detected as modified';

      const reviewTask = await projectContext.createTask({
        parentId,
        name: `Review: ${taskName}`,
        autoApprove: true,
      });

      const reviewTaskContext = projectContext.getTask(reviewTask.id);
      if (!reviewTaskContext) {
        context.log('Failed to get review task context', 'error');
        return;
      }

      if (updatedFiles.length > 0) {
        await reviewTaskContext.addFiles(
          ...updatedFiles.map((f) => ({ path: f.path, readOnly: true })),
        );
      }

      const reviewPrompt = `You are an implementation reviewer. Verify that the following plan has been fully implemented.

## Original Request
${watched.initialUserMessage}

## Implementation Plan
${watched.planMessage}

## Modified Files
${updatedFilesList}

Review the current codebase and verify ALL items from the plan are implemented. Check:
1. Are all planned features/functions present?
2. Are all planned files created/modified?
3. Are there unresolved TODOs or placeholders?
4. Are there partial or stub implementations?

You MUST end your response with exactly one of:
- VERDICT: PASS
- VERDICT: FAIL

If VERDICT: FAIL, append with each missing item clearly.`;

      await reviewTaskContext.runPrompt(reviewPrompt);

      const reviewMessages = await reviewTaskContext.getContextMessages();
      const lastAssistantMsg = [...reviewMessages]
        .reverse()
        .find((m) => m.role === 'assistant');

      if (!lastAssistantMsg) {
        context.log('No assistant response found in review task', 'warn');
        return;
      }

      const reviewContent = extractText(lastAssistantMsg.content);
      const passed = reviewContent.includes('VERDICT: PASS');
      const failed = reviewContent.includes('VERDICT: FAIL');

      if (passed || !failed) {
        context.log(`Review PASSED for "${taskName}", unwatching task`, 'info');
        this.watchedTasks.delete(taskId);
      } else {
        context.log(`Review FAILED for "${taskName}", sending fix request`, 'info');

        const failIdx = reviewContent.indexOf('VERDICT: FAIL');
        const failureDetails = reviewContent.substring(failIdx + 'VERDICT: FAIL'.length).trim();

        const fixPrompt = `The implementation review found these issues:

${failureDetails || 'See the review subtask for details.'}

Please fix these items and ensure everything from the original plan is fully implemented.`;

        await originalTaskContext.runPrompt(fixPrompt);
      }
    } catch (error) {
      context.log(`Review error: ${error}`, 'error');
    }
  }
}
