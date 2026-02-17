import path from 'path';

import {
  AiderRunOptions,
  ConnectorMessage,
  ConnectorMessageContent,
  ContextFile,
  EditFormat,
  FileEdit,
  MessageRole,
  Mode,
  ModelInfo,
  PromptContext,
} from '@common/types';
import { Socket } from 'socket.io';

import logger from '@/logger';
import {
  AddFileMessage,
  AddMessageMessage,
  AnswerQuestionMessage,
  ApplyEditsMessage,
  CompactConversationMessage,
  DropFileMessage,
  InterruptResponseMessage,
  Message,
  MessageAction,
  PromptMessage,
  RequestContextInfoMessage,
  RunCommandMessage,
  SetModelsMessage,
  UpdateEnvVarsMessage,
  UpdateModelsInfoMessage,
} from '@/messages';

export class Connector {
  constructor(
    readonly socket: Socket,
    readonly baseDir: string,
    readonly taskId: string | undefined,
    readonly source: string | undefined,
    readonly listenTo: MessageAction[] = [],
    readonly inputHistoryFile?: string,
  ) {}

  private sendMessage = (message: Message) => {
    if (!this.socket.connected) {
      logger.warn('Socket.IO client is not connected');
      return;
    }
    logger.info('Sending message to connector:', {
      baseDir: this.baseDir,
      messageType: message.action,
    });
    this.socket.emit('message', message);
  };

  public sendPromptMessage(
    prompt: string,
    promptContext: PromptContext,
    mode: Mode | null = null,
    architectModel: string | null = null,
    messages: ConnectorMessage[] = [],
    files: ContextFile[] = [],
    options?: AiderRunOptions,
  ): void {
    const message: PromptMessage = {
      action: 'prompt',
      prompt,
      promptContext,
      mode,
      architectModel,
      messages,
      files,
      options,
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

  public sendAddFileMessage = (contextFile: ContextFile, noUpdate = false) => {
    const filePath = contextFile.readOnly || contextFile.path.startsWith(this.baseDir) ? contextFile.path : path.join(this.baseDir, contextFile.path);

    const message: AddFileMessage = {
      action: 'add-file',
      path: filePath,
      readOnly: contextFile.readOnly,
      noUpdate,
    };
    this.sendMessage(message);
  };

  public sendDropFileMessage = (path: string, noUpdate = false) => {
    const message: DropFileMessage = {
      action: 'drop-file',
      path,
      noUpdate,
    };
    this.sendMessage(message);
  };

  public sendSetModelsMessage(mainModel: string, weakModel: string | null, editFormat: EditFormat, environmentVariables?: Record<string, string>): void {
    const message: SetModelsMessage = {
      action: 'set-models',
      mainModel,
      weakModel,
      editFormat,
      environmentVariables,
    };
    this.sendMessage(message);
  }

  public sendRunCommandMessage(command: string, messages: ConnectorMessage[] = [], files: ContextFile[] = []): void {
    const message: RunCommandMessage = {
      action: 'run-command',
      command: `/${command}`,
      messages,
      files,
    };
    this.sendMessage(message);
  }

  public sendAddMessageMessage(role: MessageRole = MessageRole.User, content: ConnectorMessageContent, acknowledge = true) {
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

  public sendCompactConversationMessage(customInstructions?: string) {
    const message: CompactConversationMessage = {
      action: 'compact-conversation',
      customInstructions,
    };
    this.sendMessage(message);
  }

  public sendUpdateEnvVarsMessage(environmentVariables: Record<string, unknown>) {
    const message: UpdateEnvVarsMessage = {
      action: 'update-env-vars',
      environmentVariables,
    };
    this.sendMessage(message);
  }

  public sendRequestTokensInfoMessage(messages: ConnectorMessage[], files: ContextFile[]) {
    const message: RequestContextInfoMessage = {
      action: 'request-context-info',
      messages,
      files,
    };
    this.sendMessage(message);
  }

  public sendUpdateModelsInfoMessage(modelsInfo: Record<string, ModelInfo>) {
    const message: UpdateModelsInfoMessage = {
      action: 'update-models-info',
      modelsInfo,
    };
    this.sendMessage(message);
  }
}
