import { convertMcpResultToModelOutput } from '../utils';

import type { ModelMessage, ToolContent, ToolResultPart } from 'ai';

import logger from '@/logger';

const hasFileOutput = (output: ToolResultPart['output']): boolean => {
  if (output.type === 'content') {
    return output.value.some((part) => part.type === 'file');
  }
  if (output.type !== 'json' && output.type !== 'text') {
    return false;
  }
  try {
    const value: unknown = output.type === 'text' ? JSON.parse(output.value) : output.value;
    const converted = convertMcpResultToModelOutput(value);
    return converted.type === 'content' && converted.value.some((part) => part.type === 'file');
  } catch {
    return false;
  }
};

/**
 * Some models (Gemini Flash) are trying to call the same tool multiple times in a row.
 * This function detects this pattern (assistant tool call -> tool result -> same assistant tool call)
 * and modifies the result of the second tool call to return an error, preventing a loop.
 */
export const optimizeMessages = (messages: ModelMessage[]): ModelMessage[] => {
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
          const duplicateResult = fourthMsg.content.find((part) => part.type === 'tool-result' && part.toolCallId === thirdToolCallPart.toolCallId);
          if (duplicateResult?.type === 'tool-result' && hasFileOutput(duplicateResult.output)) {
            continue;
          }

          logger.info('Found duplicate sequential tool call. Modifying subsequent tool result.', {
            toolName: thirdToolCallPart.toolName,
            input: thirdToolCallPart.input,
          });

          // This is a duplicate call. Modify the fourth message (the result of the duplicate call).
          const originalToolContent = fourthMsg.content;

          const modifiedContent: ToolContent = originalToolContent.map((part) => {
            // Match the tool result part to the duplicate tool call id
            if ((part as ToolResultPart).toolCallId === thirdToolCallPart.toolCallId) {
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
