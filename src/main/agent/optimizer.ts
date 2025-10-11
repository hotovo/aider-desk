import { type AgentProfile, InvocationMode, type SettingsData } from '@common/types';
import { isSubagentEnabled } from '@common/agent';
import { cloneDeep } from 'lodash';
import { type ModelMessage, type ToolContent, type ToolResultPart, type UserModelMessage } from 'ai';
import {
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
import { extractTextContent } from '@common/utils';

import logger from '@/logger';
import { CacheControl } from '@/models';

/**
 * Optimizes the messages before sending them to the LLM. This should reduce the token count and improve the performance.
 */
export const optimizeMessages = (
  profile: AgentProfile,
  userRequestMessageIndex: number,
  messages: ModelMessage[],
  cacheControl: CacheControl,
  settings: SettingsData,
) => {
  if (messages.length === 0) {
    return [];
  }

  let optimizedMessages = cloneDeep(messages);

  optimizedMessages = addImportantReminders(profile, userRequestMessageIndex, optimizedMessages, settings);
  optimizedMessages = convertImageToolResults(optimizedMessages);
  optimizedMessages = removeDoubleToolCalls(optimizedMessages);
  optimizedMessages = optimizeAiderMessages(optimizedMessages);
  optimizedMessages = optimizeSubagentMessages(optimizedMessages);

  logger.debug('Optimized messages:', {
    before: {
      count: messages.length,
      roles: messages.map((m) => m.role),
    },
    after: {
      count: optimizedMessages.length,
      roles: optimizedMessages.map((message) => message.role),
    },
  });

  const lastMessage = optimizedMessages[messages.length - 1];

  if (cacheControl) {
    lastMessage.providerOptions = {
      ...lastMessage.providerOptions,
      ...cacheControl,
    };
  }

  return optimizedMessages;
};

const addImportantReminders = (profile: AgentProfile, userRequestMessageIndex: number, messages: ModelMessage[], settings: SettingsData): ModelMessage[] => {
  const userRequestMessage = messages[userRequestMessageIndex] as UserModelMessage;
  const reminders: string[] = [];

  if (profile.useTodoTools) {
    reminders.push(
      `Always use the TODO list tools to manage the tasks, even if small ones. Before any analyze use ${TODO_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TODO_TOOL_GET_ITEMS} to check the current list of tasks and in case it's related to the current request, resume the existing tasks.`,
    );
  }

  // Add reminder about automatic subagents
  if (profile.useSubagents && settings.agentProfiles) {
    const enabledSubagents = settings.agentProfiles.filter((agentProfile) => isSubagentEnabled(agentProfile, profile.id));
    const automaticSubagents = enabledSubagents.filter(
      (agentProfile) => agentProfile.subagent.invocationMode === InvocationMode.Automatic && agentProfile.subagent.description,
    );

    if (automaticSubagents.length > 0) {
      const subagents = automaticSubagents.map((subagent) => `- ${subagent.name}`).join('\n');
      reminders.push(`Use the following automatic subagents when appropriate based on their descriptions:\n${subagents}`);
    }
  }

  if (!profile.autoApprove && !profile.isSubagent) {
    reminders.push('Before making any complex changes, present the plan and wait for my approval.');
  }

  if (reminders.length === 0) {
    return messages;
  }

  const importantReminders = `\n\nTHIS IS IMPORTANT:\n- ${reminders.join('\n- ')}`;

  const updatedFirstUserMessage = {
    ...userRequestMessage,
    content: `${userRequestMessage.content}${importantReminders}`,
  } satisfies UserModelMessage;

  const newMessages = [...messages];
  newMessages[userRequestMessageIndex] = updatedFirstUserMessage;

  return newMessages;
};

/**
 * For run_prompt tool, which returns `responses` array, we should replace this array with empty array.
 */
const optimizeAiderMessages = (messages: ModelMessage[]): ModelMessage[] => {
  const newMessages = cloneDeep(messages);

  for (const message of newMessages) {
    if (message.role === 'tool') {
      const toolContent = message.content as ToolContent;

      for (const toolResultPart of toolContent) {
        if (
          toolResultPart.toolName === `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}` &&
          toolResultPart.output.type === 'json'
        ) {
          try {
            const result = toolResultPart.output.value;
            // @ts-expect-error result is expected to have responses
            delete result.responses;
            // @ts-expect-error result is expected to have promptContext
            delete result.promptContext;
          } catch {
            // ignore
          }
        }
      }
    }
  }
  return newMessages;
};

/**
 * For subagent tool, which now returns an array of messages, we should replace this array with only the last message for LLM processing.
 */
const optimizeSubagentMessages = (messages: ModelMessage[]): ModelMessage[] => {
  const newMessages = cloneDeep(messages);

  for (const message of newMessages) {
    if (message.role === 'tool') {
      const toolContent = message.content as ToolContent;

      for (const toolResultPart of toolContent) {
        if (
          toolResultPart.toolName === `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}` &&
          toolResultPart.output.type === 'json'
        ) {
          try {
            const result = toolResultPart.output.value;
            // @ts-expect-error result is expected to have messages
            const lastMessage = result.messages[result.messages.length - 1];
            toolResultPart.output = {
              type: 'text',
              value: extractTextContent(lastMessage.content),
            };
          } catch {
            // ignore
          }
        }
      }
    }
  }
  return newMessages;
};

/**
 * Converts tool results containing images into a separate user message containing the image.
 */
const convertImageToolResults = (messages: ModelMessage[]): ModelMessage[] => {
  const newMessages: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      const toolContent = message.content as ToolContent;
      const updatedToolContent: ToolResultPart[] = [];
      const userMessagesToAdd: UserModelMessage[] = [];

      for (const toolResultPart of toolContent) {
        try {
          const resultString = toolResultPart.output.type === 'text' ? toolResultPart.output.value : JSON.stringify(toolResultPart.output.value);
          const parsedResult = JSON.parse(resultString);

          if (
            parsedResult &&
            Array.isArray(parsedResult.content) &&
            parsedResult.content.length === 1 &&
            parsedResult.content[0].type === 'image' &&
            (parsedResult.content[0].data || parsedResult.content[0].image) &&
            parsedResult.content[0].mimeType?.startsWith('image/')
          ) {
            updatedToolContent.push({
              ...toolResultPart,
              output: {
                type: 'text',
                value: 'Image rendered.',
              },
            });
            userMessagesToAdd.push({
              role: 'user',
              content: [
                {
                  type: 'image',
                  image: parsedResult.content[0].data || parsedResult.content[0].image,
                  mediaType: parsedResult.content[0].mimeType,
                },
              ],
            } satisfies UserModelMessage);
          } else {
            updatedToolContent.push(toolResultPart);
          }
        } catch {
          // If result is not valid JSON, or doesn't match the image format,
          // just keep the original toolResultPart as is.
          updatedToolContent.push(toolResultPart);
        }
      }

      // Push the modified tool message
      newMessages.push({
        ...message,
        content: updatedToolContent,
      });

      // Push the user message if it was created
      for (const userMessage of userMessagesToAdd) {
        logger.info('Adding user message for image tool result', {
          toolCallId: toolContent[0].toolCallId,
        });
        newMessages.push(userMessage);
      }
    } else {
      // For non-tool messages, just push them as is
      newMessages.push(message);
    }
  }

  return newMessages;
};

