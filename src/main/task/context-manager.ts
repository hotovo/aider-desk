import path from 'path';
import { promises as fs } from 'fs';

import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import {
  ConnectorMessage,
  ContextFile,
  ContextMessage,
  ContextToolMessage,
  MessageRole,
  ResponseCompletedData,
  TaskContext,
  ToolData,
  UsageReportData,
  UserMessageData,
} from '@common/types';
import { extractServerNameToolName, extractTextContent, fileExists, isMessageEmpty, isTextContent } from '@common/utils';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK } from '@common/tools';

import type { ToolResultPart } from 'ai';

import logger from '@/logger';
import { Task } from '@/task';
import { isDirectory, isFileIgnored } from '@/utils';
import { ANSWER_RESPONSE_START_TAG, extractPromptContextFromToolResult, THINKING_RESPONSE_STAR_TAG } from '@/agent/utils';
import { migrateContextV1toV2 } from '@/task/migrations/v1-to-v2';
import { AIDER_DESK_TASKS_DIR } from '@/constants';

const CURRENT_CONTEXT_VERSION = 2;

export class ContextManager {
  private messages: ContextMessage[];
  private files: ContextFile[];
  private loadPromise: Promise<void> | null = null;
  private loaded = false;
  private autosaveEnabled = false;
  private readonly storagePath: string;

  constructor(
    private readonly task: Task,
    private readonly taskId: string,
    initialMessages: ContextMessage[] = [],
    initialFiles: ContextFile[] = [],
  ) {
    this.messages = initialMessages;
    this.files = initialFiles;

    // Task-specific storage path - single context per task
    this.storagePath = path.join(task.getProjectDir(), AIDER_DESK_TASKS_DIR, taskId, 'context.json');
  }

  public enableAutosave() {
    logger.debug('Enabling autosave for task', { taskId: this.taskId });
    this.autosaveEnabled = true;
  }

  public disableAutosave() {
    logger.debug('Disabling autosave for task', { taskId: this.taskId });
    this.autosaveEnabled = false;
  }

  addContextMessage(role: MessageRole, content: string, usageReport?: UsageReportData): void;
  addContextMessage(message: ContextMessage): void;
  addContextMessage(roleOrMessage: MessageRole | ContextMessage, content?: string, usageReport?: UsageReportData) {
    let message: ContextMessage;

    if (typeof roleOrMessage === 'string') {
      if (!content) {
        return;
      }

      message = {
        id: uuidv4(),
        role: roleOrMessage,
        content: content || '',
        usageReport,
      } as ContextMessage;
    } else {
      message = roleOrMessage;

      if (roleOrMessage.role === 'assistant' && isMessageEmpty(message.content)) {
        logger.debug('Skipping empty assistant message', {
          taskId: this.taskId,
        });
        return;
      }
    }

    this.messages.push(message);
    logger.debug(`Task ${this.taskId}: Added ${message.role} message. Total messages: ${this.messages.length}`);
    this.autosave();
  }

  private async isFileIgnored(contextFile: ContextFile): Promise<boolean> {
    if (contextFile.readOnly) {
      return false;
    }
    return isFileIgnored(this.task.getTaskDir(), contextFile.path);
  }

