import { Socket } from 'socket.io';
import {
  ContextFile,
  InputHistoryData,
  ProviderProfile,
  LogData,
  SystemLogData,
  ModelsData,
  NotificationData,
  QuestionData,
  QuestionAnsweredData,
  ResponseChunkData,
  ResponseCompletedData,
  TerminalData,
  TerminalExitData,
  ToolData,
  TokensInfoData,
  UserMessageData,
  MessageRemovedData,
  VersionsInfo,
  AutocompletionData,
  ProviderModelsData,
  ProvidersUpdatedData,
  SettingsData,
  TaskData,
  ClearTaskData,
  ProjectSettings,
  AgentProfile,
  AgentProfilesUpdatedData,
  WorktreeIntegrationStatus,
  WorktreeIntegrationStatusUpdatedData,
  TaskCreatedData,
  UpdatedFile,
  UpdatedFilesUpdatedData,
  QueuedPromptData,
  QueuedPromptsUpdatedData,
  CommandsData,
  ExtensionUIRefreshData,
  ModalOverlayUrlData,
} from '@common/types';

import type { WindowManager } from '@/window-manager';

import logger from '@/logger';

export interface EventsConnectorConfig {
  eventTypes?: string[];
  baseDirs?: string[];
}

export interface EventsConnector extends EventsConnectorConfig {
  socket: Socket;
}

export class EventManager {
  private eventsConnectors: EventsConnector[] = [];

  constructor(private readonly windowManager?: WindowManager) {}

  // Project lifecycle events
  sendProjectStarted(baseDir: string): void {
    const data = { baseDir };
    this.sendToWindows('project-started', data);
    this.broadcastToEventConnectors('project-started', data);
  }

  sendClearTask(baseDir: string, taskId: string, clearMessages: boolean, clearFiles: boolean): void {
    const data: ClearTaskData = {
      baseDir,
      taskId,
      clearMessages,
      clearSession: clearFiles,
    };
    this.sendToWindows('clear-task', data);
    this.broadcastToEventConnectors('clear-task', data);
  }

  // File management events
  sendFileAdded(baseDir: string, taskId: string, file: ContextFile): void {
    const data = {
      baseDir,
      taskId,
      file,
    };
    this.sendToWindows('file-added', data);
    this.broadcastToEventConnectors('file-added', data);
  }

  sendContextFilesUpdated(baseDir: string, taskId: string, files: ContextFile[]): void {
    const data = {
      baseDir,
      taskId,
      files,
    };
    this.sendToWindows('context-files-updated', data);
    this.broadcastToEventConnectors('context-files-updated', data);
  }

  sendUpdatedFilesUpdated(baseDir: string, taskId: string, files: UpdatedFile[]): void {
    const data: UpdatedFilesUpdatedData = {
      baseDir,
      taskId,
      files,
    };
    this.sendToWindows('updated-files-updated', data);
    this.broadcastToEventConnectors('updated-files-updated', data);
  }

  // Response events
  sendResponseChunk(data: ResponseChunkData): void {
    this.sendToWindows('response-chunk', data);
    this.broadcastToEventConnectors('response-chunk', data);
  }

  sendResponseCompleted(data: ResponseCompletedData): void {
    this.sendToWindows('response-completed', data);
    this.broadcastToEventConnectors('response-completed', data);
  }

  // Question events
  sendAskQuestion(questionData: QuestionData): void {
    this.sendToWindows('ask-question', questionData);
    this.broadcastToEventConnectors('ask-question', questionData);
  }

  sendQuestionAnswered(baseDir: string, taskId: string, question: QuestionData, answer: string, userInput?: string): void {
    const data: QuestionAnsweredData = {
      baseDir,
      taskId,
      question,
      answer,
      userInput,
    };
    this.sendToWindows('question-answered', data);
    this.broadcastToEventConnectors('question-answered', data);
  }

  // Autocompletion events
  sendUpdateAutocompletion(baseDir: string, taskId: string, words?: string[], allFiles?: string[]): void {
    const data: AutocompletionData = {
      baseDir,
      taskId,
      words,
      allFiles,
    };
    this.sendToWindows('update-autocompletion', data);
    this.broadcastToEventConnectors('update-autocompletion', data);
  }

  // Queue events
  sendQueuedPromptsUpdated(baseDir: string, taskId: string, queuedPrompts: QueuedPromptData[]): void {
    const data: QueuedPromptsUpdatedData = {
      baseDir,
      taskId,
      queuedPrompts,
    };
    this.sendToWindows('queued-prompts-updated', data);
    this.broadcastToEventConnectors('queued-prompts-updated', data);
  }

