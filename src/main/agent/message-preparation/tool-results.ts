import { extractTextContent } from '@common/utils';

import type { ContextMessage } from '@common/types';

export const getSubagentMessages = (value: unknown): ContextMessage[] | undefined => {
  const messages = Array.isArray(value) ? value : value && typeof value === 'object' && 'messages' in value ? value.messages : undefined;
  if (!Array.isArray(messages)) {
    return undefined;
  }
  if (!messages.every((message) => message && typeof message === 'object' && 'role' in message && 'content' in message)) {
    return undefined;
  }
  return messages as ContextMessage[];
};

export const getSubagentFinalText = (value: unknown): string | undefined => {
  const messages = getSubagentMessages(value);
  if (!messages) {
    return undefined;
  }
  const lastMessage = messages.at(-1);
  return lastMessage ? extractTextContent(lastMessage.content) : '';
};
