import path from 'path';

import { ContextFile, FileEdit } from '@common/types';
import { Socket } from 'socket.io';

import logger from './logger';
import {
  AddFileMessage,
  AddMessageMessage,
  AnswerQuestionMessage,
  ApplyEditsMessage,
  DropFileMessage,
  EditFormat,
  InterruptResponseMessage,
  Message,
  MessageAction,
  PromptMessage,
  RunCommandMessage,
  SetModelsMessage,
} from './messages';

export class Connector {
  socket: Socket;
  baseDir: string;
  listenTo: MessageAction[];
  inputHistoryFile?: string;

  constructor(socket: Socket, baseDir: string, listenTo: MessageAction[] = [], inputHistoryFile?: string) {
    this.socket = socket;
    this.baseDir = baseDir;
    this.listenTo = listenTo;
    this.inputHistoryFile = inputHistoryFile;
  }

  private sendMessage = (message: Message) => {
    if (!this.socket.connected) {
      logger.warn('Socket.IO client is not connected');
      return;
    }
    logger.info('Sending message to client:', {
      baseDir: this.baseDir,
      messageType: message.action,
    });
    this.socket.emit('message', message);
  };

  public sendPromptMessage(prompt: string, editFormat: EditFormat | null = null, architectModel: string | null = null, promptId: string | null = null): void {
    const message: PromptMessage = {
      action: 'prompt',
      prompt,
      editFormat,
      architectModel,
      promptId,
    };
    this.sendMessage(message);
  }

  public sendAnswerQuestionMessage = (answer: string) => {
    const message: AnswerQuestionMessage = {
      action: 'answer-question',
      answer,
    };
    this.sendMessage(message);
  };

  public sendAddFileMessage = (contextFile: ContextFile) => {
    const filePath = contextFile.readOnly || contextFile.path.startsWith(this.baseDir) ? contextFile.path : path.join(this.baseDir, contextFile.path);

    const message: AddFileMessage = {
      action: 'add-file',
      path: filePath,
      readOnly: contextFile.readOnly,
    };
    this.sendMessage(message);
  };

  public sendDropFileMessage = (path: string) => {
    const message: DropFileMessage = {
      action: 'drop-file',
      path,
    };
    this.sendMessage(message);
  };

  public sendSetModelsMessage(mainModel: string, weakModel: string | null): void {
    const message: SetModelsMessage = {
      action: 'set-models',
      mainModel,
      weakModel,
    };
    this.sendMessage(message);
  }

  public sendRunCommandMessage(command: string): void {
    const message: RunCommandMessage = {
      action: 'run-command',
      command: `/${command}`,
    };
    this.sendMessage(message);
  }

  public sendAddMessageMessage(role: 'user' | 'assistant' = 'user', content: string, acknowledge = true) {
    const message: AddMessageMessage = {
      action: 'add-message',
      content,
      role,
      acknowledge,
    };
    this.sendMessage(message);
  }

  public sendInterruptResponseMessage() {
    const message: InterruptResponseMessage = {
      action: 'interrupt-response',
    };
    this.sendMessage(message);
  }

  public sendApplyEditsMessage(edits: FileEdit[]) {
    const message: ApplyEditsMessage = {
      action: 'apply-edits',
      edits,
    };
    this.sendMessage(message);
  }
}
