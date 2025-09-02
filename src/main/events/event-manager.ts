import { BrowserWindow } from 'electron';
import { Socket } from 'socket.io';
import {
  ContextFile,
  CustomCommand,
  InputHistoryData,
  LogData,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  TerminalData,
  TerminalExitData,
  ToolData,
  TokensInfoData,
  UserMessageData,
  VersionsInfo,
} from '@common/types';

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

  constructor(private readonly mainWindow: BrowserWindow | null) {}

  // Project lifecycle events
  sendProjectStarted(baseDir: string): void {
    const data = { baseDir };
    this.sendToMainWindow('project-started', data);
    this.broadcastToEventConnectors('project-started', data);
  }

  sendClearProject(baseDir: string, clearMessages: boolean, clearFiles: boolean): void {
    const data = { baseDir, clearMessages, clearFiles };
    this.sendToMainWindow('clear-project', data);
    this.broadcastToEventConnectors('clear-project', data);
  }

  // File management events
  sendFileAdded(baseDir: string, file: ContextFile): void {
    const data = {
      baseDir,
      file,
    };
    this.sendToMainWindow('file-added', data);
    this.broadcastToEventConnectors('file-added', data);
  }

  sendContextFilesUpdated(baseDir: string, files: ContextFile[]): void {
    const data = {
      baseDir,
      files,
    };
    this.sendToMainWindow('context-files-updated', data);
    this.broadcastToEventConnectors('context-files-updated', data);
  }

  // Response events
  sendResponseChunk(data: ResponseChunkData): void {
    this.sendToMainWindow('response-chunk', data);
    this.broadcastToEventConnectors('response-chunk', data);
  }

  sendResponseCompleted(data: ResponseCompletedData): void {
    this.sendToMainWindow('response-completed', data);
    this.broadcastToEventConnectors('response-completed', data);
  }

  // Question events
  sendAskQuestion(questionData: QuestionData): void {
    this.sendToMainWindow('ask-question', questionData);
    this.broadcastToEventConnectors('ask-question', questionData);
  }

  // Autocompletion events
  sendUpdateAutocompletion(baseDir: string, words: string[], allFiles: string[], models: string[]): void {
    const data = {
      baseDir,
      words,
      allFiles,
      models,
    };
    this.sendToMainWindow('update-autocompletion', data);
    this.broadcastToEventConnectors('update-autocompletion', data);
  }

  // Aider models events
  sendUpdateAiderModels(modelsData: ModelsData): void {
    this.sendToMainWindow('update-aider-models', modelsData);
    this.broadcastToEventConnectors('update-aider-models', modelsData);
  }

  // Command events
  sendCommandOutput(baseDir: string, command: string, output: string): void {
    const data = {
      baseDir,
      command,
      output,
    };
    this.sendToMainWindow('command-output', data);
    this.broadcastToEventConnectors('command-output', data);
  }

  // Log events
  sendLog(data: LogData): void {
    this.sendToMainWindow('log', data);
    this.broadcastToEventConnectors('log', data);
  }

  // Tool events
  sendTool(data: ToolData): void {
    this.sendToMainWindow('tool', data);
    this.broadcastToEventConnectors('tool', data);
  }

  // User message events
  sendUserMessage(data: UserMessageData): void {
    this.sendToMainWindow('user-message', data);
    this.broadcastToEventConnectors('user-message', data);
  }

  // Tokens info events
  sendUpdateTokensInfo(tokensInfo: TokensInfoData): void {
    this.sendToMainWindow('update-tokens-info', tokensInfo);
    this.broadcastToEventConnectors('update-tokens-info', tokensInfo);
  }

  // Input history events
  sendInputHistoryUpdated(inputHistoryData: InputHistoryData): void {
    this.sendToMainWindow('input-history-updated', inputHistoryData);
    this.broadcastToEventConnectors('input-history-updated', inputHistoryData);
  }

  // Custom commands events
  sendCustomCommandsUpdated(baseDir: string, commands: CustomCommand[]): void {
    const data = {
      baseDir,
      commands,
    };
    this.sendToMainWindow('custom-commands-updated', data);
    this.broadcastToEventConnectors('custom-commands-updated', data);
  }

  sendCustomCommandError(baseDir: string, error: string): void {
    const data = {
      baseDir,
      error,
    };
    this.sendToMainWindow('custom-command-error', data);
    this.broadcastToEventConnectors('custom-command-error', data);
  }

  // Terminal events
  sendTerminalData(data: TerminalData): void {
    this.sendToMainWindow('terminal-data', data);
    this.broadcastToEventConnectors('terminal-data', data);
  }

  sendTerminalExit(data: TerminalExitData): void {
    this.sendToMainWindow('terminal-exit', data);
    this.broadcastToEventConnectors('terminal-exit', data);
  }

  // Versions events
  sendVersionsInfoUpdated(versionsInfo: VersionsInfo): void {
    this.sendToMainWindow('versions-info-updated', versionsInfo);
    this.broadcastToEventConnectors('versions-info-updated', versionsInfo);
  }

  subscribe(socket: Socket, config: EventsConnectorConfig): void {
    this.eventsConnectors = this.eventsConnectors.filter((connector) => connector.socket.id !== socket.id);
    logger.info('Subscribing to events', { eventTypes: config.eventTypes, baseDirs: config.baseDirs });
    this.eventsConnectors.push({
      socket,
      eventTypes: config.eventTypes,
      baseDirs: config.baseDirs,
    });
  }

  unsubscribe(socket: Socket): void {
    const before = this.eventsConnectors.length;
    this.eventsConnectors = this.eventsConnectors.filter((connector) => connector.socket.id !== socket.id);
    logger.info('Unsubscribed from events', { before, after: this.eventsConnectors.length });
  }

  private sendToMainWindow(eventType: string, data: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    this.mainWindow.webContents.send(eventType, data);
  }

  private broadcastToEventConnectors(eventType: string, data: unknown): void {
    logger.debug('Broadcasting event to connectors:', { connectors: this.eventsConnectors.length, eventType });

    this.eventsConnectors.forEach((connector) => {
      // Filter by event types if specified
      if (connector.eventTypes && !connector.eventTypes.includes(eventType)) {
        logger.debug('Skipping event broadcast to connector, event type not included:', { eventType, connectorEventTypes: connector.eventTypes });
        return;
      }

      // Filter by base directories if specified
      const baseDir = (data as { baseDir?: string })?.baseDir;
      if (connector.baseDirs && baseDir && !connector.baseDirs.includes(baseDir)) {
        logger.debug('Skipping event broadcast to connector, base dir not included:', { baseDir, connectorBaseDirs: connector.baseDirs });
        return;
      }

      try {
        logger.debug('Broadcasting event to connector:', { eventType, baseDir });
        connector.socket.emit('event', { type: eventType, data });
      } catch {
        // Remove disconnected sockets
        this.unsubscribe(connector.socket);
      }
    });
  }
}
