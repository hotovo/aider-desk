import { generateText, streamText } from 'ai';

export const generateOnce = async (parameters: Parameters<typeof generateText>[0], requireStreaming: boolean) => {
  if (!requireStreaming) {
    const result = await generateText(parameters);
    return {
      text: result.text,
      output: parameters.output ? result.output : undefined,
      toolCalls: result.toolCalls,
      usage: result.usage,
      providerMetadata: result.providerMetadata,
      finishReason: result.finishReason,
    };
  }

  let streamError: unknown;
  const result = streamText({
    ...parameters,
    onError: ({ error }) => {
      streamError = error;
    },
  });
  await result.consumeStream({
    onError: (error) => {
      streamError = error;
    },
  });
  if (streamError !== undefined) {
    throw streamError;
  }
  return {
    text: await result.text,
    output: parameters.output ? await result.output : undefined,
    toolCalls: await result.toolCalls,
    usage: await result.usage,
    providerMetadata: await result.providerMetadata,
    finishReason: await result.finishReason,
  };
};