/**
 * Some models (Gemini Flash) are trying to call the same tool multiple times in a row.
 * This function detects this pattern (assistant tool call -> tool result -> same assistant tool call)
 * and modifies the result of the second tool call to return an error, preventing a loop.
 */
const removeDoubleToolCalls = (messages: ModelMessage[]): ModelMessage[] => {
  // Need at least 4 messages for the pattern: assistant, tool, assistant, tool
  if (messages.length < 4) {
    return messages;
  }

  const newMessages = [...messages]; // Create a mutable copy

  // Iterate up to the point where the pattern can start
  for (let i = 0; i <= newMessages.length - 4; i++) {
    const firstMsg = newMessages[i];
    const secondMsg = newMessages[i + 1];
    const thirdMsg = newMessages[i + 2];
    const fourthMsg = newMessages[i + 3];

    // Check for the pattern: assistant(call) -> tool(result) -> assistant(call) -> tool(result)
    if (firstMsg.role === 'assistant' && secondMsg.role === 'tool' && thirdMsg.role === 'assistant' && fourthMsg.role === 'tool') {
      const firstToolCallPart = Array.isArray(firstMsg.content) ? firstMsg.content.find((p) => p.type === 'tool-call') : null;
      const thirdToolCallPart = Array.isArray(thirdMsg.content) ? thirdMsg.content.find((p) => p.type === 'tool-call') : null;

      // Ensure both assistant messages contain tool calls
      if (firstToolCallPart && thirdToolCallPart) {
        // Compare the tool calls
        if (firstToolCallPart.toolName === thirdToolCallPart.toolName && JSON.stringify(firstToolCallPart.input) === JSON.stringify(thirdToolCallPart.input)) {
          logger.info('Found duplicate sequential tool call. Modifying subsequent tool result.', {
            toolName: thirdToolCallPart.toolName,
            input: thirdToolCallPart.input,
          });

          // This is a duplicate call. Modify the fourth message (the result of the duplicate call).
          const originalToolContent = fourthMsg.content;

          const modifiedContent: ToolContent = originalToolContent.map((part) => {
            // Match the tool result part to the duplicate tool call id
            if (part.toolCallId === thirdToolCallPart.toolCallId) {
              return {
                ...part,
                output: {
                  type: 'text',
                  value:
                    'Error: Duplicate tool call detected. Do not call the same tool with the same arguments twice in a row. The previous result is still valid.',
                },
              };
            }
            return part;
          });

          // Replace the old tool message with the modified one
          newMessages[i + 3] = {
            ...fourthMsg,
            content: modifiedContent,
          };

          // To prevent overlapping checks and unnecessary work, we can advance the index.
          // Since we've processed a block of 4, we can safely jump ahead.
          i += 3;
        }
      }
    }
  }

  return newMessages;
};
