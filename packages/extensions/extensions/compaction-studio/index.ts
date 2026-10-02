import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CommandDefinition,
  Extension,
  ExtensionContext,
  SmartCompactionPasses,
  UIComponentDefinition,
} from '@aiderdesk/extensions';

import { collectStats } from './stats';
import { getTaskState, saveTaskState } from './storage';
import type { CompactionStudioRunResult, CompactionStudioSettings } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PANEL_COMPONENT_ID = 'compaction-panel';

const PASS_KEYS = [
  'erroredTools',
  'fileEdits',
  'staleFileReads',
  'fileReads',
  'searches',
  'semanticSearches',
  'bash',
  'fetch',
  'otherTools',
  'verboseToolCalls',
  'reasoning',
] as const;

const DEFAULT_SETTINGS: CompactionStudioSettings = {
  protectedMessageCount: 10,
  compactionLevel: 1,
  passes: {
    erroredTools: true,
    fileEdits: true,
    staleFileReads: true,
    fileReads: true,
    searches: true,
    semanticSearches: true,
    bash: true,
    fetch: true,
    otherTools: true,
    verboseToolCalls: false,
    reasoning: false,
  },
};

const normalizeSettings = (options: Partial<CompactionStudioSettings>): CompactionStudioSettings => {
  const passes: SmartCompactionPasses = { ...DEFAULT_SETTINGS.passes };
  if (options.passes && typeof options.passes === 'object') {
    for (const key of PASS_KEYS) {
      if (typeof options.passes[key] === 'boolean') {
        passes[key] = options.passes[key];
      }
    }
  }

  const protectedMessageCount = Number(options.protectedMessageCount);
  const compactionLevel = Number(options.compactionLevel);

  return {
    protectedMessageCount:
      Number.isFinite(protectedMessageCount) && protectedMessageCount >= 0
        ? Math.floor(protectedMessageCount)
        : DEFAULT_SETTINGS.protectedMessageCount,
    compactionLevel: Number.isFinite(compactionLevel) ? Math.min(Math.max(Math.round(compactionLevel), 1), 3) : DEFAULT_SETTINGS.compactionLevel,
    passes,
  };
};

export default class CompactionStudioExtension implements Extension {
  static metadata = {
    name: 'Compaction Studio',
    version: '1.0.0',
    description: 'Manually compact the current context with full control over what gets compacted, the safe window and the compaction level',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/compaction-studio/icon.png',
    capabilities: ['ui', 'commands'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Compaction Studio extension loaded', 'info');
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [
      {
        name: 'compaction-studio',
        description: 'Toggle the Compaction Studio panel to manually compact the current context',
        arguments: [],
        execute: async (_args: string[], context: ExtensionContext): Promise<void> => {
          const taskContext = context.getTaskContext();
          const projectDir = context.getProjectDir();
          if (!taskContext || !projectDir) {
            context.log('No active task context available', 'error');
            return;
          }

          const taskId = taskContext.data.id;
          const state = getTaskState(projectDir, taskId);
          saveTaskState(projectDir, taskId, { visible: !state.visible });
          context.triggerUIDataRefresh(undefined, taskId);
        },
      },
    ];
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const panelJsx = readFileSync(join(__dirname, 'CompactPanel.jsx'), 'utf-8');

    return [
      {
        id: PANEL_COMPONENT_ID,
        name: 'Compaction Studio',
        placement: 'task-state-actions-all',
        jsx: panelJsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== PANEL_COMPONENT_ID) {
      return null;
    }

    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();
    if (!projectDir || !taskContext) {
      return null;
    }

    const taskId = taskContext.data.id;
    const state = getTaskState(projectDir, taskId);
    const settings = state.settings ?? DEFAULT_SETTINGS;
    const messages = await taskContext.getContextMessages();

    let estimatedTokens = 0;
    try {
      estimatedTokens = await taskContext.getEstimatedTokens();
    } catch {
      estimatedTokens = 0;
    }

    return {
      visible: state.visible === true,
      settings,
      lastResult: state.lastResult ?? null,
      totalMessages: messages.length,
      estimatedTokens,
      stats: collectStats(messages, settings.protectedMessageCount),
    };
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId !== PANEL_COMPONENT_ID) {
      return null;
    }

    const projectDir = context.getProjectDir();
    const taskContext = context.getTaskContext();
    if (!projectDir || !taskContext) {
      return null;
    }
    const taskId = taskContext.data.id;

    switch (action) {
      case 'hide': {
        saveTaskState(projectDir, taskId, { visible: false });
        context.triggerUIDataRefresh(undefined, taskId);
        return { success: true };
      }

      case 'update-settings': {
        const settings = normalizeSettings((args[0] ?? {}) as Partial<CompactionStudioSettings>);
        saveTaskState(projectDir, taskId, { settings });
        context.triggerUIDataRefresh(undefined, taskId);
        return { success: true };
      }

      case 'compact': {
        const settings = normalizeSettings((args[0] ?? {}) as Partial<CompactionStudioSettings>);

        const result = await taskContext.smartCompact(settings);

        const savedTokens = Math.max(0, result.tokensBefore - result.tokensAfter);
        const runResult: CompactionStudioRunResult = { ...result, savedTokens };
        saveTaskState(projectDir, taskId, { settings, lastResult: runResult });

        taskContext.addLogMessage(
          'info',
          `Compaction Studio: ~${result.tokensAfter.toLocaleString()} estimated tokens after compaction (${result.messagesBefore} → ${result.messagesAfter} messages, was ~${result.tokensBefore.toLocaleString()}, saved ~${savedTokens.toLocaleString()}).`,
        );
        context.triggerUIDataRefresh(undefined, taskId);

        return runResult;
      }

      default:
        return null;
    }
  }
}
