import { cloneDeep } from 'lodash';

import type { ModelMessage, TextPart } from 'ai';
import type { CacheControl } from '@/models';

export const applyCacheControl = (messages: ModelMessage[], cacheControl?: CacheControl): ModelMessage[] => {
  const optimizedMessages = cloneDeep(messages);
  const lastMessage = optimizedMessages.at(-1);

  if (cacheControl && lastMessage) {
    const placement = cacheControl.placement ?? 'message';

    if (placement === 'message-part') {
      if (Array.isArray(lastMessage.content) && lastMessage.content.length > 0) {
        const lastContent = lastMessage.content[lastMessage.content.length - 1];
        if (lastContent && typeof lastContent === 'object') {
          (lastContent as TextPart).providerOptions = {
            ...(lastContent as TextPart).providerOptions,
            ...cacheControl.providerOptions,
          };
        }
      }
    } else {
      lastMessage.providerOptions = {
        ...lastMessage.providerOptions,
        ...cacheControl.providerOptions,
      };
    }
  }

  return optimizedMessages;
};
