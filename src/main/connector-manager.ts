import { Server as HttpServer } from 'http';

import { ModelsData, QuestionData, TokensInfoData } from '@common/types';
import { BrowserWindow } from 'electron';
import { Server, Socket } from 'socket.io';
import { Connector } from 'src/main/connector';
import { ProjectManager } from 'src/main/project-manager';
import { SERVER_PORT } from 'src/main/constants';
import { findAvailablePort } from 'src/main/utils';

import logger from './logger';
import {
  isAddFileMessage,
  isAskQuestionMessage,
  isDropFileMessage,
  isInitMessage,
  isPromptFinishedMessage,
  isResponseMessage,
  isSetModelsMessage,
  isTokensInfoMessage,
  isUpdateAutocompletionMessage,
  isUpdateContextFilesMessage,
  isUpdateRepoMapMessage,
  isUseCommandOutputMessage,
  LogMessage,
  Message,
} from './messages';

export class ConnectorManager {
  private io: Server | null = null;
  private connectors: Connector[] = [];

  constructor(
    private readonly mainWindow: BrowserWindow,
    private readonly projectManager: ProjectManager,
    _httpServer: HttpServer,
  ) {
    // Init is now called explicitly from index.ts
  }

  public async init(httpServer: HttpServer): Promise<void> {
    // Create Socket.IO server
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingTimeout: 600_000, // 10 minutes
      maxHttpBufferSize: 1e8, // Increase payload size to 100 MB
    });

    this.io.on('connection', (socket) => {
      logger.info('Socket.IO client connected');

      socket.on('message', (message) => this.processMessage(socket, message));
      socket.on('log', (message) => this.processLogMessage(socket, message));

      socket.on('disconnect', () => {
        const connector = this.findConnectorBySocket(socket);
        logger.info('Socket.IO client disconnected', {
          baseDir: connector?.baseDir,
        });
        this.removeConnector(socket);
      });
    });

    // Find an available port starting from SERVER_PORT
    const port = await findAvailablePort(SERVER_PORT);
    if (!port) {
      logger.error(`Could not find an available port after trying ${SERVER_PORT} through ${SERVER_PORT + 99}`);
      throw new Error('No available ports found');
    }

    // Listen on the available port
    httpServer.listen(port);
    
    // Log the port that was actually used
    logger.info(`Socket.IO server initialized on port ${port}${port !== SERVER_PORT ? ` (default port ${SERVER_PORT} was in use)` : ''}`);
  }

  public async close() {
    logger.info('Closing Socket.IO server');
    this.connectors.forEach((connector) => connector.socket.disconnect());
    await this.io?.close();
  }

  private processMessage = (socket: Socket, message: Message) => {
    try {
      logger.debug('Received message from client', { action: message.action });
      logger.debug('Message:', {
        message: JSON.stringify(message).slice(0, 1000),
      });

      if (isInitMessage(message)) {
        logger.info('Initializing connector for base directory:', {
          baseDir: message.baseDir,
          listenTo: message.listenTo,
        });
        const connector = new Connector(socket, message.baseDir, message.listenTo, message.inputHistoryFile);
        this.connectors.push(connector);

        const project = this.projectManager.getProject(message.baseDir);
        project.addConnector(connector);

        message.contextFiles?.forEach((file) => project.addFile(file));
        logger.info('Socket.IO registered project for base directory:', {
          baseDir: message.baseDir,
        });
      } else if (isResponseMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        this.projectManager.getProject(connector.baseDir).processResponseMessage(message);
      } else if (isAddFileMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Adding file in project', { baseDir: connector.baseDir });
        this.projectManager.getProject(connector.baseDir).addFile({
          path: message.path,
          readOnly: message.readOnly,
        });
      } else if (isDropFileMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Dropping file in project', { baseDir: connector.baseDir });
        void this.projectManager.getProject(connector.baseDir).dropFile(message.path);
      } else if (isUpdateAutocompletionMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }

        logger.debug('Updating autocompletion', { baseDir: connector.baseDir });
        this.mainWindow.webContents.send('update-autocompletion', {
          baseDir: connector.baseDir,
          words: message.words,
          allFiles: message.allFiles,
          models: message.models,
        });
        this.projectManager.getProject(connector.baseDir).setAllTrackedFiles(message.allFiles);
      } else if (isAskQuestionMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        const questionData: QuestionData = {
          baseDir: connector.baseDir,
          text: message.question,
          subject: message.subject,
          defaultAnswer: message.defaultAnswer,
          isGroupQuestion: message.isGroupQuestion,
        };
        this.projectManager.getProject(connector.baseDir).askQuestion(questionData);
      } else if (isSetModelsMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        const modelsData: ModelsData = {
          baseDir: connector.baseDir,
          ...message,
        };

        this.projectManager.getProject(connector.baseDir).updateAiderModels(modelsData);
      } else if (isUpdateContextFilesMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        this.projectManager.getProject(connector.baseDir).updateContextFiles(message.files);
      } else if (isUseCommandOutputMessage(message)) {
        logger.info('Use command output', { ...message });

        const connector = this.findConnectorBySocket(socket);
        if (!connector || !this.mainWindow) {
          return;
        }
        const project = this.projectManager.getProject(connector.baseDir);
        if (message.finished) {
          project.closeCommandOutput();
        } else {
          project.openCommandOutput(message.command);
        }
      } else if (isTokensInfoMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector || !this.mainWindow) {
          return;
        }

        const data: TokensInfoData = {
          baseDir: connector.baseDir,
          ...message.info,
        };
        this.projectManager.getProject(connector.baseDir).updateTokensInfo(data);
      } else if (isPromptFinishedMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Prompt finished', {
          baseDir: connector.baseDir,
          promptId: message.promptId,
        });
        this.projectManager.getProject(connector.baseDir).promptFinished();
      } else if (isUpdateRepoMapMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.debug('Updating repo map', { baseDir: connector.baseDir });
        this.projectManager.getProject(connector.baseDir).updateRepoMapFromConnector(message.repoMap);
      } else {
        logger.warn('Unknown message type: ', message);
      }
    } catch (error) {
      logger.error('Socket.IO message parsing error:', { error });
    }
  };

  private processLogMessage = (socket: Socket, message: LogMessage) => {
    const connector = this.findConnectorBySocket(socket);
    if (!connector || !this.mainWindow) {
      return;
    }

    const project = this.projectManager.getProject(connector.baseDir);
    project.addLogMessage(message.level, message.message, message.finished);
  };

  private removeConnector = (socket: Socket) => {
    const connector = this.findConnectorBySocket(socket);
    if (!connector) {
      return;
    }

    const project = this.projectManager.getProject(connector.baseDir);
    project.removeConnector(connector);

    this.connectors = this.connectors.filter((c) => c !== connector);
  };

  private findConnectorBySocket = (socket: Socket): Connector | undefined => {
    const connector = this.connectors.find((c) => c.socket === socket);
    if (!connector) {
      logger.warn('Connector not found');
    }
    return connector;
  };
}
