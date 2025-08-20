import path from 'path';
import { promises as fs } from 'fs';

import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import { ContextFile, ContextMessage, MessageRole, ResponseCompletedData, SessionData, UsageReportData } from '@common/types';
import { extractServerNameToolName, extractTextContent, fileExists, isMessageEmpty, isTextContent } from '@common/utils';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK } from '@common/tools';

import { extractPromptContextFromToolResult, THINKING_RESPONSE_STAR_TAG, ANSWER_RESPONSE_START_TAG } from '@/agent/utils';
import logger from '@/logger';
import { Project } from '@/project';
import { isDirectory, isFileIgnored } from '@/utils';

const AUTOSAVED_SESSION_NAME = '.autosaved';

export class SessionManager {
  private contextMessages: ContextMessage[];
  private contextFiles: ContextFile[];
  private autosaveEnabled = false;

  constructor(
    private readonly project: Project,
    initialMessages: ContextMessage[] = [],
    initialFiles: ContextFile[] = [],
  ) {
    this.contextMessages = initialMessages;
    this.contextFiles = initialFiles;
  }

  public enableAutosave() {
    this.autosaveEnabled = true;
  }

  public disableAutosave() {
    this.autosaveEnabled = false;
  }

  addContextMessage(role: MessageRole, content: string, usageReport?: UsageReportData): void;
  addContextMessage(message: ContextMessage): void;
  addContextMessage(roleOrMessage: MessageRole | ContextMessage, content?: string, usageReport?: UsageReportData) {
    let message: ContextMessage;

    if (typeof roleOrMessage === 'string') {
      if (!content) {
        // No content provided, do not add the message
        return;
      }

      message = {
        role: roleOrMessage,
        content: content || '',
        usageReport,
      } as ContextMessage;
    } else {
      message = roleOrMessage;

      if (roleOrMessage.role === 'assistant' && isMessageEmpty(message.content)) {
        logger.debug('Skipping empty assistant message');
        // Skip adding empty assistant messages
        return;
      }
    }

    this.contextMessages.push(message);
    logger.debug(`Session: Added ${message.role} message. Total messages: ${this.contextMessages.length}`);
    this.saveAsAutosaved();
  }

  private async isFileIgnored(contextFile: ContextFile): Promise<boolean> {
    if (contextFile.readOnly) {
      // not checking gitignore for read-only files
      return false;
    }

    return isFileIgnored(this.project.baseDir, contextFile.path);
  }

  async addContextFile(contextFile: ContextFile): Promise<ContextFile[]> {
    const absolutePath = path.resolve(this.project.baseDir, contextFile.path);
    const isDir = await isDirectory(absolutePath);
    const alreadyAdded = this.contextFiles.find((file) => path.resolve(this.project.baseDir, file.path) === absolutePath);
    if (alreadyAdded) {
      return [];
    }

    // For directories, recursively add all files and subdirectories
    if (isDir) {
      logger.debug('Recursively adding files in directory to context:', {
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

          // Recursively add files and directories
          const newAddedFiles = await this.addContextFile(entryContextFile);
          addedFiles.push(...newAddedFiles);
        }
      } catch (error) {
        logger.error('Failed to read directory:', {
          path: contextFile.path,
          error,
        });
      }

      return addedFiles;
    } else {
      // For files, check if ignored and add if not
      if (await this.isFileIgnored(contextFile)) {
        logger.debug('Skipping ignored file:', { path: contextFile.path });
        return [];
      }

      const newContextFile = {
        ...contextFile,
        readOnly: contextFile.readOnly ?? false,
      };
      this.contextFiles.push(newContextFile);
      this.saveAsAutosaved();
      return [newContextFile];
    }
  }

  dropContextFile(filePath: string): ContextFile[] {
    const absolutePath = path.resolve(this.project.baseDir, filePath);
    const droppedFiles: ContextFile[] = [];

    // Filter out files that match the path or are within the directory path
    this.contextFiles = this.contextFiles.filter((f) => {
      const contextFileAbsolutePath = path.resolve(this.project.baseDir, f.path);

      // Check if file matches exactly or is within the directory path
      const isMatch =
        f.path === filePath || // Exact match
        contextFileAbsolutePath === absolutePath || // Absolute path matches
        !path.relative(absolutePath, contextFileAbsolutePath).startsWith('..'); // File is within the directory

      if (isMatch) {
        droppedFiles.push(f);
        return false; // Remove from contextFiles
      }

      return true; // Keep in contextFiles
    });

    if (droppedFiles.length > 0) {
      this.saveAsAutosaved();
    }

    return droppedFiles;
  }

