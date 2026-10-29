export interface StreamingConfig {
  disableStreaming?: boolean;
  requireStreaming?: boolean;
}

export const resolveStreamingConfig = (...sources: (Partial<Record<keyof StreamingConfig, unknown>> | undefined)[]): Required<StreamingConfig> => {
  const result = { disableStreaming: false, requireStreaming: false };
  for (const source of sources) {
    if (!source) {
      continue;
    }
    if (typeof source.disableStreaming === 'boolean') {
      result.disableStreaming = source.disableStreaming;
    }
    if (typeof source.requireStreaming === 'boolean') {
      result.requireStreaming = source.requireStreaming;
    }
    if (source.requireStreaming === true) {
      result.disableStreaming = false;
    } else if (source.disableStreaming === true) {
      result.requireStreaming = false;
    }
  }
  return result;
};
