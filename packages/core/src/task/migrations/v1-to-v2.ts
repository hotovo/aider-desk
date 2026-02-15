import { ContextMessage, TaskContext } from '@aider-desk/common/types';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK } from '@aider-desk/common/tools';
import { extractServerNameToolName } from '@aider-desk/common/utils';

import logger from '@/logger';

/**
 * Migrates a single ContextMessage from V1 (AI SDK v4) to V2 (AI SDK v5) format.
 * This function is reusable and can handle recursive migration for subagent messages.
 */
const migrateContextMessage = (message: ContextMessage): ContextMessage => {
  // If content is already an array, it might be V1 format that needs migration or already V2 format
  if (Array.isArray(message.content)) {
    let needsMigration = false;

    // Check if this is V1 format by looking for 'args' or 'result' properties
    for (const part of message.content) {
      if ((part.type === 'tool-call' && 'args' in part) || (part.type === 'tool-result' && 'result' in part)) {
        needsMigration = true;
        break;
      }
    }

    if (!needsMigration) {
      return message;
    }

    // Migrate V1 format to V2
    const migratedContent = message.content.map((part) => {
      if (part.type === 'tool-call' && 'args' in part) {
        // V1 tool-call: change 'args' to 'input'
        return {
          ...part,
          input: (part as { args: unknown }).args,
          args: undefined, // Remove old property
        };
      } else if (part.type === 'tool-result' && 'result' in part) {
        // V1 tool-result: change 'result' to 'output' with proper typing
        const result = (part as { result: unknown }).result;
        let output: { type: 'text' | 'json'; value: unknown };

        if (typeof result === 'string') {
          output = {
            type: 'text',
            value: result,
          };
        } else {
          output = {
            type: 'json',
            value: result,
          };
        }

        const [serverName, toolName] = extractServerNameToolName(part.toolName);

        // Check if this is a subagent tool result with messages that need migration
        if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK) {
          // @ts-expect-error value is expected to have messages
          const messages = output.value?.messages;
          if (Array.isArray(messages)) {
            // Recursively migrate each message in the subagent result
            const migratedMessages = messages.map(migrateContextMessage);

            output = {
              ...output,
              value: {
                ...(output.value as object),
                messages: migratedMessages,
              },
            };
          }
        } else if (serverName === AIDER_TOOL_GROUP_NAME && toolName === AIDER_TOOL_RUN_PROMPT) {
          // @ts-expect-error value is expected to have responses
          const responses = output.value?.responses;
          if (Array.isArray(responses)) {
            // Recursively migrate each response message
            const migratedResponses = responses.map(migrateContextMessage);

            output = {
              ...output,
              value: {
                ...(output.value as object),
                responses: migratedResponses,
              },
            };
          }
        }

        return {
          ...part,
          output,
          result: undefined, // Remove old property
        };
      }

      // Leave other parts (text, reasoning, etc.) unchanged
      return part;
    });

    return {
      ...message,
      content: migratedContent,
    };
  }

  // Return the message as is if it doesn't match migration conditions
  return message;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const migrateContextV1toV2 = (taskId: string, sessionData: any): TaskContext => {
  logger.info('Migrating context from V1 (AI SDK v4) to V2 (AI SDK v5)');

  if (!sessionData.contextMessages) {
    return sessionData;
  }

  const migratedContextMessages = sessionData.contextMessages.map((message: ContextMessage): ContextMessage => {
    return migrateContextMessage(message);
  });

  return {
    ...sessionData,
    taskId,
    contextMessages: migratedContextMessages,
  } satisfies TaskContext;
};
