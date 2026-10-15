import { cloneDeep } from 'lodash';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { getSubagentFinalText } from './tool-results';

import type { ModelMessage } from 'ai';

export const transformMessages = (messages: ModelMessage[]): ModelMessage[] => {
  const transformedMessages = cloneDeep(messages);
  for (const message of transformedMessages) {
    if (message.role !== 'tool') {
      continue;
    }
    for (const part of message.content) {
      if (part.type !== 'tool-result' || part.output.type !== 'json') {
        continue;
      }
      if (part.toolName === `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`) {
        const result = part.output.value;
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          part.output = {
            ...part.output,
            value: Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'responses' && key !== 'promptContext')),
          };
        }
      } else if (part.toolName === `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`) {
        const text = getSubagentFinalText(part.output.value);
        if (text !== undefined) {
          part.output = { type: 'text', value: text };
        }
      }
    }
  }
  return transformedMessages;
};
