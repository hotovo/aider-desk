import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Extension, ExtensionContext, UIComponentDefinition, AgentStartedEvent, Reasoning, TaskCreatedEvent } from '@aiderdesk/extensions';

const METADATA_KEY = 'reasoningEffort';

const REASONING_OPTIONS = [
  { value: '', label: 'Use default' },
  { value: 'none', label: 'None' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'xHigh' },
];

const AIDER_MODES = ['code', 'ask', 'architect', 'context'];

const selectorJsx = readFileSync(join(__dirname, './ReasoningSelector.jsx'), 'utf-8');

export default class ReasoningSelectorExtension implements Extension {
  static metadata = {
    name: 'Reasoning Selector',
    version: '1.1.0',
    description: 'Adds a reasoning effort selector dropdown next to the model selector in agent mode',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/reasoning-selector/icon.png',
    capabilities: ['ui'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Reasoning Selector extension loaded', 'info');
  }

  async onUnload(): Promise<void> {}

  async onTaskCreated(
    event: TaskCreatedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<TaskCreatedEvent>> {
    const metadata = event.task.metadata ?? {};
    if (METADATA_KEY in metadata) {
      return undefined;
    }

    const projectContext = context.getProjectContext();
    const profileId = event.task.agentProfileId ?? projectContext.getProjectSettings().agentProfileId;
    const profile = projectContext.getAgentProfiles().find((agentProfile) => agentProfile.id === profileId);
    const hasTaskModelOverride = !!event.task.provider && !!event.task.model;
    const provider = hasTaskModelOverride ? event.task.provider : profile?.provider;
    const model = hasTaskModelOverride ? event.task.model : profile?.model;
    if (!provider || !model) {
      return undefined;
    }

    const matchingTask = (await projectContext.getTasks())
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
      .slice(0, 10)
      .find((task) => task.provider === provider && task.model === model);
    const reasoningEffort = matchingTask?.metadata?.[METADATA_KEY];
    if (typeof reasoningEffort !== 'string' || !reasoningEffort) {
      return undefined;
    }

    return {
      task: {
        ...event.task,
        metadata: {
          ...metadata,
          [METADATA_KEY]: reasoningEffort,
        },
      },
    };
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    return [
      {
        id: 'reasoning-selector',
        placement: 'task-top-bar-left',
        jsx: selectorJsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== 'reasoning-selector') {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return { reasoningEffort: '', options: REASONING_OPTIONS, isAgentMode: false };
    }

    const mode = taskContext.data.currentMode;
    const isAgentMode = !!mode && !AIDER_MODES.includes(mode);
    const reasoningEffort = (taskContext.data.metadata?.[METADATA_KEY] as string) ?? '';

    return { reasoningEffort, options: REASONING_OPTIONS, isAgentMode };
  }

  async executeUIExtensionAction(
    _componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (action === 'set-reasoning') {
      const taskContext = context.getTaskContext();
      if (!taskContext) return undefined;

      const value = (args[0] as string) ?? '';
      const existingMetadata = { ...taskContext.data.metadata };
      if (value) {
        existingMetadata[METADATA_KEY] = value;
      } else {
        delete existingMetadata[METADATA_KEY];
      }

      await taskContext.updateTask({ metadata: existingMetadata });
      context.triggerUIDataRefresh('reasoning-selector');
    }

    return undefined;
  }

  async onAgentStarted(
    event: AgentStartedEvent,
    context: ExtensionContext,
  ): Promise<void | Partial<AgentStartedEvent>> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const reasoningEffort = taskContext.data.metadata?.[METADATA_KEY] as string | undefined;
    if (!reasoningEffort) {
      return undefined;
    }

    context.log(`Reasoning Selector: overriding reasoning to '${reasoningEffort}'`, 'info');

    return {
      modelCallSettings: {
        reasoning: reasoningEffort as Reasoning,
      },
    };
  }
}