  async addContextFile(contextFile: ContextFile): Promise<ContextFile[]> {
    const absolutePath = path.resolve(this.task.getTaskDir(), contextFile.path);
    const isDir = await isDirectory(absolutePath);
    const alreadyAdded = this.files.find((file) => path.resolve(this.task.getTaskDir(), file.path) === absolutePath);

    if (alreadyAdded) {
      return [];
    }

    if (isDir) {
      logger.debug('Recursively adding files in directory to task context:', {
        taskId: this.taskId,
        path: contextFile.path,
        absolutePath,
      });

      const addedFiles: ContextFile[] = [];
      try {
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(contextFile.path, entry.name);
          const entryContextFile: ContextFile = {
            path: entryPath,
            readOnly: contextFile.readOnly ?? false,
          };
          const newAddedFiles = await this.addContextFile(entryContextFile);
          addedFiles.push(...newAddedFiles);
        }
      } catch (error) {
        logger.error('Failed to read directory for task:', {
          taskId: this.taskId,
          path: contextFile.path,
          error,
        });
      }
      return addedFiles;
    } else {
      if (!(await fileExists(absolutePath))) {
        logger.debug('Skipping non-existing file for task:', {
          taskId: this.taskId,
          path: contextFile.path,
          absolutePath,
        });
        return [];
      }
      if (await this.isFileIgnored(contextFile)) {
        logger.debug('Skipping ignored file for task:', {
          taskId: this.taskId,
          path: contextFile.path,
        });
        return [];
      }
      logger.debug('Adding file to task context:', {
        taskId: this.taskId,
        path: contextFile.path,
      });
      const newContextFile = {
        ...contextFile,
        readOnly: contextFile.readOnly ?? false,
      };
      this.files.push(newContextFile);
      this.autosave();
      return [newContextFile];
    }
  }

  dropContextFile(filePath: string): ContextFile[] {
    const absolutePath = path.resolve(this.task.getTaskDir(), filePath);
    const droppedFiles: ContextFile[] = [];

    this.files = this.files.filter((f) => {
      const contextFileAbsolutePath = path.resolve(this.task.getTaskDir(), f.path);
      const isMatch = f.path === filePath || contextFileAbsolutePath === absolutePath || !path.relative(absolutePath, contextFileAbsolutePath).startsWith('..');

      if (isMatch) {
        droppedFiles.push(f);
        return false;
      }
      return true;
    });

    logger.debug('Dropped files from task context:', {
      taskId: this.taskId,
      path: filePath,
      absolutePath,
      droppedFiles: droppedFiles.map((f) => f.path),
    });

    if (droppedFiles.length > 0) {
      this.autosave();
    }

    return droppedFiles;
  }

  setContextFiles(contextFiles: ContextFile[], save = true) {
    logger.debug('Setting task context files', {
      taskId: this.taskId,
      files: contextFiles.map((f) => f.path),
    });
    this.files = contextFiles;
    if (save) {
      this.autosave();
    }
  }

  getContextFiles(): ContextFile[] {
    return [...this.files];
  }

  async getContextFilesEnsureLoaded(): Promise<ContextFile[]> {
    if (!this.loaded) {
      await this.load();
    }
    return [...this.files];
  }

  setContextMessages(contextMessages: ContextMessage[], save = true) {
    logger.debug('Setting task context messages', {
      taskId: this.taskId,
      messages: contextMessages.length,
      save,
    });
    this.messages = contextMessages;
    if (save) {
      this.autosave();
    }
  }

  async getContextMessages(): Promise<ContextMessage[]> {
    if (!this.loaded) {
      await this.load();
    }
    // Deep clone messages to prevent external modifications from affecting internal state
    return this.messages.map((msg): ContextMessage => {
      if (msg.role === 'tool') {
        return {
          ...msg,
          content: msg.content.map((part) => ({ ...part })),
        };
      }
      return {
        ...msg,
        content: Array.isArray(msg.content) ? msg.content.map((part) => ({ ...part })) : msg.content,
      };
    });
  }

  clearContextFiles(save = true) {
    logger.debug('Clearing task context files', { taskId: this.taskId });
    this.files = [];
    if (save) {
      this.autosave();
    }
  }

  clearMessages(save = true) {
    logger.debug('Clearing task messages', { taskId: this.taskId });
    this.messages = [];
    if (save) {
      this.autosave();
    }
  }

  removeMessageById(messageId: string): string[] {
    // First, try to find a message with the exact ID
    const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);

    if (messageIndex !== -1) {
      const message = this.messages[messageIndex];

      // If it's an assistant message with array content
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        // Check if it has mixed content (text/reasoning + tool calls)
        const hasTextOrReasoning = message.content.some((part) => part.type === 'text' || part.type === 'reasoning');
        const hasToolCalls = message.content.some((part) => part.type === 'tool-call');

        if (hasTextOrReasoning && hasToolCalls) {
          // Remove only text and reasoning parts, keep the message with tool calls
          message.content = message.content.filter((part) => part.type !== 'text' && part.type !== 'reasoning');
          logger.debug(`Task ${this.taskId}: Removed text and reasoning parts from assistant message (ID: ${messageId}). Kept tool calls.`);
          this.autosave();
          return [messageId];
        }
      }

      // Otherwise, remove the whole message
      return this.removeMessageByIndex(messageIndex, messageId);
    }

    // If not found by ID, try to find by tool call ID
    return this.removeByToolCallId(messageId);
  }

  private removeMessageByIndex(index: number, messageId: string): string[] {
    const removedIds: string[] = [];
    removedIds.push(messageId);

    const messageToRemove = this.messages[index];
    logger.debug(`Task ${this.taskId}: Removing message (ID: ${messageId}, Role: ${messageToRemove.role})`);

    if (
      messageToRemove.role === 'tool' &&
      Array.isArray(messageToRemove.content) &&
      messageToRemove.content.length > 0 &&
      messageToRemove.content[0].type === 'tool-result'
    ) {
      const toolCallIdToRemove = messageToRemove.content[0].toolCallId;
      this.messages.splice(index, 1);
      logger.debug(
        `Task ${this.taskId}: Removed tool message (ID: ${messageId}, Tool Call ID: ${toolCallIdToRemove}). Total messages: ${this.messages.length}`,
      );

      for (let i = this.messages.length - 1; i >= 0; i--) {
        const potentialAssistantMessage = this.messages[i];

        if (potentialAssistantMessage.role === 'assistant' && Array.isArray(potentialAssistantMessage.content)) {
          const toolCallIndex = potentialAssistantMessage.content.findIndex((part) => part.type === 'tool-call' && part.toolCallId === toolCallIdToRemove);

          if (toolCallIndex !== -1) {
            potentialAssistantMessage.content.splice(toolCallIndex, 1);
            logger.debug(`Task ${this.taskId}: Removed tool-call part (ID: ${toolCallIdToRemove}) from assistant message at index ${i}.`);

            const isEmpty = potentialAssistantMessage.content.length === 0;

            if (isEmpty) {
              this.messages.splice(i, 1);
              removedIds.push(potentialAssistantMessage.id);
              logger.debug(
                `Task ${this.taskId}: Removed empty assistant message at index ${i} after removing tool-call. Total messages: ${this.messages.length}`,
              );
            }
            break;
          }
        }
      }
    } else {
      this.messages.splice(index, 1);
      logger.debug(`Task ${this.taskId}: Removed non-tool message (ID: ${messageId}). Total messages: ${this.messages.length}`);
    }

    this.autosave();
    return removedIds;
  }

  private removeByToolCallId(toolCallId: string): string[] {
    const removedIds: string[] = [];

    // Find tool message with matching toolCallId
    let toolMessageIndex = -1;
    let toolMessageContentIndex = -1;

    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.role === 'tool' && Array.isArray(message.content)) {
        const toolResultIndex = message.content.findIndex((part) => part.type === 'tool-result' && part.toolCallId === toolCallId);
        if (toolResultIndex !== -1) {
          toolMessageIndex = i;
          toolMessageContentIndex = toolResultIndex;
          break;
        }
      }
    }

    if (toolMessageIndex === -1) {
      const error = new Error(`Message or tool call not found: ${toolCallId}`);
      logger.error('Failed to remove by tool call ID', {
        taskId: this.taskId,
        toolCallId,
      });
      throw error;
    }

    const toolMessage = this.messages[toolMessageIndex];

    // Remove only the tool-result part from the tool message
    if (Array.isArray(toolMessage.content)) {
      toolMessage.content.splice(toolMessageContentIndex, 1);
      logger.debug(`Task ${this.taskId}: Removed tool-result part (Tool Call ID: ${toolCallId}) from tool message at index ${toolMessageIndex}.`);
    }

    // If tool message is now empty, remove the whole message
    if (Array.isArray(toolMessage.content) && toolMessage.content.length === 0) {
      this.messages.splice(toolMessageIndex, 1);
      removedIds.push(toolMessage.id);
      logger.debug(
        `Task ${this.taskId}: Removed empty tool message at index ${toolMessageIndex} after removing tool-result. Total messages: ${this.messages.length}`,
      );
    }

    // Search backwards for assistant message with matching tool-call
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const assistantMessage = this.messages[i];

      if (assistantMessage.role === 'assistant' && Array.isArray(assistantMessage.content)) {
        const toolCallIndex = assistantMessage.content.findIndex((part) => part.type === 'tool-call' && part.toolCallId === toolCallId);

        if (toolCallIndex !== -1) {
          assistantMessage.content.splice(toolCallIndex, 1);
          logger.debug(`Task ${this.taskId}: Removed tool-call part (Tool Call ID: ${toolCallId}) from assistant message at index ${i}.`);

          // If assistant message is now empty, remove the whole message
          if (assistantMessage.content.length === 0) {
            this.messages.splice(i, 1);
            removedIds.push(assistantMessage.id);
            logger.debug(
              `Task ${this.taskId}: Removed empty assistant message at index ${i} after removing tool-call. Total messages: ${this.messages.length}`,
            );
          }
          break;
        }
      }
    }

    this.autosave();
    return removedIds;
  }

  removeLastMessage(): void {
    if (this.messages.length === 0) {
      logger.warn('Attempted to remove last message from task, but message list is empty.', {
        taskId: this.taskId,
      });
      return;
    }

    const lastMessage = this.messages[this.messages.length - 1];

    if (lastMessage.role === 'tool' && Array.isArray(lastMessage.content) && lastMessage.content.length > 0 && lastMessage.content[0].type === 'tool-result') {
      const toolMessage = this.messages.pop() as ContextMessage & {
        role: 'tool';
      };
      const toolCallIdToRemove = toolMessage.content[0].toolCallId;
      logger.debug(`Task ${this.taskId}: Removed last tool message (ID: ${toolCallIdToRemove}). Total messages: ${this.messages.length}`);

      for (let i = this.messages.length - 1; i >= 0; i--) {
        const potentialAssistantMessage = this.messages[i];

        if (potentialAssistantMessage.role === 'assistant' && Array.isArray(potentialAssistantMessage.content)) {
          const toolCallIndex = potentialAssistantMessage.content.findIndex((part) => part.type === 'tool-call' && part.toolCallId === toolCallIdToRemove);

          if (toolCallIndex !== -1) {
            potentialAssistantMessage.content.splice(toolCallIndex, 1);
            logger.debug(`Task ${this.taskId}: Removed tool-call part (ID: ${toolCallIdToRemove}) from assistant message at index ${i}.`);

            const isEmpty = potentialAssistantMessage.content.length === 0;

            if (isEmpty) {
              this.messages.splice(i, 1);
              logger.debug(
                `Task ${this.taskId}: Removed empty assistant message at index ${i} after removing tool-call. Total messages: ${this.messages.length}`,
              );
            }
            break;
          }
        }
      }
    } else {
      this.messages.pop();
      logger.debug(`Task ${this.taskId}: Removed last non-tool message. Total messages: ${this.messages.length}`);
    }

    this.autosave();
  }

  removeMessagesUpToLastUserMessage(): ContextMessage[] {
    const lastUserMessageIndex = this.messages.findLastIndex((msg) => msg.role === MessageRole.User);
    if (lastUserMessageIndex === -1) {
      logger.warn('No user message found to remove up to.', {
        taskId: this.taskId,
      });
      return [];
    }

    const removedMessages = this.messages.splice(lastUserMessageIndex);
    logger.debug(`Task ${this.taskId}: Removed ${removedMessages.length} messages up to last user message. Total messages: ${this.messages.length}`);
    this.autosave();

    return removedMessages;
  }

  toConnectorMessages(contextMessages: ContextMessage[] = this.messages): ConnectorMessage[] {
    let aiderPrompt = '';
    let subAgentsPrompt = '';

    return contextMessages.flatMap((message) => {
      if (message.role === MessageRole.User || message.role === MessageRole.Assistant) {
        aiderPrompt = '';

        if (message.role === MessageRole.Assistant && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'tool-call') {
              const [serverName, toolName] = extractServerNameToolName(part.toolName);
              if (
                serverName === AIDER_TOOL_GROUP_NAME &&
                toolName === AIDER_TOOL_RUN_PROMPT &&
                part.input &&
                typeof part.input === 'object' &&
                'prompt' in part.input
              ) {
                aiderPrompt = part.input.prompt as string;
                break;
              }
              if (
                serverName === SUBAGENTS_TOOL_GROUP_NAME &&
                toolName === SUBAGENTS_TOOL_RUN_TASK &&
                part.input &&
                typeof part.input === 'object' &&
                'prompt' in part.input
              ) {
                subAgentsPrompt = part.input.prompt as string;
                break;
              }
            }
          }
        }

        const content = extractTextContent(message.content);
        if (!content) {
          return [];
        }
        return [
          {
            role: message.role,
            content,
          },
        ];
      } else if (message.role === 'tool' && Array.isArray(message.content)) {
        return message.content.flatMap((part) => {
          const [serverName, toolName] = extractServerNameToolName(part.toolName);
          if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT && aiderPrompt) {
            const messages = [
              {
                role: MessageRole.User,
                content: aiderPrompt,
              },
            ];

            if (part.output?.type === 'text') {
              messages.push({
                role: MessageRole.Assistant,
                content: part.output.value,
              });
            } else if (part.output?.type === 'json' && part.output.value && typeof part.output.value === 'object' && 'responses' in part.output.value) {
              const responses: ResponseCompletedData[] = part.output.value.responses as unknown as ResponseCompletedData[];
              if (responses) {
                responses.forEach((response: ResponseCompletedData) => {
                  if (response.reflectedMessage) {
                    messages.push({
                      role: MessageRole.User,
                      content: response.reflectedMessage,
                    });
                  }
                  if (response.content) {
                    messages.push({
                      role: MessageRole.Assistant,
                      content: response.content,
                    });
                  }
                });
              }
            }

            return messages;
          } else if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK && subAgentsPrompt) {
            const messages = [
              {
                role: MessageRole.User,
                content: subAgentsPrompt,
              },
            ];

            if (part.output.value && Array.isArray(part.output.value) && part.output.value.length > 0) {
              const lastMessage = part.output.value[part.output.value.length - 1];
              if (lastMessage && typeof lastMessage === 'object' && 'role' in lastMessage && lastMessage.role === MessageRole.Assistant) {
                const content = extractTextContent(lastMessage.content);
                if (content) {
                  messages.push({
                    role: MessageRole.Assistant,
                    content: content,
                  });
                }
              }
            }

            return messages;
          } else {
            return [
              {
                role: MessageRole.Assistant,
                content: `I called tool ${part.toolName} and got result:\n${JSON.stringify(part.output.value)}`,
              },
            ];
          }
        });
      } else {
        return [];
      }
    }) as { role: MessageRole; content: string }[];
  }

  async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storagePath), { recursive: true });

      const contextData: TaskContext = {
        version: CURRENT_CONTEXT_VERSION,
        contextMessages: this.messages,
        contextFiles: this.files,
      };

      await fs.writeFile(this.storagePath, JSON.stringify(contextData, null, 2), 'utf8');
      logger.info(`Task context saved to ${this.storagePath}`, {
        taskId: this.taskId,
      });
    } catch (error) {
      logger.error('Failed to save task context:', {
        error,
        taskId: this.taskId,
      });
      throw error;
    }
  }

  private async cleanupContext(): Promise<void> {
    // Filter out files that no longer exist
    const existingFiles: ContextFile[] = [];
    for (const file of this.files) {
      const absolutePath = path.resolve(this.task.getTaskDir(), file.path);
      if (await fileExists(absolutePath)) {
        existingFiles.push(file);
      }
    }
    this.files = existingFiles;
  }

  private async migrateContext(contextData: unknown): Promise<TaskContext> {
    let migratedContext = contextData as TaskContext;
    let contextVersion = migratedContext.version ?? 1;

    if (contextVersion === CURRENT_CONTEXT_VERSION) {
      return migratedContext;
    }

    logger.debug(`Migrating task context from version ${contextVersion} to ${CURRENT_CONTEXT_VERSION}`, {
      taskId: this.taskId,
    });

    // Sequential migration chain
    if (contextVersion === 1) {
      migratedContext = migrateContextV1toV2(this.taskId, migratedContext);
      contextVersion = 2;
    }
    // Future migrations will be added here
    // if (sessionVersion === 2) {
    //   migratedData = migrateSessionV2toV3(migratedData);
    //   sessionVersion = 3;
    // }

    migratedContext.version = CURRENT_CONTEXT_VERSION;
    return migratedContext;
  }

  async load(): Promise<void> {
    try {
      if (this.loaded) {
        return;
      }

      if (this.loadPromise) {
        await this.loadPromise;
        return;
      }

      this.loadPromise = this.loadInternal();
      await this.loadPromise;
      this.loadPromise = null;

      logger.info(`Task context loaded from ${this.storagePath}`, {
        taskId: this.taskId,
      });
    } catch (error) {
      logger.error('Failed to load task context:', {
        error,
        taskId: this.taskId,
      });
      throw error;
    } finally {
      this.enableAutosave();
    }
  }

  private async loadInternal(): Promise<void> {
    if (!(await fileExists(this.storagePath))) {
      logger.debug('No existing task context found:', {
        taskId: this.taskId,
      });
      this.loaded = true;
      return;
    }

    this.disableAutosave();

    const content = await fs.readFile(this.storagePath, 'utf8');
    const contextData = content ? JSON.parse(content) : null;

    if (!contextData) {
      logger.debug('Empty task context found:', { taskId: this.taskId });
      this.loaded = true;
      return;
    }

    const migratedData = await this.migrateContext(contextData);

    this.messages = migratedData.contextMessages || [];
    this.files = migratedData.contextFiles || [];
    this.loaded = true;

    await this.cleanupContext();
  }

  async loadMessages(messages: ContextMessage[]): Promise<void> {
    // Clear all current messages
    await this.task.clearContext(false, false);

    this.messages = messages;

    // Get the messages data and send them to the UI
    const messagesData = this.getContextMessagesData(messages);

    for (const messageData of messagesData) {
      if (messageData.type === 'user') {
        // UserMessageData
        this.task.sendUserMessage(messageData);
      } else if (messageData.type === 'response-completed') {
        // ResponseCompletedData
        this.task.sendResponseCompleted(messageData);
      } else if (messageData.type === 'tool') {
        // ToolData
        this.task.sendToolMessage(messageData);
      }
    }

    // send messages to Connectors (Aider)
    this.toConnectorMessages().forEach((message) => {
      this.task.sendAddMessage(message.role, message.content, false);
    });
  }

  async delete(): Promise<void> {
    logger.info('Deleting task context:', { taskId: this.taskId });
    try {
      if (await fileExists(this.storagePath)) {
        await fs.unlink(this.storagePath);
        logger.info(`Task context deleted: ${this.storagePath}`, {
          taskId: this.taskId,
        });
      }
    } catch (error) {
      logger.error('Failed to delete task context:', {
        error,
        taskId: this.taskId,
      });
      throw error;
    }
  }

  private debouncedAutosave = debounce(async () => {
    if (this.autosaveEnabled) {
      await this.save();
    }
  }, 1000);

  private autosave() {
    if (this.autosaveEnabled) {
      void this.debouncedAutosave();
    }
  }

  public getContextMessagesData(contextMessages: ContextMessage[] = this.messages): (UserMessageData | ResponseCompletedData | ToolData)[] {
    const messagesData: (UserMessageData | ResponseCompletedData | ToolData)[] = [];

    for (const message of contextMessages) {
      const processToolResult = (part: ToolResultPart) => {
        const [serverName, toolName] = extractServerNameToolName(part.toolName);
        const promptContext = extractPromptContextFromToolResult(part.output.value) || message.promptContext;
        const toolMessage = messagesData.find((message) => message.type === 'tool' && message.id === part.toolCallId) as ToolData | undefined;

        if (toolMessage) {
          toolMessage.response = JSON.stringify(part.output.value);
          toolMessage.usageReport = message.usageReport || toolMessage.usageReport;
          toolMessage.promptContext = promptContext;
        }

        // Handle aider tool responses - create ResponseCompletedData for each response
        if (
          serverName === AIDER_TOOL_GROUP_NAME &&
          toolName === AIDER_TOOL_RUN_PROMPT &&
          part.output?.value &&
          typeof part.output.value === 'object' &&
          'responses' in part.output.value
        ) {
          const responses = part.output.value.responses as unknown as ResponseCompletedData[];
          if (Array.isArray(responses)) {
            responses.forEach((response: ResponseCompletedData) => {
              const responseCompletedData: ResponseCompletedData = {
                type: 'response-completed',
                messageId: response.messageId,
                content: response.content,
                baseDir: this.task.getProjectDir(),
                taskId: this.taskId,
                reflectedMessage: response.reflectedMessage,
                editedFiles: response.editedFiles,
                commitHash: response.commitHash,
                commitMessage: response.commitMessage,
                diff: response.diff,
                usageReport: response.usageReport,
                promptContext: message.promptContext,
              };
              messagesData.push(responseCompletedData);
            });
          }
        }

        // Handle agent tool results - process all messages from subagent
        if (
          serverName === SUBAGENTS_TOOL_GROUP_NAME &&
          toolName === SUBAGENTS_TOOL_RUN_TASK &&
          part.output?.value &&
          typeof part.output.value === 'object' &&
          'messages' in part.output.value
        ) {
          const messages = part.output.value.messages as unknown as ContextMessage[];
          if (Array.isArray(messages)) {
            messages.forEach((subMessage: ContextMessage) => {
              if (subMessage.role === 'assistant') {
                if (Array.isArray(subMessage.content)) {
                  // Collect reasoning and text parts to combine them if both exist
                  let subReasoningContent = '';
                  let subTextContent = '';
                  let subHasReasoning = false;
                  let subHasText = false;

                  for (const subPart of subMessage.content) {
                    if (subPart.type === 'reasoning' && subPart.text?.trim()) {
                      subReasoningContent = subPart.text.trim();
                      subHasReasoning = true;
                    } else if (subPart.type === 'text' && subPart.text) {
                      subTextContent = subPart.text.trim();
                      subHasText = true;
                    }
                  }

                  // Process combined reasoning and text content
                  if (subHasReasoning || subHasText) {
                    let subFinalContent = '';
                    if (subHasReasoning && subHasText) {
                      subFinalContent = `${THINKING_RESPONSE_STAR_TAG}${subReasoningContent}${ANSWER_RESPONSE_START_TAG}${subTextContent}`;
                    } else {
                      subFinalContent = subReasoningContent || subTextContent;
                    }

                    const responseCompletedData: ResponseCompletedData = {
                      type: 'response-completed',
                      messageId: subMessage.id,
                      content: subFinalContent,
                      baseDir: this.task.getProjectDir(),
                      taskId: this.taskId,
                      usageReport: subMessage.usageReport,
                      promptContext: subMessage.promptContext,
                    };
                    messagesData.push(responseCompletedData);
                  }

                  // Process tool-call parts
                  for (const subPart of subMessage.content) {
                    if (subPart.type === 'tool-call' && subPart.toolCallId) {
                      const [subServerName, subToolName] = extractServerNameToolName(subPart.toolName);
                      const toolData: ToolData = {
                        type: 'tool',
                        baseDir: this.task.getProjectDir(),
                        taskId: this.taskId,
                        id: subPart.toolCallId,
                        serverName: subServerName,
                        toolName: subToolName,
                        args: subPart.input,
                        usageReport: undefined,
                        promptContext: subMessage.promptContext,
                      };
                      messagesData.push(toolData);
                    }
                  }
                } else if (isTextContent(subMessage.content)) {
                  const content = extractTextContent(subMessage.content);
                  const responseCompletedData: ResponseCompletedData = {
                    type: 'response-completed',
                    messageId: subMessage.id,
                    content: content,
                    baseDir: this.task.getProjectDir(),
                    taskId: this.taskId,
                    usageReport: subMessage.usageReport,
                    promptContext: subMessage.promptContext,
                  };
                  messagesData.push(responseCompletedData);
                }
              } else if (subMessage.role === 'tool') {
                for (const subPart of subMessage.content) {
                  if (subPart.type === 'tool-result') {
                    const toolMessage = messagesData.find((message) => message.type === 'tool' && message.id === subPart.toolCallId) as ToolData | undefined;
                    if (toolMessage) {
                      toolMessage.response = JSON.stringify(subPart.output.value);
                    }
                  }
                }
              }
            });
          }
        }
      };

      if (message.role === 'assistant') {
        if (Array.isArray(message.content)) {
          const toolResultsMap = new Map<string, { toolName: string; output: unknown }>();
          let reasoning = '';
          let responseMessageIndex = 0;

          const pushResponseCompletedData = (content = '') => {
            let finalContent = '';
            if (reasoning) {
              finalContent = `${THINKING_RESPONSE_STAR_TAG}${reasoning.trim()}${ANSWER_RESPONSE_START_TAG}${content.trim()}`;
            } else {
              finalContent = content.trim();
            }

            const messageId = responseMessageIndex === 0 ? message.id : `${message.id}-${responseMessageIndex}`;
            const responseCompletedData: ResponseCompletedData = {
              type: 'response-completed',
              messageId,
              content: finalContent,
              baseDir: this.task.getProjectDir(),
              taskId: this.taskId,
              reflectedMessage: message.reflectedMessage,
              editedFiles: message.editedFiles,
              commitHash: message.commitHash,
              commitMessage: message.commitMessage,
              diff: message.diff,
              usageReport: message.usageReport,
              promptContext: message.promptContext,
            };
            messagesData.push(responseCompletedData);

            reasoning = '';
            responseMessageIndex++;
          };

          for (const part of message.content) {
            if (part.type === 'reasoning' && part.text?.trim()) {
              reasoning = part.text.trim();
            } else if (part.type === 'text' && part.text) {
              pushResponseCompletedData(part.text);
            } else if (part.type === 'tool-call') {
              if (reasoning) {
                pushResponseCompletedData();
              }

              // Create tool message for tool-call parts
              const toolCall = part;
              if (!toolCall.toolCallId) {
                continue;
              }

              const [serverName, toolName] = extractServerNameToolName(toolCall.toolName);
              const toolData: ToolData = {
                type: 'tool',
                baseDir: this.task.getProjectDir(),
                taskId: this.taskId,
                id: toolCall.toolCallId,
                serverName,
                toolName,
                args: toolCall.input,
                usageReport: message.usageReport,
                promptContext: message.promptContext,
              };
              messagesData.push(toolData);
            } else if (part.type === 'tool-result') {
              processToolResult(part);
            }
          }

          if (reasoning) {
            pushResponseCompletedData();
          }

          // Now update tool messages with their responses from tool-results
          for (const [toolCallId, toolResultData] of toolResultsMap.entries()) {
            const toolMessage = messagesData.find((msg) => msg.type === 'tool' && msg.id === toolCallId) as ToolData | undefined;

            if (toolMessage) {
              toolMessage.response = JSON.stringify(toolResultData.output);
              toolMessage.usageReport = message.usageReport || toolMessage.usageReport;
              const promptContext = extractPromptContextFromToolResult(toolResultData.output);
              if (promptContext) {
                toolMessage.promptContext = promptContext;
              }
            }
          }
        } else if (isTextContent(message.content)) {
          const content = extractTextContent(message.content);
          if (!content.trim()) {
            continue;
          }

          const responseCompletedData: ResponseCompletedData = {
            type: 'response-completed',
            messageId: message.id,
            content: content,
            baseDir: this.task.getProjectDir(),
            taskId: this.taskId,
            reflectedMessage: message.reflectedMessage,
            usageReport: message.usageReport,
            promptContext: message.promptContext,
          };
          messagesData.push(responseCompletedData);
        }
      } else if (message.role === 'user') {
        const content = extractTextContent(message.content);
        const userMessageData: UserMessageData = {
          type: 'user',
          id: message.id || uuidv4(),
          baseDir: this.task.getProjectDir(),
          taskId: this.taskId,
          content: content,
          promptContext: message.promptContext,
        };
        messagesData.push(userMessageData);
      } else if (message.role === 'tool' && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            processToolResult(part);
          }
        }
      }
    }

    return messagesData;
  }

  async generateContextMarkdown(): Promise<string | null> {
    let markdown = '';

    for (const message of this.messages) {
      markdown += `### ${message.role.charAt(0).toUpperCase() + message.role.slice(1)}\n\n`;

      if (message.role === 'user' || message.role === 'assistant') {
        const content = extractTextContent(message.content);
        if (content) {
          markdown += `${content}\n\n`;
        }
      } else if (message.role === 'tool') {
        if (Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'tool-result') {
              const [, toolName] = extractServerNameToolName(part.toolName);
              markdown += `**Tool Call ID:** \`${part.toolCallId}\`\n`;
              markdown += `**Tool:** \`${toolName}\`\n`;
              markdown += `**Result:**\n\`\`\`json\n${JSON.stringify(part.output.value, null, 2)}\n\`\`\`\n\n`;
            }
          }
        }
      }
    }

    return markdown;
  }

  getMessagesUpTo(messageId: string): ContextMessage[] {
    let messageIndex = this.messages.findIndex((msg) => msg.id === messageId);

    // If not found as a message ID, check if it's a toolCallId
    if (messageIndex === -1) {
      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          const hasMatchingToolResult = msg.content.some((part) => part.type === 'tool-result' && part.toolCallId === messageId);
          if (hasMatchingToolResult) {
            messageIndex = i;
            break;
          }
        }
      }
    }

    if (messageIndex === -1) {
      const error = new Error(`Message with id ${messageId} not found`);
      logger.error('Failed to get messages up to:', {
        taskId: this.taskId,
        messageId,
      });
      throw error;
    }

    const targetMessage = this.messages[messageIndex];

    // If it's an assistant message with tool calls, we need to filter out tool calls
    if (targetMessage.role === 'assistant' && Array.isArray(targetMessage.content)) {
      const result = this.messages.slice(0, messageIndex + 1).map((msg) => ({ ...msg }));

      // Filter the assistant message to keep only reasoning and text parts, exclude tool calls
      const targetAssistant = result[messageIndex];
      if (Array.isArray(targetAssistant.content)) {
        targetAssistant.content = targetAssistant.content.filter((part) => part.type === 'reasoning' || part.type === 'text');
      }

      return result;
    }

    // If it's a tool message, we need to handle the assistant message with tool calls
    if (targetMessage.role === 'tool' && Array.isArray(targetMessage.content)) {
      // messageId might be a toolCallId passed directly, or the message ID
      // Try to get the toolCallId from the message content
      let toolCallId = targetMessage.content[0]?.toolCallId;

      // If messageId is a toolCallId that doesn't match the first result, search for it
      if (toolCallId !== messageId) {
        const matchingToolResult = targetMessage.content.find((part) => part.type === 'tool-result' && part.toolCallId === messageId);
        if (matchingToolResult) {
          toolCallId = matchingToolResult.toolCallId;
        }
      }

      if (toolCallId) {
        // Find the assistant message that contains this tool call
        for (let i = messageIndex - 1; i >= 0; i--) {
          const message = this.messages[i];
          if (message.role === 'assistant' && Array.isArray(message.content)) {
            const toolCallIndex = message.content.findIndex((part) => part.type === 'tool-call' && part.toolCallId === toolCallId);

            if (toolCallIndex !== -1) {
              // Clone messages up to and including the assistant message
              const result: ContextMessage[] = this.messages.slice(0, i + 1);

              // Clone the assistant message and keep only tool calls up to and including the target
              const assistantMessage: ContextMessage = {
                ...message,
                content: message.content.slice(0, toolCallIndex + 1),
              };

              result[result.length - 1] = assistantMessage;

              // Add all tool messages up to and including the target
              for (let j = i + 1; j <= messageIndex; j++) {
                const msg = this.messages[j];

                if (msg.role === 'tool' && Array.isArray(msg.content)) {
                  const toolMsg = this.messages[j] as ContextMessage & {
                    role: 'tool';
                  };

                  // Check if this tool message contains a tool-result for a tool-call we kept
                  const toolResult = toolMsg.content.find((part) => part.type === 'tool-result');
                  if (toolResult && toolResult.toolCallId) {
                    // Check if this tool call is in the assistant message we kept
                    const toolCallExists = (assistantMessage.content as Array<{ type: string; toolCallId: string }>).some(
                      (part) => part.type === 'tool-call' && part.toolCallId === toolResult.toolCallId,
                    );

                    if (toolCallExists) {
                      result.push({ ...toolMsg });
                    }
                  }
                } else {
                  result.push({ ...msg });
                }
              }

              return result;
            }
          }
        }
      }
    }

    // For non-tool messages or if we couldn't find the assistant message, return all messages up to the target
    return this.messages.slice(0, messageIndex + 1).map((msg) => ({ ...msg }));
  }

  /**
   * Removes all messages after the specified message ID, keeping messages up to and including the specified message.
   * Uses intelligent slicing logic from getMessagesUpTo to handle tool messages and assistant messages with tool calls.
   * For assistant messages that are the target, inverts the filtering to keep tool calls instead of text/reasoning.
   *
   * @param messageId - The ID of the message to keep (all messages after this will be removed), or a toolCallId
   * @returns Array of removed message IDs
   */
  removeMessagesAfter(messageId: string): string[] {
    // Find the target message index in the original messages array
    let targetMessageIndex = this.messages.findIndex((msg) => msg.id === messageId);

    // If not found as a message ID, check if it's a toolCallId
    if (targetMessageIndex === -1) {
      for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        if (msg.role === 'tool' && Array.isArray(msg.content)) {
          const hasMatchingToolResult = msg.content.some((part) => part.type === 'tool-result' && part.toolCallId === messageId);
          if (hasMatchingToolResult) {
            targetMessageIndex = i;
            break;
          }
        }
      }
    }

    const targetMessage = targetMessageIndex !== -1 ? this.messages[targetMessageIndex] : undefined;
    const isTargetAssistant = targetMessage?.role === 'assistant';

    // Get the messages to keep using the intelligent slicing logic
    const messagesToKeep = this.getMessagesUpTo(messageId);

    // If no messages would be removed, return early
    if (messagesToKeep.length === this.messages.length) {
      return [];
    }

    // Process messages: deep clone all messages and handle assistant message filtering
    const processedMessages = messagesToKeep.map((msg) => {
      // Deep clone the message object
      let clonedMsg: ContextMessage;

      if (msg.role === 'tool') {
        clonedMsg = {
          ...msg,
          content: msg.content.map((part) => ({ ...part })),
        } as ContextToolMessage;
      } else {
        clonedMsg = {
          ...msg,
          content: Array.isArray(msg.content) ? msg.content.map((part) => ({ ...part })) : msg.content,
        } as ContextMessage;
      }

      if (clonedMsg.role === 'assistant' && Array.isArray(clonedMsg.content)) {
        const hasToolCalls = clonedMsg.content.some((part) => part.type === 'tool-call');
        const hasReasoning = clonedMsg.content.some((part) => part.type === 'reasoning');

        if (isTargetAssistant && clonedMsg.id === targetMessage.id) {
          // For target assistant message, get original content and keep text/reasoning (remove tool calls)
          const originalMsg = this.messages.find((m) => m.id === clonedMsg.id);
          if (originalMsg && Array.isArray(originalMsg.content)) {
            const originalHasToolCalls = originalMsg.content.some((part) => part.type === 'tool-call');
            if (originalHasToolCalls) {
              clonedMsg.content = originalMsg.content.filter((part) => part.type === 'text' || part.type === 'reasoning').map((part) => ({ ...part }));
            }
          }
        } else if (hasToolCalls && hasReasoning) {
          // For non-target assistant messages, keep tool calls and text, remove reasoning only
          clonedMsg.content = clonedMsg.content.filter((part) => part.type !== 'reasoning').map((part) => ({ ...part }));
        }
      }

      return clonedMsg;
    });

    // Collect IDs of messages that will be removed
    const removedIds: string[] = [];
    for (let i = messagesToKeep.length; i < this.messages.length; i++) {
      removedIds.push(this.messages[i].id);
    }

    // Replace the messages array with the processed messages
    this.messages = processedMessages;

    logger.debug(`Task ${this.taskId}: Removed ${removedIds.length} message(s) after ${messageId}`, {
      removedIds,
      remainingCount: this.messages.length,
    });

    // Trigger autosave if messages were removed
    if (removedIds.length > 0) {
      this.autosave();
    }

    return removedIds;
  }
}