  // Aider models events
  sendUpdateAiderModels(_baseDir: string, _taskId: string, modelsData: ModelsData): void {
    const data = modelsData;
    this.sendToWindows('update-aider-models', data);
    this.broadcastToEventConnectors('update-aider-models', data);
  }

  // Command events
  sendCommandOutput(baseDir: string, taskId: string, command: string, output: string): void {
    const data = {
      baseDir,
      taskId,
      command,
      output,
    };
    this.sendToWindows('command-output', data);
    this.broadcastToEventConnectors('command-output', data);
  }

  // Log events
  sendLog(data: LogData): void {
    this.sendToWindows('log', data);
    this.broadcastToEventConnectors('log', data);
  }

  // System log events (application-wide logs)
  sendSystemLog(data: SystemLogData): void {
    this.sendToWindows('system-log', data);
    this.broadcastToEventConnectors('system-log', data, false);
  }

  // Tool events
  sendTool(data: ToolData): void {
    this.sendToWindows('tool', data);
    this.broadcastToEventConnectors('tool', data);
  }

  // User message events
  sendUserMessage(data: UserMessageData): void {
    this.sendToWindows('user-message', data);
    this.broadcastToEventConnectors('user-message', data);
  }

  // Tokens info events
  sendUpdateTokensInfo(tokensInfo: TokensInfoData): void {
    this.sendToWindows('update-tokens-info', tokensInfo);
    this.broadcastToEventConnectors('update-tokens-info', tokensInfo);
  }

  // Input history events
  sendInputHistoryUpdated(baseDir: string, taskId: string, inputHistory: string[]): void {
    const data: InputHistoryData = {
      baseDir,
      taskId,
      inputHistory,
    };
    this.sendToWindows('input-history-updated', data);
    this.broadcastToEventConnectors('input-history-updated', data);
  }

  // Commands events
  sendCommandsUpdated(data: CommandsData): void {
    this.sendToWindows('commands-updated', data);
    this.broadcastToEventConnectors('commands-updated', data);
  }

  sendCustomCommandError(baseDir: string, taskId: string, error: string): void {
    const data = {
      baseDir,
      taskId,
      error,
    };
    this.sendToWindows('custom-command-error', data);
    this.broadcastToEventConnectors('custom-command-error', data);
  }

  sendWorktreeIntegrationStatusUpdated(baseDir: string, taskId: string, status: WorktreeIntegrationStatus | null): void {
    const data: WorktreeIntegrationStatusUpdatedData = {
      baseDir,
      taskId,
      status,
    };
    logger.debug('Sending worktree integration status updated', data);
    this.sendToWindows('worktree-integration-status-updated', data);
    this.broadcastToEventConnectors('worktree-integration-status-updated', data);
  }

  // Terminal events
  sendTerminalData(data: TerminalData): void {
    this.sendToWindows('terminal-data', data);
    this.broadcastToEventConnectors('terminal-data', data);
  }

  sendTerminalExit(data: TerminalExitData): void {
    this.sendToWindows('terminal-exit', data);
    this.broadcastToEventConnectors('terminal-exit', data);
  }

  // Versions events
  sendVersionsInfoUpdated(versionsInfo: VersionsInfo): void {
    this.sendToWindows('versions-info-updated', versionsInfo);
    this.broadcastToEventConnectors('versions-info-updated', versionsInfo);
  }

  sendSettingsUpdated(settings: SettingsData): void {
    this.sendToWindows('settings-updated', settings);
    this.broadcastToEventConnectors('settings-updated', settings);
  }

  // Provider events
  sendProvidersUpdated(providers: ProviderProfile[]): void {
    const data: ProvidersUpdatedData = {
      providers,
    };
    this.sendToWindows('providers-updated', data);
    this.broadcastToEventConnectors('providers-updated', data);
  }

  sendProviderModelsUpdated(data: ProviderModelsData): void {
    this.sendToWindows('provider-models-updated', data);
    this.broadcastToEventConnectors('provider-models-updated', data);
  }

  sendProjectSettingsUpdated(baseDir: string, settings: ProjectSettings): void {
    const data = { baseDir, settings };
    this.sendToWindows('project-settings-updated', data);
    this.broadcastToEventConnectors('project-settings-updated', data);
  }

  // Agent profile events
  sendAgentProfilesUpdated(profiles: AgentProfile[]): void {
    const data: AgentProfilesUpdatedData = {
      profiles,
    };
    this.sendToWindows('agent-profiles-updated', data);
    this.broadcastToEventConnectors('agent-profiles-updated', data);
  }

