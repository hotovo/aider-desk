import path from 'path';
import { promises as fs } from 'fs';

import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import { ContextFile, ContextMessage, MessageRole, ResponseCompletedData, TaskContext, UsageReportData } from '@common/types';
import { extractServerNameToolName, extractTextContent, fileExists, isMessageEmpty, isTextContent } from '@common/utils';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK } from '@common/tools';

import logger from '@/logger';
import { Task } from '@/task';
import { isDirectory, isFileIgnored } from '@/utils';
import { ANSWER_RESPONSE_START_TAG, extractPromptContextFromToolResult, THINKING_RESPONSE_STAR_TAG } from '@/agent/utils';
import { migrateContextV1toV2 } from '@/task/migrations/v1-to-v2';

const CURRENT_CONTEXT_VERSION = 2;

export class ContextManager {
  private messages: ContextMessage[];
  private files: ContextFile[];
  private autosaveEnabled = true;
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
    this.storagePath = path.join(task.project.baseDir, '.aider-desk', 'tasks', taskId, 'context.json');
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
        logger.debug('Skipping empty assistant message', { taskId: this.taskId });
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
    return isFileIgnored(this.task.project.baseDir, contextFile.path);
  }

  async addContextFile(contextFile: ContextFile): Promise<ContextFile[]> {
    const absolutePath = path.resolve(this.task.project.baseDir, contextFile.path);
    const isDir = await isDirectory(absolutePath);
    const alreadyAdded = this.files.find((file) => path.resolve(this.task.project.baseDir, file.path) === absolutePath);

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
    const absolutePath = path.resolve(this.task.project.baseDir, filePath);
    const droppedFiles: ContextFile[] = [];

    this.files = this.files.filter((f) => {
      const contextFileAbsolutePath = path.resolve(this.task.project.baseDir, f.path);
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

  getContextMessages(): ContextMessage[] {
    return [...this.messages];
  }

  clearMessages(save = true) {
    logger.debug('Clearing task messages', { taskId: this.taskId });
    this.messages = [];
    if (save) {
      this.autosave();
    }
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

  removeLastUserMessage(): string | null {
    let lastUserMessageContent: string | null = null;

    while (this.messages.length > 0) {
      const lastMessage = this.messages.pop();
      if (!lastMessage) {
        break;
      }

      logger.debug(`Task ${this.taskId}: Removing message during user message search: ${lastMessage.role}`);

      if (lastMessage.role === MessageRole.User) {
        lastUserMessageContent = extractTextContent(lastMessage.content);
        logger.debug(`Task ${this.taskId}: Found and removed last user message. Content: ${lastUserMessageContent}`);
        break;
      }
    }

    if (lastUserMessageContent !== null) {
      this.autosave();
    }

    return lastUserMessageContent;
  }

  toConnectorMessages(contextMessages: ContextMessage[] = this.messages): { role: MessageRole; content: string }[] {
    let aiderPrompt = '';
    let subAgentsPrompt = '';

    return contextMessages.flatMap((message) => {
      if (message.role === MessageRole.User || message.role === MessageRole.Assistant) {
        aiderPrompt = '';

        if (message.role === MessageRole.Assistant && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'tool-call') {
              const [serverName, toolName] = extractServerNameToolName(part.toolName);
              // @ts-expect-error part.input contains the prompt in this case
              if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT && part.input && 'prompt' in part.input) {
                aiderPrompt = part.input.prompt as string;
                break;
              }
              // @ts-expect-error part.input contains the prompt in this case
              if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK && part.input && 'prompt' in part.input) {
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
      } else if (message.role === 'tool') {
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
            } else if (part.output?.type === 'json') {
              // @ts-expect-error part.output.responses is expected to be in the output
              const responses: ResponseCompletedData[] = part.output.value.responses;
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
      logger.info(`Task context saved to ${this.storagePath}`, { taskId: this.taskId });
    } catch (error) {
      logger.error('Failed to save task context:', { error, taskId: this.taskId });
      throw error;
    }
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
      if (!(await fileExists(this.storagePath))) {
        logger.debug('No existing task context found:', { taskId: this.taskId });
        return;
      }

      this.disableAutosave();

      const content = await fs.readFile(this.storagePath, 'utf8');
      const contextData = content ? JSON.parse(content) : null;

      if (!contextData) {
        logger.debug('Empty task context found:', { taskId: this.taskId });
        return;
      }

      const migratedData = await this.migrateContext(contextData);

      await this.loadMessages(migratedData.contextMessages || []);
      await this.loadFiles(migratedData.contextFiles || []);

      logger.info(`Task context loaded from ${this.storagePath}`, { taskId: this.taskId });
    } catch (error) {
      logger.error('Failed to load task context:', { error, taskId: this.taskId });
      throw error;
    } finally {
      this.enableAutosave();
    }
  }

  async loadMessages(messages: ContextMessage[]): Promise<void> {
    // Clear all current messages
    await this.task.clearContext(false, false);

    this.messages = messages;

    // Add messages to the UI
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.role === 'assistant') {
        if (Array.isArray(message.content)) {
          // Collect reasoning and text parts to combine them if both exist
          let reasoningContent = '';
          let textContent = '';
          let hasReasoning = false;
          let hasText = false;

          for (const part of message.content) {
            if (part.type === 'reasoning' && part.text?.trim()) {
              reasoningContent += `${part.text.trim()}\n\n`;
              hasReasoning = true;
            } else if (part.type === 'text' && part.text) {
              textContent += `${part.text.trim()}\n\n`;
              hasText = true;
            }
          }

          // Process combined reasoning and text content
          if (hasReasoning || hasText) {
            let finalContent = '';
            if (hasReasoning && hasText) {
              finalContent = `${THINKING_RESPONSE_STAR_TAG}${reasoningContent.trim()}${ANSWER_RESPONSE_START_TAG}${textContent.trim()}`;
            } else {
              finalContent = reasoningContent || textContent;
            }

            this.task.processResponseMessage(
              {
                id: uuidv4(),
                action: 'response',
                content: finalContent.trim(),
                finished: true,
                reflectedMessage: message.reflectedMessage,
                usageReport: message.usageReport,
              },
              false,
            );
          }

          // Process tool-call parts
          for (const part of message.content) {
            if (part.type === 'tool-call') {
              const toolCall = part;
              // Ensure toolCall.toolCallId exists before proceeding
              if (!toolCall.toolCallId) {
                continue;
              }

              const [serverName, toolName] = extractServerNameToolName(toolCall.toolName);
              this.task.addToolMessage(toolCall.toolCallId, serverName, toolName, toolCall.input, undefined, message.usageReport, message.promptContext, false);
            } else if (part.type === 'tool-result') {
              const toolResult = part;
              const [serverName, toolName] = extractServerNameToolName(toolResult.toolName);
              const promptContext = extractPromptContextFromToolResult(toolResult.output.value) ?? message.promptContext;
              this.task.addToolMessage(
                toolResult.toolCallId,
                serverName,
                toolName,
                undefined,
                JSON.stringify(toolResult.output.value),
                message.usageReport,
                promptContext,
                false,
              );
            }
          }
        } else if (isTextContent(message.content)) {
          const content = extractTextContent(message.content);
          if (!content.trim()) {
            continue;
          }

          this.task.processResponseMessage(
            {
              id: uuidv4(),
              action: 'response',
              content: content,
              finished: true,
              usageReport: message.usageReport,
              reflectedMessage: message.reflectedMessage,
            },
            false,
          );
        }
      } else if (message.role === 'user') {
        const content = extractTextContent(message.content);
        this.task.addUserMessage(content);
      } else if (message.role === 'tool') {
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            const [serverName, toolName] = extractServerNameToolName(part.toolName);
            const promptContext = extractPromptContextFromToolResult(part.output.value);
            this.task.addToolMessage(
              part.toolCallId,
              serverName,
              toolName,
              undefined,
              JSON.stringify(part.output.value),
              message.usageReport,
              promptContext,
              false,
            );

            if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT) {
              // @ts-expect-error value is expected to have responses
              const responses = part.output?.value.responses;
              if (Array.isArray(responses)) {
                responses.forEach((response: ResponseCompletedData) => {
                  this.task.sendResponseCompleted({
                    ...response,
                  });
                });
              }
            }

            // Handle agent tool results - process all messages from subagent
            if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK) {
              // @ts-expect-error value is expected to have messages
              const messages = part.output?.value.messages;
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

                        this.task.processResponseMessage(
                          {
                            id: uuidv4(),
                            action: 'response',
                            content: subFinalContent,
                            finished: true,
                            usageReport: subMessage.usageReport,
                            promptContext: subMessage.promptContext,
                          },
                          false,
                        );
                      }

                      // Process tool-call parts
                      for (const subPart of subMessage.content) {
                        if (subPart.type === 'tool-call' && subPart.toolCallId) {
                          const [subServerName, subToolName] = extractServerNameToolName(subPart.toolName);
                          this.task.addToolMessage(
                            subPart.toolCallId,
                            subServerName,
                            subToolName,
                            subPart.input,
                            undefined,
                            undefined,
                            subMessage.promptContext,
                            false,
                          );
                        }
                      }
                    } else if (isTextContent(subMessage.content)) {
                      const content = extractTextContent(subMessage.content);
                      this.task.processResponseMessage(
                        {
                          id: uuidv4(),
                          action: 'response',
                          content: content,
                          finished: true,
                          usageReport: subMessage.usageReport,
                          promptContext: subMessage.promptContext,
                        },
                        false,
                      );
                    }
                  } else if (subMessage.role === 'tool') {
                    for (const subPart of subMessage.content) {
                      if (subPart.type === 'tool-result') {
                        const [subServerName, subToolName] = extractServerNameToolName(subPart.toolName);
                        const promptContext = extractPromptContextFromToolResult(subPart.output.value) ?? subMessage.promptContext;
                        this.task.addToolMessage(
                          subPart.toolCallId,
                          subServerName,
                          subToolName,
                          undefined,
                          JSON.stringify(subPart.output.value),
                          subMessage.usageReport,
                          promptContext,
                          false,
                        );
                      }
                    }
                  }
                });
              }
            }
          }
        }
      }
    }

    // send messages to Connectors (Aider)
    this.toConnectorMessages().forEach((message) => {
      this.task.sendAddMessage(message.role, message.content, false);
    });
  }

  async loadFiles(files: ContextFile[]): Promise<void> {
    // Drop all current files
    for (let i = 0; i < this.files.length; i++) {
      const contextFile = this.files[i];
      this.task.sendDropFile(contextFile.path, contextFile.readOnly, i !== this.files.length - 1);
    }

    this.files = files;
    for (let i = 0; i < this.files.length; i++) {
      const contextFile = this.files[i];
      this.task.sendAddFile(contextFile, i !== this.files.length - 1);
    }
  }

  async delete(): Promise<void> {
    logger.info('Deleting task context:', { taskId: this.taskId });
    try {
      if (await fileExists(this.storagePath)) {
        await fs.unlink(this.storagePath);
        logger.info(`Task context deleted: ${this.storagePath}`, { taskId: this.taskId });
      }
    } catch (error) {
      logger.error('Failed to delete task context:', { error, taskId: this.taskId });
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
}
