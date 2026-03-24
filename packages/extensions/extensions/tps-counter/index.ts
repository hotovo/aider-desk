import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { Extension, ExtensionContext, UIComponentDefinition, ResponseChunkEvent, ResponseCompletedEvent, CommandDefinition } from '@aiderdesk/extensions';

interface TPSData {
  currentTps: number;
  currentTokens: number;
  currentDuration: number;
  averageTps: number;
  totalTokens: number;
  totalDuration: number;
  messageCount: number;
}

interface MessageTPSData {
  tps: number;
  tokens: number;
  duration: number;
}

interface Settings {
  usageInfoEnabled: boolean;
  messageBarEnabled: boolean;
}

export default class TPSCounterExtension implements Extension {
  static metadata = {
    name: 'TPS Counter',
    version: '1.0.0',
    description: 'Displays tokens per second for agent responses',
    author: 'wladimiiir',
    capabilities: ['metrics'],
  };

  private messageStartTimes: Map<string, number> = new Map();
  private messageTpsData: Map<string, MessageTPSData> = new Map();
  private currentData: TPSData = {
    currentTps: 0,
    currentTokens: 0,
    currentDuration: 0,
    averageTps: 0,
    totalTokens: 0,
    totalDuration: 0,
    messageCount: 0,
  };
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

  async onLoad(context: ExtensionContext): Promise<void> {
    this.settings = this.loadSettings();
    context.log('TPS Counter extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    this.messageStartTimes.clear();
    this.messageTpsData.clear();
    this.currentData = {
      currentTps: 0,
      currentTokens: 0,
      currentDuration: 0,
      averageTps: 0,
      totalTokens: 0,
      totalDuration: 0,
      messageCount: 0,
    };
  }

  async onResponseChunk(event: ResponseChunkEvent, _context: ExtensionContext): Promise<void> {
    const messageId = event.chunk.messageId;

    if (!this.messageStartTimes.has(messageId)) {
      this.messageStartTimes.set(messageId, Date.now());
    }
  }

  async onResponseCompleted(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void> {
    const messageId = event.response.messageId;
    context.log(`[TPS] onResponseCompleted - messageId: ${messageId}`, 'info');
    const startTime = this.messageStartTimes.get(messageId);

    if (!startTime || !event.response.usageReport) {
      context.log(`[TPS] onResponseCompleted - skipping (no startTime or usageReport)`, 'info');
      return;
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;

    const receivedTokens = event.response.usageReport.receivedTokens || 0;
    const totalTokens = receivedTokens;
    const currentTps = durationSeconds > 0 ? totalTokens / durationSeconds : 0;

    this.currentData.totalTokens += totalTokens;
    this.currentData.totalDuration += durationSeconds;
    this.currentData.messageCount += 1;

    this.currentData.currentTps = currentTps;
    this.currentData.currentTokens = totalTokens;
    this.currentData.currentDuration = durationSeconds;
    this.currentData.averageTps = this.currentData.totalDuration > 0 ? this.currentData.totalTokens / this.currentData.totalDuration : 0;

    this.messageTpsData.set(messageId, {
      tps: currentTps,
      tokens: totalTokens,
      duration: durationSeconds,
    });

    context.log(`[TPS] messageTpsData keys after update: ${JSON.stringify([...this.messageTpsData.keys()])}`, 'info');

    this.messageStartTimes.delete(messageId);
    context.triggerUIDataRefresh('tps-counter');
    context.triggerUIDataRefresh('tps-counter-message-bar');
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const components: UIComponentDefinition[] = [];

    if (this.settings.usageInfoEnabled) {
      const jsx = readFileSync(join(__dirname, './TPSCounter.jsx'), 'utf-8');
      components.push({
        id: 'tps-counter',
        placement: 'task-usage-info-bottom',
        jsx,
        loadData: true,
      });
    }

    if (this.settings.messageBarEnabled) {
      const messageBarJsx = readFileSync(join(__dirname, './TPSMessageBar.jsx'), 'utf-8');
      components.push({
        id: 'tps-counter-message-bar',
        placement: 'task-message-bar',
        jsx: messageBarJsx,
        loadData: true,
      });
    }

    return components;
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId === 'tps-counter') {
      return this.currentData;
    }

    if (componentId === 'tps-counter-message-bar') {
      const data = Object.fromEntries(this.messageTpsData);
      context.log(`[TPS] getUIExtensionData - returning keys: ${JSON.stringify(Object.keys(data))}`, 'info');
      return data;
    }

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
          if (taskContext) {
            taskContext.addLogMessage('info', `TPS usage info display ${this.settings.usageInfoEnabled ? 'enabled' : 'disabled'}`);
          }
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
          if (taskContext) {
            taskContext.addLogMessage('info', `TPS message bar display ${this.settings.messageBarEnabled ? 'enabled' : 'disabled'}`);
          }
          context.triggerUIComponentsReload();
        },
      },
    ];
  }
}