  // Task lifecycle events
  sendTaskCreated(task: TaskData, activate?: boolean): void {
    const eventData: TaskCreatedData = {
      baseDir: task.baseDir,
      task,
      activate,
    };
    this.sendToWindows('task-created', eventData);
    this.broadcastToEventConnectors('task-created', eventData);
  }

  sendTaskInitialized(task: TaskData): void {
    this.sendToWindows('task-initialized', task);
    this.broadcastToEventConnectors('task-initialized', task);
  }

  sendTaskUpdated(task: TaskData): void {
    this.sendToWindows('task-updated', task);
    this.broadcastToEventConnectors('task-updated', task);
  }

  sendTaskStarted(task: TaskData): void {
    this.sendToWindows('task-started', task);
    this.broadcastToEventConnectors('task-started', task);
  }

  sendTaskCompleted(task: TaskData): void {
    this.sendToWindows('task-completed', task);
    this.broadcastToEventConnectors('task-completed', task);
  }

  sendTaskCancelled(task: TaskData): void {
    this.sendToWindows('task-cancelled', task);
    this.broadcastToEventConnectors('task-cancelled', task);
  }

  sendTaskDeleted(task: TaskData): void {
    this.sendToWindows('task-deleted', task);
    this.broadcastToEventConnectors('task-deleted', task);
  }

  sendTaskMessageRemoved(baseDir: string, taskId: string, messageIds: string[]): void {
    const data: MessageRemovedData = {
      baseDir,
      taskId,
      messageIds,
    };
    this.sendToWindows('message-removed', data);
    this.broadcastToEventConnectors('message-removed', data);
  }

  sendNotification(baseDir: string, title: string, body: string): void {
    const data: NotificationData = {
      title,
      body,
      baseDir,
    };
    this.sendToWindows('notification', data);
    this.broadcastToEventConnectors('notification', data);
  }

  subscribe(socket: Socket, config: EventsConnectorConfig): void {
    this.eventsConnectors = this.eventsConnectors.filter((connector) => connector.socket.id !== socket.id);
    logger.info('Subscribing to events', {
      eventTypes: config.eventTypes,
      baseDirs: config.baseDirs,
    });
    this.eventsConnectors.push({
      socket,
      eventTypes: config.eventTypes,
      baseDirs: config.baseDirs,
    });
  }

  unsubscribe(socket: Socket, log = true): void {
    const before = this.eventsConnectors.length;
    this.eventsConnectors = this.eventsConnectors.filter((connector) => connector.socket.id !== socket.id);
    if (log) {
      logger.info('Unsubscribed from events', {
        before,
        after: this.eventsConnectors.length,
      });
    }
  }

  private sendToWindows(eventType: string, data: unknown): void {
    if (!this.windowManager) {
      return;
    }

    const windows = this.windowManager.getAllWindows();
    if (windows.length === 0) {
      return;
    }

    // Send event to all open windows
    windows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(eventType, data);
      }
    });
  }

  private broadcastToEventConnectors(eventType: string, data: unknown, log = true): void {
    if (log) {
      logger.debug('Broadcasting event to connectors:', {
        connectors: this.eventsConnectors.length,
        eventType,
      });
    }

    this.eventsConnectors.forEach((connector) => {
      // Filter by event types if specified
      if (connector.eventTypes && !connector.eventTypes.includes(eventType)) {
        if (log) {
          logger.debug('Skipping event broadcast to connector, event type not included:', { eventType, connectorEventTypes: connector.eventTypes });
        }
        return;
      }

      // Filter by base directories if specified
      const baseDir = (data as { baseDir?: string })?.baseDir;
      if (connector.baseDirs && baseDir && !connector.baseDirs.includes(baseDir)) {
        if (log) {
          logger.debug('Skipping event broadcast to connector, base dir not included:', { baseDir, connectorBaseDirs: connector.baseDirs });
        }
        return;
      }

      try {
        if (log) {
          logger.debug('Broadcasting event to connector:', {
            eventType,
            baseDir,
          });
        }
        connector.socket.emit('event', { type: eventType, data });
      } catch {
        // Remove disconnected sockets
        this.unsubscribe(connector.socket, log);
      }
    });
  }

  // Extension UI events
  sendExtensionUIRefresh(options: { projectDir?: string; extensionId?: string; componentId?: string; taskId?: string; reloadComponents?: boolean }): void {
    const data: ExtensionUIRefreshData = options;
    this.sendToWindows('extension-ui-refresh', data);
    this.broadcastToEventConnectors('extension-ui-refresh', data);
  }

  // Modal overlay URL events
  sendModalOverlayUrl(url: string): void {
    const data: ModalOverlayUrlData = { url };
    this.sendToWindows('modal-overlay-url', data);
    this.broadcastToEventConnectors('modal-overlay-url', data);
  }
}