  setContextFiles(contextFiles: ContextFile[], save = true) {
    this.contextFiles = contextFiles;
    if (save) {
      this.saveAsAutosaved();
    }
  }

  getContextFiles(): ContextFile[] {
    return [...this.contextFiles];
  }

  setContextMessages(contextMessages: ContextMessage[], save = true) {
    this.contextMessages = contextMessages;
    if (save) {
      this.saveAsAutosaved();
    }
  }

  getContextMessages(): ContextMessage[] {
    return [...this.contextMessages];
  }

  clearMessages(save = true) {
    this.contextMessages = [];
    if (save) {
      this.saveAsAutosaved();
    }
  }

  removeLastMessage(): void {
    if (this.contextMessages.length === 0) {
      logger.warn('Attempted to remove last message, but message list is empty.');
      return;
    }

    const lastMessage = this.contextMessages[this.contextMessages.length - 1];

    if (lastMessage.role === 'tool' && Array.isArray(lastMessage.content) && lastMessage.content.length > 0 && lastMessage.content[0].type === 'tool-result') {
      const toolMessage = this.contextMessages.pop() as ContextMessage & {
        role: 'tool';
      }; // Remove the tool message
      const toolCallIdToRemove = toolMessage.content[0].toolCallId;
      logger.debug(`Session: Removed last tool message (ID: ${toolCallIdToRemove}). Total messages: ${this.contextMessages.length}`);

      // Iterate backward to find the corresponding assistant message
      for (let i = this.contextMessages.length - 1; i >= 0; i--) {
        const potentialAssistantMessage = this.contextMessages[i];

        if (potentialAssistantMessage.role === 'assistant' && Array.isArray(potentialAssistantMessage.content)) {
          const toolCallIndex = potentialAssistantMessage.content.findIndex((part) => part.type === 'tool-call' && part.toolCallId === toolCallIdToRemove);

          if (toolCallIndex !== -1) {
            // Remove the specific tool-call part
            potentialAssistantMessage.content.splice(toolCallIndex, 1);
            logger.debug(`Session: Removed tool-call part (ID: ${toolCallIdToRemove}) from assistant message at index ${i}.`);

            // Check if the assistant message is now empty or only contains empty text parts
            const isEmpty = potentialAssistantMessage.content.length === 0;

            if (isEmpty) {
              this.contextMessages.splice(i, 1); // Remove the now empty assistant message
              logger.debug(`Session: Removed empty assistant message at index ${i} after removing tool-call. Total messages: ${this.contextMessages.length}`);
            }
            // Found and processed the corresponding assistant message, stop searching
            break;
          }
        }
      }
    } else {
      // If the last message is not a tool message, just remove it
      this.contextMessages.pop();
      logger.debug(`Session: Removed last non-tool message. Total messages: ${this.contextMessages.length}`);
    }

    this.saveAsAutosaved();
  }

  removeLastUserMessage(): string | null {
    let lastUserMessageContent: string | null = null;

    while (this.contextMessages.length > 0) {
      const lastMessage = this.contextMessages.pop();
      if (!lastMessage) {
        // Should not happen, but safety check
        break;
      }

      logger.debug(`Session: Removing message during user message search: ${lastMessage.role}`);

      if (lastMessage.role === MessageRole.User) {
        lastUserMessageContent = extractTextContent(lastMessage.content);
        logger.debug(`Session: Found and removed last user message. Content: ${lastUserMessageContent}. Total messages: ${this.contextMessages.length}`);
        break; // Found the user message, stop removing
      }
    }

    if (lastUserMessageContent !== null) {
      // Save only if messages were removed or a user message was found
      this.saveAsAutosaved();
    }

    return lastUserMessageContent;
  }

  toConnectorMessages(contextMessages: ContextMessage[] = this.contextMessages): { role: MessageRole; content: string }[] {
    let aiderPrompt = '';
    let subAgentsPrompt = '';

    return contextMessages.flatMap((message) => {
      if (message.role === MessageRole.User || message.role === MessageRole.Assistant) {
        aiderPrompt = '';

        // Check for aider run_prompt tool call in assistant messages to extract the original prompt
        if (message.role === MessageRole.Assistant && Array.isArray(message.content)) {
          for (const part of message.content) {
            if (part.type === 'tool-call') {
              const [serverName, toolName] = extractServerNameToolName(part.toolName);
              // @ts-expect-error part.args contains the prompt in this case
              if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT && part.args && 'prompt' in part.args) {
                aiderPrompt = part.args.prompt as string;
                // Found the prompt, no need to check other parts of this message
                break;
              }
              // @ts-expect-error part.args contains the prompt in this case
              if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK && part.args && 'prompt' in part.args) {
                subAgentsPrompt = part.args.prompt as string;
                // Found the prompt, no need to check other parts of this message
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

            if (typeof part.result === 'string' && part.result) {
              // old format
              messages.push({
                role: MessageRole.Assistant,
                content: part.result as string,
              });
            } else {
              // @ts-expect-error part.result.responses is expected to be in the result
              const responses = part.result?.responses;
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

            // Extract the last assistant message from the result
            if (Array.isArray(part.result) && part.result.length > 0) {
              const lastMessage = part.result[part.result.length - 1];
              if (lastMessage && lastMessage.role === MessageRole.Assistant) {
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
                content: `I called tool ${part.toolName} and got result:\n${JSON.stringify(part.result)}`,
              },
            ];
          }
        });
      } else {
        return [];
      }
    }) as { role: MessageRole; content: string }[];
  }

