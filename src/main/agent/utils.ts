import { PromptContext } from '@common/types';

export const THINKING_RESPONSE_STAR_TAG = '---\n► **THINKING**\n';
export const ANSWER_RESPONSE_START_TAG = '---\n► **ANSWER**\n';

/**
 * Extracts PromptContext from a tool result if available.
 * @param toolResult - The tool result object to extract PromptContext from
 * @returns PromptContext if found, undefined otherwise
 */
export const extractPromptContextFromToolResult = (toolResult: unknown): PromptContext | undefined => {
  if (toolResult && typeof toolResult === 'object' && 'promptContext' in toolResult) {
    return toolResult.promptContext as PromptContext;
  }

  return undefined;
};
