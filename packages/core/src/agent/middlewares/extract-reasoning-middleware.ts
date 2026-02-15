import type { LanguageModelV2StreamPart, LanguageModelV2Middleware } from '@ai-sdk/provider';

import logger from '@/logger';

/**
 * Extract an XML-tagged reasoning section from the generated text and exposes it
 * as a `reasoning` property on the result.
 *
 * @param tagName - The name of the XML tag to extract reasoning from.
 * @param separator - The separator to use between reasoning and text sections.
 */
export const extractReasoningMiddleware = function extractReasoningMiddleware({
  tagName,
  separator = '\n',
}: {
  tagName: string;
  separator?: string;
  startWithReasoning?: boolean;
}): LanguageModelV2Middleware {
  const openingTag = `<${tagName}>`;
  const closingTag = `</${tagName}>`;

  return {
    middlewareVersion: 'v2',

    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();

      let isFirstReasoning = true;
      let isFirstText = true;
      let afterSwitch = false;
      let isReasoning = false;
      let reasoningDone = false;
      let fullText = '';
      let reasoningText = '';
      let buffer = '';
      let lastId: string | undefined;

      return {
        stream: stream.pipeThrough(
          new TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart>({
            transform: (chunk, controller) => {
              if (chunk.type !== 'text-delta') {
                if (lastId && chunk.type === 'text-end' && fullText.trim() && fullText.trim().length < openingTag.length) {
                  controller.enqueue({
                    id: lastId,
                    type: 'text-delta',
                    delta: fullText,
                  });
                  fullText = '';
                }

                controller.enqueue(chunk);
                return;
              }

              lastId = chunk.id;
              buffer += chunk.delta;
              fullText += chunk.delta;
              if (isReasoning) {
                reasoningText += chunk.delta;
              }

              const publish = function publish(text: string) {
                if (text.length > 0) {
                  const prefix = afterSwitch && (isReasoning ? !isFirstReasoning : !isFirstText) ? separator : '';

                  controller.enqueue({
                    ...chunk,
                    type: isReasoning ? 'reasoning-delta' : 'text-delta',
                    delta: prefix + text,
                  });
                  afterSwitch = false;

                  if (isReasoning) {
                    isFirstReasoning = false;
                  } else {
                    isFirstText = false;
                  }
                }
              };

              if (reasoningDone) {
                publish(buffer);
                buffer = '';
                return;
              }

              if (fullText.length < openingTag.length) {
                return;
              }
              if (!isReasoning && buffer.startsWith(openingTag)) {
                isReasoning = true;
                publish(buffer.slice(openingTag.length));
                reasoningText += buffer;
                buffer = '';
                return;
              }

              if (isReasoning) {
                const lastStartIndex = getPotentialStartIndex(reasoningText, closingTag);
                if (lastStartIndex !== null) {
                  if (reasoningText.slice(lastStartIndex).length < closingTag.length + 1) {
                    // check for additional character at the end, e.g. `
                    // if not found, continue with the next chunk
                    return;
                  }

                  if (reasoningText[lastStartIndex - 1] === '`' && reasoningText[lastStartIndex + closingTag.length] === '`') {
                    // if there is a backtick before the closing tag and after, publish the buffer, as this is not ending
                    publish(buffer);
                    buffer = '';
                    return;
                  }

                  const index = buffer.indexOf(closingTag);
                  if (index === -1) {
                    // this should not happen
                    logger.warn('No closing tag found in buffer although it was found in reasoningText');
                    return;
                  }
                  publish(buffer.slice(0, index));

                  // set and publish the rest of the buffer as non reasoning
                  buffer = buffer.slice(index + closingTag.length);
                  isReasoning = false;
                  reasoningDone = true;
                  afterSwitch = true;
                  publish(buffer);
                  buffer = '';
                  return;
                } else {
                  publish(buffer);
                  buffer = '';
                  return;
                }
              } else {
                publish(buffer);
                buffer = '';
                return;
              }
            },
          }),
        ),
        ...rest,
      };
    },
  };
};

/**
 * Returns the index of the start of the searchedText in the text, or null if it
 * is not found.
 */
const getPotentialStartIndex = function getPotentialStartIndex(text: string, searchedText: string): number | null {
  // Return null immediately if searchedText is empty.
  if (searchedText.length === 0) {
    return null;
  }

  // Check if the searchedText exists as a direct substring of text.
  const directIndex = text.indexOf(searchedText);
  if (directIndex !== -1) {
    return directIndex;
  }

  // Otherwise, look for the largest suffix of "text" that matches
  // a prefix of "searchedText". We go from the end of text inward.
  for (let i = text.length - 1; i >= 0; i--) {
    const suffix = text.substring(i);
    if (searchedText.startsWith(suffix) && text[i - 1] !== '`') {
      return i;
    }
  }

  return null;
};
