import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { Extension, ExtensionContext, UIComponentDefinition, ResponseChunkEvent, ResponseCompletedEvent, CommandDefinition } from '@aiderdesk/extensions';

interface TPSData {
  currentTps: number;
  currentTokens: number;
  currentDuration: number;
  averageTps: number;
  peakTps: number;
  totalTokens: number;
  totalDuration: number;
  messageCount: number;
  isStreaming: boolean;
  subagentTps: number;
  subagentPeakTps: number;
  subagentCount: number;
}

interface MessageTPSData {
  taskId: string;
  tps: number;
  peakTps: number;
  tokens: number;
  duration: number;
  isStreaming: boolean;
}

interface Settings {
  usageInfoEnabled: boolean;
  messageBarEnabled: boolean;
}

const REFRESH_INTERVAL_MS = 100;
const MIN_RATE_WINDOW_SECONDS = 1;
const CHARS_PER_TOKEN = 4;

const emptyData = (): TPSData => ({
  currentTps: 0,
  currentTokens: 0,
  currentDuration: 0,
  averageTps: 0,
  peakTps: 0,
  totalTokens: 0,
  totalDuration: 0,
  messageCount: 0,
  isStreaming: false,
  subagentTps: 0,
  subagentPeakTps: 0,
  subagentCount: 0,
});

export default class TPSCounterExtension implements Extension {
  static metadata = {
    name: 'TPS Counter',
    version: '1.2.0',
    description: 'Displays real-time and completed-response tokens per second',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/tps-counter/icon.png',
    capabilities: ['metrics'],
  };

  private messageStartTimes: Map<string, number> = new Map();
  private messageTokenCounts: Map<string, number> = new Map();
  private messagePeakTps: Map<string, number> = new Map();
  private messageLastRefreshTimes: Map<string, number> = new Map();
  private messageTpsData: Map<string, MessageTPSData> = new Map();
  private taskData: Map<string, TPSData> = new Map();
  private activeMessageIds: Map<string, Set<string>> = new Map();
  private messageTaskIds: Map<string, string> = new Map();
  private currentData: TPSData = emptyData();
  private settings: Settings = { usageInfoEnabled: true, messageBarEnabled: true };
  private settingsPath = join(__dirname, 'settings.json');

