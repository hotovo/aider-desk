/**
 * Multi-Model Run Extension
 *
 * Allows running the same prompt across multiple models simultaneously.
 * Provides a UI component at 'task-top-bar-left' placement to select up to 10 models.
 * When a prompt is started with multiple models configured, duplicates the task
 * for each additional model and runs the same prompt.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type { Extension, ExtensionContext, PromptStartedEvent, UIComponentDefinition } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ModelSelection {
  index: number;
  modelId: string;
}

const COMPONENT_ID = 'multi-model-selector';

export default class MultiModelRunExtension implements Extension {
  static metadata = {
    name: 'Multi-Model Run',
    version: '2.0.0',
    description: 'Run the same prompt across multiple models simultaneously',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/multi-model-run/icon.png',
    capabilities: ['ui', 'workflows'],
  };

  private modelSelectionsPerTask: Map<string, ModelSelection[]> = new Map();
  private useWorktreesPerTask: Map<string, boolean> = new Map();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Multi-Model Run Extension loaded', 'info');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsxTemplate = readFileSync(join(__dirname, './MultiModelSelectorComponent.jsx'), 'utf-8');

    const COMPONENT: UIComponentDefinition = {
      id: COMPONENT_ID,
      placement: 'task-top-bar-left',
      jsx: jsxTemplate,
      loadData: true,
    };

    return [COMPONENT];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;

    if (!taskId) {
      return { models: [] };
    }

    const selections = this.modelSelectionsPerTask.get(taskId) ?? [];
    const useWorktrees = this.useWorktreesPerTask.get(taskId) ?? true;

    return {
      models: selections,
      useWorktrees,
    };
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId !== COMPONENT_ID) {
      return undefined;
    }

    context.log(`executeUIExtensionAction: ${action} with args: ${JSON.stringify(args)}`, 'info');

    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;

    if (!taskId) {
      context.log('No active task context available', 'error');
      return undefined;
    }

    const taskAgentProfile = await taskContext?.getTaskAgentProfile();

    switch (action) {
      case 'add-model': {
        context.log('Adding model', 'info');
        const currentSelections = this.modelSelectionsPerTask.get(taskId) ?? [];
        const newSelection: ModelSelection = {
          index: currentSelections.length,
          modelId: taskAgentProfile ? `${taskAgentProfile.provider}/${taskAgentProfile.model}` : 'anthropic/claude-sonnet-4-5',
        };
        const updatedSelections = [...currentSelections, newSelection];
        this.modelSelectionsPerTask.set(taskId, updatedSelections);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return { success: true, models: updatedSelections };
      }

      case 'remove-model': {
        context.log('Removing model', 'info');
        const index = args[0] as number;
        const currentSelections = this.modelSelectionsPerTask.get(taskId) ?? [];
        const updatedSelections = currentSelections.filter((_, i) => i !== index).map((s, i) => ({ ...s, index: i }));
        this.modelSelectionsPerTask.set(taskId, updatedSelections);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return { success: true, models: updatedSelections };
      }

      case 'update-model': {
        context.log('Updating model', 'info');
        const index = args[0] as number;
        const modelId = args[1] as string;
        const currentSelections = this.modelSelectionsPerTask.get(taskId) ?? [];
        if (index < 0 || index >= currentSelections.length) {
          return { success: false, error: 'Invalid model index' };
        }
        const updatedSelections = currentSelections.map((s, i) => (i === index ? { ...s, modelId } : s));
        this.modelSelectionsPerTask.set(taskId, updatedSelections);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return { success: true, models: updatedSelections };
      }

      case 'set-use-worktrees': {
        context.log('Setting use worktrees', 'info');
        const useWorktrees = args[0] as boolean;
        this.useWorktreesPerTask.set(taskId, useWorktrees);
        context.triggerUIDataRefresh(COMPONENT_ID);
        return { success: true, useWorktrees };
      }

      default:
        return undefined;
    }
  }

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;

    if (!taskId) {
      return;
    }

    const selections = this.modelSelectionsPerTask.get(taskId) ?? [];
    const validSelections = selections.filter((s) => s.modelId);

    if (validSelections.length === 0) {
      return;
    }

    const useWorktrees = this.useWorktreesPerTask.get(taskId) ?? true;
    const projectContext = context.getProjectContext();
    const { prompt, mode } = event;

    const sourceWorktreePath = taskContext?.data?.worktree?.path;
    const sourceInWorktree = taskContext?.data?.workingMode === 'worktree' && !!sourceWorktreePath;

    let firstDuplicateHandled = false;

    for (const selection of validSelections) {
      const duplicatedTask = await projectContext.duplicateTask(taskId);

      const newTaskContext = projectContext.getTask(duplicatedTask.id);
      if (newTaskContext) {
        const modelParts = selection.modelId.split('/');

        await newTaskContext.updateTask({
          name: `[${modelParts.slice(1).join('/')}] ${prompt.substring(0, 45)}${prompt.length > 45 ? '...' : ''}`,
          provider: modelParts[0],
          model: modelParts.slice(1).join('/'),
          autonomyMode: taskContext?.data?.autonomyMode,
        });

        if (useWorktrees) {
          if (sourceInWorktree) {
            await newTaskContext.switchToLocalWorkingMode({
              mergeBeforeSwitch: false,
            });
            // Clear the parent
            await newTaskContext.updateTask({
              parentId: null
            });
            await newTaskContext.switchToWorktreeWorkingMode({
              carryOverUncommittedChanges: false,
              dropSourceChanges: false,
            });

            // Carry over commits and uncommitted changes from the source worktree
            const newWorktreePath = newTaskContext.data?.worktree?.path;
            if (newWorktreePath && taskContext) {
              await taskContext.mergeWorktreeToWorktree(newWorktreePath, true);
            }
          } else {
            await newTaskContext.switchToWorktreeWorkingMode({
              carryOverUncommittedChanges: true,
              dropSourceChanges: false,
            });
          }
        } else if (sourceInWorktree) {
          if (!firstDuplicateHandled) {
            await newTaskContext.switchToLocalWorkingMode({
              mergeBeforeSwitch: true,
            });
            firstDuplicateHandled = true;
          } else {
            await newTaskContext.switchToLocalWorkingMode({
              mergeBeforeSwitch: false,
            });
          }
          await newTaskContext.updateTask({ parentId: null });
        }

        void newTaskContext.runPrompt(prompt, mode);
      }
    }

    this.modelSelectionsPerTask.delete(taskId);
    this.useWorktreesPerTask.delete(taskId);
    context.triggerUIDataRefresh(COMPONENT_ID);
  }
}