  async save(name: string) {
    try {
      const sessionsDir = path.join(this.project.baseDir, '.aider-desk', 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      const sessionPath = path.join(sessionsDir, `${name}.json`);

      const sessionData = {
        contextMessages: this.contextMessages,
        contextFiles: this.contextFiles,
      };

      await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');

      logger.info(`Session saved to ${sessionPath}`);
    } catch (error) {
      logger.error('Failed to save session:', { error });
      throw error;
    }
  }

  async loadMessages(contextMessages: ContextMessage[]): Promise<void> {
    // Clear all current messages
    this.project.clearContext(false, false);

    this.contextMessages = contextMessages;

    // Add messages to the UI
    for (let i = 0; i < this.contextMessages.length; i++) {
      const message = this.contextMessages[i];
      if (message.role === 'assistant') {
        if (Array.isArray(message.content)) {
          // Collect reasoning and text parts to combine them if both exist
          let reasoningContent = '';
          let textContent = '';
          let hasReasoning = false;
          let hasText = false;

          for (const part of message.content) {
            if (part.type === 'reasoning' && part.text?.trim()) {
              reasoningContent = part.text.trim();
              hasReasoning = true;
            } else if (part.type === 'text' && part.text) {
              textContent = part.text.trim();
              hasText = true;
            }
          }

          // Process combined reasoning and text content
          if (hasReasoning || hasText) {
            let finalContent = '';
            if (hasReasoning && hasText) {
              finalContent = `${THINKING_RESPONSE_STAR_TAG}${reasoningContent}${ANSWER_RESPONSE_START_TAG}${textContent}`;
            } else {
              finalContent = reasoningContent || textContent;
            }

            this.project.processResponseMessage(
              {
                id: uuidv4(),
                action: 'response',
                content: finalContent,
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
              this.project.addToolMessage(
                toolCall.toolCallId,
                serverName,
                toolName,
                toolCall.args as Record<string, unknown>,
                undefined,
                message.usageReport,
                message.promptContext,
                false,
              );
            }
          }
        } else if (isTextContent(message.content)) {
          const content = extractTextContent(message.content);
          if (!content.trim()) {
            continue;
          }

          this.project.processResponseMessage(
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
        this.project.addUserMessage(content);
      } else if (message.role === 'tool') {
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            const [serverName, toolName] = extractServerNameToolName(part.toolName);
            const promptContext = extractPromptContextFromToolResult(part.result);
            this.project.addToolMessage(
              part.toolCallId,
              serverName,
              toolName,
              undefined,
              JSON.stringify(part.result),
              message.usageReport,
              promptContext,
              false,
            );

            if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT) {
              // @ts-expect-error part.result.responses is expected to be in the result
              const responses = part.result?.responses;
              if (responses) {
                responses.forEach((response: ResponseCompletedData) => {
                  this.project.sendResponseCompleted({
                    ...response,
                  });
                });
              }
            }

            // Handle agent tool results - process all messages from subagent
            if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK) {
              // @ts-expect-error part.result.messages is expected to be in the result
              const messages = part.result?.messages ?? part.result;
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

                        this.project.processResponseMessage(
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
                          this.project.addToolMessage(
                            subPart.toolCallId,
                            subServerName,
                            subToolName,
                            subPart.args as Record<string, unknown>,
                            undefined,
                            undefined,
                            subMessage.promptContext,
                            false,
                          );
                        }
                      }
                    } else if (isTextContent(subMessage.content)) {
                      const content = extractTextContent(subMessage.content);
                      this.project.processResponseMessage(
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
                        const promptContext = extractPromptContextFromToolResult(subPart.result) ?? subMessage.promptContext;
                        this.project.addToolMessage(
                          subPart.toolCallId,
                          subServerName,
                          subToolName,
                          undefined,
                          JSON.stringify(subPart.result),
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
      this.project.sendAddMessage(message.role, message.content, false);
    });
  }

  async loadFiles(contextFiles: ContextFile[]): Promise<void> {
    // Drop all current files
    for (let i = 0; i < this.contextFiles.length; i++) {
      const contextFile = this.contextFiles[i];
      this.project.sendDropFile(contextFile.path, contextFile.readOnly, i !== this.contextFiles.length - 1);
    }

    this.contextFiles = contextFiles;
    for (let i = 0; i < this.contextFiles.length; i++) {
      const contextFile = this.contextFiles[i];
      this.project.sendAddFile(contextFile, i !== this.contextFiles.length - 1);
    }
  }

  async load(name: string): Promise<void> {
    try {
      const sessionData = await this.findSession(name);

      if (!sessionData) {
        logger.debug('No session found to load:', { name });
        return;
      }

      await this.loadMessages(sessionData.contextMessages || []);
      await this.loadFiles(sessionData.contextFiles || []);

      logger.info(`Session loaded from ${name}`);
    } catch (error) {
      logger.error('Failed to load session:', { error });
      throw error;
    }
  }

  private debouncedSaveAsAutosaved = debounce(async () => {
    logger.info('Saving session as autosaved', {
      projectDir: this.project.baseDir,
      messages: this.contextMessages.length,
      files: this.contextFiles.length,
    });
    await this.save('.autosaved');
  }, 1000);

  private saveAsAutosaved() {
    logger.debug('Saving autosaved session', {
      projectDir: this.project.baseDir,
      messages: this.contextMessages.length,
      files: this.contextFiles.length,
      enabled: this.autosaveEnabled,
    });

    if (this.autosaveEnabled) {
      void this.debouncedSaveAsAutosaved();
    }
  }

  async loadAutosaved(): Promise<void> {
    try {
      await this.load('.autosaved');
    } catch (error) {
      logger.error('Failed to load autosaved session:', { error });
      throw error;
    }
  }

  async getAllSessions(): Promise<SessionData[]> {
    try {
      const sessionsDir = path.join(this.project.baseDir, '.aider-desk', 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      const files = await fs.readdir(sessionsDir);
      const sessions: SessionData[] = [];

      for (const file of files.filter((file) => file.endsWith('.json'))) {
        const sessionName = file.replace('.json', '');

        if (sessionName === AUTOSAVED_SESSION_NAME) {
          continue;
        }

        try {
          const sessionData = await this.findSession(sessionName);
          if (sessionData) {
            sessions.push({
              name: sessionName,
              messages: sessionData.contextMessages?.length || 0,
              files: sessionData.contextFiles?.length || 0,
            });
          }
        } catch (error) {
          logger.error('Failed to read session file:', { file, error });
        }
      }

      return sessions;
    } catch (error) {
      logger.error('Failed to list sessions:', { error });
      return [];
    }
  }

  async findSession(name: string): Promise<
    | (SessionData & {
        contextMessages?: ContextMessage[];
        contextFiles?: ContextFile[];
      })
    | null
  > {
    try {
      const sessionPath = path.join(this.project.baseDir, '.aider-desk', 'sessions', `${name}.json`);

      if (!(await fileExists(sessionPath))) {
        return null;
      }

      const content = await fs.readFile(sessionPath, 'utf8');
      const sessionData = content ? JSON.parse(content) : null;

      if (sessionData && sessionData.contextMessages) {
        // Migrate old format messages to new format if needed
        sessionData.contextMessages = sessionData.contextMessages.map((message: ContextMessage & Record<string, unknown>) => {
          // If message doesn't have usageReport property, it's old format
          if (message.usageReport === undefined) {
            return {
              ...message,
              usageReport: undefined,
            } as ContextMessage;
          }
          return message as ContextMessage;
        });
      }

      return sessionData;
    } catch (error) {
      logger.error('Failed to get session data:', { name, error });
      return null;
    }
  }

  async generateSessionMarkdown(): Promise<string | null> {
    let markdown = '';

    for (const message of this.contextMessages) {
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
              markdown += `**Result:**\n\`\`\`json\n${JSON.stringify(part.result, null, 2)}\n\`\`\`\n\n`;
            }
          }
        }
      }
    }

    return markdown;
  }

  async delete(name: string): Promise<void> {
    logger.info('Deleting session:', { name });
    try {
      const sessionPath = path.join(this.project.baseDir, '.aider-desk', 'sessions', `${name}.json`);
      await fs.unlink(sessionPath);
      logger.info(`Session deleted: ${sessionPath}`);
    } catch (error) {
      logger.error('Failed to delete session:', { error });
      throw error;
    }
  }
}