  private loadSettings(): Settings {
    try {
      if (existsSync(this.settingsPath)) {
        const data = readFileSync(this.settingsPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch {
      // Ignore errors, use defaults
    }
    return { usageInfoEnabled: true, messageBarEnabled: true };
  }

  private saveSettings(): void {
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch {
      // Ignore errors
    }
  }

  private estimateTokens(text: string | undefined, reasoning: string | undefined): number {
    const characterCount = (text?.length ?? 0) + (reasoning?.length ?? 0);
    return characterCount > 0 ? Math.max(1, Math.ceil(characterCount / CHARS_PER_TOKEN)) : 0;
  }

  private getTaskData(taskId: string): TPSData {
    const existing = this.taskData.get(taskId);
    if (existing) return existing;
    const data = emptyData();
    this.taskData.set(taskId, data);
    return data;
  }

  private getLiveData(messageId: string, now: number): Omit<MessageTPSData, 'taskId'> {
    const startedAt = this.messageStartTimes.get(messageId) ?? now;
    const duration = Math.max(0, (now - startedAt) / 1000);
    const tokens = this.messageTokenCounts.get(messageId) ?? 0;
    const tps = tokens / Math.max(duration, MIN_RATE_WINDOW_SECONDS);
    const peakTps = Math.max(this.messagePeakTps.get(messageId) ?? 0, tps);
    this.messagePeakTps.set(messageId, peakTps);
    return { tps, peakTps, tokens, duration, isStreaming: true };
  }

  private refreshUI(messageId: string, context: ExtensionContext, force = false): void {
    const now = Date.now();
    const lastRefresh = this.messageLastRefreshTimes.get(messageId) ?? 0;
    if (!force && now - lastRefresh < REFRESH_INTERVAL_MS) return;
    this.messageLastRefreshTimes.set(messageId, now);
    context.triggerUIDataRefresh('tps-counter');
    context.triggerUIDataRefresh('tps-counter-message-bar');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    this.settings = this.loadSettings();
    context.log('TPS Counter extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    this.messageStartTimes.clear();
    this.messageTokenCounts.clear();
    this.messagePeakTps.clear();
    this.messageLastRefreshTimes.clear();
    this.messageTpsData.clear();
    this.taskData.clear();
    this.activeMessageIds.clear();
    this.messageTaskIds.clear();
    this.currentData = emptyData();
  }

  async onResponseChunk(event: ResponseChunkEvent, context: ExtensionContext): Promise<void> {
    const messageId = event.chunk.messageId;
    const now = Date.now();

    if (!this.messageStartTimes.has(messageId)) {
      this.messageStartTimes.set(messageId, now);
    }

    const tokenIncrement = this.estimateTokens(event.chunk.chunk, event.chunk.reasoning);
    this.messageTokenCounts.set(messageId, (this.messageTokenCounts.get(messageId) ?? 0) + tokenIncrement);

    const taskId = event.chunk.taskId;
    const taskData = this.getTaskData(taskId);
    const liveData = this.getLiveData(messageId, now);
    this.messageTaskIds.set(messageId, taskId);
    this.messageTpsData.set(messageId, { taskId, ...liveData });
    const activeMessages = this.activeMessageIds.get(taskId) ?? new Set<string>();
    activeMessages.add(messageId);
    this.activeMessageIds.set(taskId, activeMessages);
    taskData.currentTps = liveData.tps;
    taskData.currentTokens = liveData.tokens;
    taskData.currentDuration = liveData.duration;
    taskData.peakTps = Math.max(taskData.peakTps, liveData.peakTps);
    taskData.isStreaming = true;
    this.refreshUI(messageId, context);
  }

  async onResponseCompleted(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void> {
    const messageId = event.response.messageId;
    const startTime = this.messageStartTimes.get(messageId);
    if (!startTime) return;

    const taskId = this.messageTaskIds.get(messageId) ?? event.response.promptContext?.id ?? 'unknown';
    const taskData = this.getTaskData(taskId);
    const endTime = Date.now();
    const durationSeconds = Math.max(0, (endTime - startTime) / 1000);
    const streamedTokens = this.messageTokenCounts.get(messageId) ?? 0;
    const reportedTokens = event.response.usageReport?.receivedTokens ?? 0;
    const totalTokens = reportedTokens > 0 ? reportedTokens : streamedTokens;
    const currentTps = totalTokens / Math.max(durationSeconds, MIN_RATE_WINDOW_SECONDS);
    const peakTps = Math.max(this.messagePeakTps.get(messageId) ?? 0, currentTps);

    taskData.totalTokens += totalTokens;
    taskData.totalDuration += durationSeconds;
    taskData.messageCount += 1;
    taskData.currentTps = currentTps;
    taskData.currentTokens = totalTokens;
    taskData.currentDuration = durationSeconds;
    taskData.peakTps = Math.max(taskData.peakTps, peakTps);
    taskData.averageTps = taskData.totalDuration > 0 ? taskData.totalTokens / taskData.totalDuration : 0;
    const activeMessages = this.activeMessageIds.get(taskId);
    activeMessages?.delete(messageId);
    taskData.isStreaming = (activeMessages?.size ?? 0) > 0;

    this.messageTpsData.set(messageId, {
      taskId,
      tps: currentTps,
      peakTps,
      tokens: totalTokens,
      duration: durationSeconds,
      isStreaming: false,
    });

    this.messageStartTimes.delete(messageId);
    this.messageTokenCounts.delete(messageId);
    this.messagePeakTps.delete(messageId);
    this.messageLastRefreshTimes.delete(messageId);
    this.refreshUI(messageId, context, true);
  }

  private aggregateTaskData(taskIds: string[]): TPSData {
    const result = emptyData();
    for (const taskId of taskIds) {
      const data = this.taskData.get(taskId);
      if (!data) continue;
      result.totalTokens += data.totalTokens;
      result.totalDuration += data.totalDuration;
      result.messageCount += data.messageCount;
      result.currentTps += data.isStreaming ? data.currentTps : 0;
      result.currentTokens += data.isStreaming ? data.currentTokens : 0;
      result.currentDuration = Math.max(result.currentDuration, data.isStreaming ? data.currentDuration : 0);
      result.peakTps = Math.max(result.peakTps, data.peakTps);
      result.isStreaming ||= data.isStreaming;
    }
    result.averageTps = result.totalDuration > 0 ? result.totalTokens / result.totalDuration : 0;
    return result;
  }

  private async getDashboardData(context: ExtensionContext): Promise<TPSData> {
    const taskContext = context.getTaskContext();
    if (!taskContext) return this.aggregateTaskData([...this.taskData.keys()]);

    let tasks: Array<{ id: string; parentId?: string | null }> = [];
    try {
      const projectContext = context.getProjectContext() as unknown as { getTasks: () => Promise<Array<{ id: string; parentId?: string | null }>> };
      tasks = await projectContext.getTasks();
    } catch {
      return this.aggregateTaskData([taskContext.data.id]);
    }

    const descendantIds = new Set<string>();
    const collectDescendants = (parentId: string) => {
      for (const task of tasks) {
        if (task.parentId === parentId && !descendantIds.has(task.id)) {
          descendantIds.add(task.id);
          collectDescendants(task.id);
        }
      }
    };
    collectDescendants(taskContext.data.id);

    const result = this.aggregateTaskData([taskContext.data.id]);
    const activeSubagentIds = [...descendantIds].filter((taskId) => this.taskData.get(taskId)?.isStreaming);
    const subagents = this.aggregateTaskData(activeSubagentIds);
    result.subagentTps = subagents.currentTps;
    result.subagentPeakTps = subagents.peakTps;
    result.subagentCount = activeSubagentIds.length;
    return result;
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const components: UIComponentDefinition[] = [];

    if (this.settings.usageInfoEnabled) {
      const jsx = readFileSync(join(__dirname, './TPSCounter.jsx'), 'utf-8');
      components.push({ id: 'tps-counter', placement: 'task-usage-info-bottom', jsx, loadData: true });
    }

    if (this.settings.messageBarEnabled) {
      const messageBarJsx = readFileSync(join(__dirname, './TPSMessageBar.jsx'), 'utf-8');
      components.push({ id: 'tps-counter-message-bar', placement: 'task-message-bar', jsx: messageBarJsx, loadData: true });
    }

    return components;
  }

  async getUIExtensionData(componentId: string, _context: ExtensionContext): Promise<unknown> {
    if (componentId === 'tps-counter') return this.getDashboardData(_context);
    if (componentId === 'tps-counter-message-bar') return Object.fromEntries(this.messageTpsData);
    return undefined;
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'tps-usage-info',
        description: 'Toggle TPS display in usage info area',
        execute: async (_args: string[], context: ExtensionContext) => {
          this.settings.usageInfoEnabled = !this.settings.usageInfoEnabled;
          this.saveSettings();
          const taskContext = context.getTaskContext();
          if (taskContext) taskContext.addLogMessage('info', `TPS usage info display ${this.settings.usageInfoEnabled ? 'enabled' : 'disabled'}`);
          context.triggerUIComponentsReload();
        },
      },
      {
        name: 'tps-message-bar',
        description: 'Toggle TPS display in message bar',
        execute: async (_args: string[], context: ExtensionContext) => {
          this.settings.messageBarEnabled = !this.settings.messageBarEnabled;
          this.saveSettings();
          const taskContext = context.getTaskContext();
          if (taskContext) taskContext.addLogMessage('info', `TPS message bar display ${this.settings.messageBarEnabled ? 'enabled' : 'disabled'}`);
          context.triggerUIComponentsReload();
        },
      },
    ];
  }
}
