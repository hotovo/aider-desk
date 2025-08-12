import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from 'ai';

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
}): LanguageModelV1Middleware {
  const openingTag = `<${tagName}>`;
  const closingTag = `</${tagName}>`;

  return {
    middlewareVersion: 'v1',
    wrapGenerate: async ({ doGenerate }) => {
      const { text: rawText, ...rest } = await doGenerate();

      if (rawText == null) {
        return { text: rawText, ...rest };
      }

      const text = rawText;

      const regexp = new RegExp(`${openingTag}(.*?)${closingTag}`, 'gs');
      const matches = Array.from(text.matchAll(regexp));

      if (!matches.length) {
        return { text, ...rest };
      }

      const reasoning = matches.map((match) => match[1]).join(separator);

      let textWithoutReasoning = text;
      for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];

        const beforeMatch = textWithoutReasoning.slice(0, match.index);
        const afterMatch = textWithoutReasoning.slice(match.index! + match[0].length);

        textWithoutReasoning = beforeMatch + (beforeMatch.length > 0 && afterMatch.length > 0 ? separator : '') + afterMatch;
      }

      return { ...rest, text: textWithoutReasoning, reasoning };
    },

    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream();

      let isFirstReasoning = true;
      let isFirstText = true;
      let afterSwitch = false;
      let isReasoning = false;
      let buffer = '';

      return {
        stream: stream.pipeThrough(
          new TransformStream<LanguageModelV1StreamPart, LanguageModelV1StreamPart>({
            transform: (chunk, controller) => {
              if (chunk.type !== 'text-delta') {
                controller.enqueue(chunk);
                return;
              }

              buffer += chunk.textDelta;

              const publish = function publish(text: string) {
                if (text.length > 0) {
                  const prefix = afterSwitch && (isReasoning ? !isFirstReasoning : !isFirstText) ? separator : '';

                  controller.enqueue({
                    type: isReasoning ? 'reasoning' : 'text-delta',
                    textDelta: prefix + text,
                  });
                  afterSwitch = false;

                  if (isReasoning) {
                    isFirstReasoning = false;
                  } else {
                    isFirstText = false;
                  }
                }
              };

              let shouldContinue = true;
              while (shouldContinue) {
                const nextTag = isReasoning ? closingTag : openingTag;

                // For reasoning mode, only look for opening tag at the start of buffer
                let startIndex: number | null = null;
                if (!isReasoning) {
                  // When looking for reasoning opening tag, it must be at the start of buffer
                  if (buffer.startsWith(openingTag)) {
                    startIndex = 0;
                  }
                } else {
                  startIndex = getPotentialStartIndex(buffer, nextTag);
                }

                // no opening or closing tag found, publish the buffer
                if (startIndex == null) {
                  publish(buffer);
                  buffer = '';
                  shouldContinue = false;
                } else {
                  // publish text before the tag
                  publish(buffer.slice(0, startIndex));

                  const foundFullMatch = startIndex + nextTag.length <= buffer.length;

                  if (foundFullMatch) {
                    buffer = buffer.slice(startIndex + nextTag.length);
                    isReasoning = !isReasoning;
                    afterSwitch = true;
                  } else {
                    buffer = buffer.slice(startIndex);
                    shouldContinue = false;
                  }
                }
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
    if (searchedText.startsWith(suffix)) {
      return i;
    }
  }

  return null;
};
