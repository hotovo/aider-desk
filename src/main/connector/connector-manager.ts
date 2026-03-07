import { Server as HttpServer } from 'http';

import { ModelsData, QuestionData, TokensInfoData } from '@common/types';
import { Server, Socket } from 'socket.io';

import logger from '@/logger';
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
  isAddMessageMessage,
  isSubscribeEventsMessage,
  isUnsubscribeEventsMessage,
} from '@/messages';
import { Connector } from '@/connector/connector';
import { ProjectManager } from '@/project';
import { EventManager } from '@/events';

export class ConnectorManager {
  private io: Server | null = null;
  private connectors: Connector[] = [];

  constructor(
    httpServer: HttpServer,
    private readonly projectManager: ProjectManager,
    private readonly eventManager: EventManager,
  ) {
    this.init(httpServer);
  }

  public init(httpServer: HttpServer): void {
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
        this.eventManager.unsubscribe(socket);
        if (connector) {
          this.removeConnector(socket);
        }
      });
    });

    logger.info('Socket.IO server initialized');
  }

  public async close() {
    logger.info('Closing Socket.IO server');
    this.connectors.forEach((connector) => connector.socket.disconnect());
    await this.io?.close();
  }

  private processMessage = (socket: Socket, message: Message) => {
    try {
      logger.info('Received message from client', { action: message.action });
      logger.debug('Message:', {
        message: JSON.stringify(message).slice(0, 1000),
      });

      if (isInitMessage(message)) {
        logger.info('Initializing connector for base directory:', {
          baseDir: message.baseDir,
          taskId: message.taskId,
          listenTo: message.listenTo,
        });

        // Check if there's an existing connector with the same baseDir and taskId
        // This can happen on reconnection when the old connector wasn't properly cleaned up
        const existingConnector = this.connectors.find((c) => c.baseDir === message.baseDir && c.taskId === message.taskId);
        if (existingConnector) {
          logger.info('Removing existing connector before creating new one', {
            baseDir: message.baseDir,
            taskId: message.taskId,
          });
          this.removeConnector(existingConnector.socket);
        }

        const connector = new Connector(socket, message.baseDir, message.taskId, message.source, message.listenTo, message.inputHistoryFile);
        this.connectors.push(connector);

        const project = this.projectManager.getProject(message.baseDir);
        void project.addConnector(connector);

        message.contextFiles?.forEach((file) => project.getTask(connector.taskId)?.addFiles(file));
        logger.info('Socket.IO registered project for base directory:', {
          baseDir: message.baseDir,
          taskId: message.taskId,
        });
      } else if (isResponseMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        void this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.processResponseMessage(message);
      } else if (isAddFileMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Adding file in project', { baseDir: connector.baseDir });
        const project = this.projectManager.getProject(connector.baseDir);
        if (connector.taskId) {
          project.getTask(connector.taskId)?.addFiles({
            path: message.path,
            readOnly: message.readOnly,
          });
        } else {
          project.forEachTask((task) =>
            task.addFiles({
              path: message.path,
              readOnly: message.readOnly,
            }),
          );
          project.getInternalTask()?.addFiles({
            path: message.path,
            readOnly: message.readOnly,
          });
        }
      } else if (isDropFileMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Dropping file in project', { baseDir: connector.baseDir });
        const project = this.projectManager.getProject(connector.baseDir);
        if (connector.taskId) {
          project.getTask(connector.taskId)?.dropFile(message.path);
        } else {
          project.forEachTask((task) => task.dropFile(message.path));
          project.getInternalTask()?.dropFile(message.path);
        }
      } else if (isUpdateAutocompletionMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }

        logger.debug('Updating autocompletion', { baseDir: connector.baseDir });
        if (connector.taskId) {
          const project = this.projectManager.getProject(connector.baseDir);
          const task = project.getTask(connector.taskId);
          if (task) {
            void task.updateAutocompletionData(message.words);
          }
        } else {
          // Handle the case where taskId is not available, e.g., log an error or apply to all tasks
          logger.warn('Received update-autocompletion message from a connector without a taskId.');
        }
      } else if (isAskQuestionMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        if (!connector.taskId) {
          logger.error('Connector taskId is undefined, cannot ask question', { baseDir: connector.baseDir });
          return;
        }
        const questionData: QuestionData = {
          baseDir: connector.baseDir,
          taskId: connector.taskId,
          text: message.question,
          subject: message.subject,
          defaultAnswer: message.defaultAnswer,
          isGroupQuestion: message.isGroupQuestion,
        };
        void this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.askQuestion(questionData, false);
      } else if (isSetModelsMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        const modelsData: ModelsData = {
          baseDir: connector.baseDir,
          taskId: connector.taskId!,
          ...message,
        };

        this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.updateAiderModels(modelsData);
      } else if (isUpdateContextFilesMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.updateContextFiles(message.files);
      } else if (isUseCommandOutputMessage(message)) {
        logger.info('Use command output', { ...message });

        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        const project = this.projectManager.getProject(connector.baseDir);
        if (message.finished) {
          project.getTask(connector.taskId)?.closeCommandOutput(message.addToContext);
        } else {
          project.getTask(connector.taskId)?.openCommandOutput(message.command);
        }
      } else if (isTokensInfoMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }

        const data: TokensInfoData = {
          baseDir: connector.baseDir,
          taskId: connector.taskId!,
          ...message.info,
        };
        this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.updateTokensInfo(data);
      } else if (isPromptFinishedMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.info('Prompt finished', {
          baseDir: connector.baseDir,
          promptId: message.promptId,
        });
        this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.promptFinished(message.promptId);
      } else if (isUpdateRepoMapMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        logger.debug('Updating repo map', { baseDir: connector.baseDir });
        this.projectManager.getProject(connector.baseDir).getTask(connector.taskId)?.updateRepoMapFromConnector(message.repoMap);
      } else if (isAddMessageMessage(message)) {
        const connector = this.findConnectorBySocket(socket);
        if (!connector) {
          return;
        }
        void this.projectManager
          .getProject(connector.baseDir)
          .getTask(connector.taskId)
          ?.addRoleContextMessage(message.role, message.content, message.usageReport);
      } else if (isSubscribeEventsMessage(message)) {
        logger.info('Subscribing to events', { eventTypes: message.eventTypes, baseDirs: message.baseDirs });
        this.eventManager.subscribe(socket, {
          eventTypes: message.eventTypes,
          baseDirs: message.baseDirs,
        });
      } else if (isUnsubscribeEventsMessage(message)) {
        logger.info('Unsubscribing from events');
        this.eventManager.unsubscribe(socket);
      } else {
        logger.warn('Unknown message type: ', message);
      }
    } catch (error) {
      logger.error('Socket.IO message parsing error:', { error });
    }
  };

  private processLogMessage = (socket: Socket, message: LogMessage) => {
    logger.debug('Received log message from connector', { message });
    const connector = this.findConnectorBySocket(socket);
    if (!connector) {
      return;
    }

    const project = this.projectManager.getProject(connector.baseDir);
    project.getTask(connector.taskId)?.addLogMessage(message.level, message.message, message.finished, message.promptContext);
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
