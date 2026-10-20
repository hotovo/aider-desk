import type { ModelInfo } from '@opencode/client';
import type { Model } from '@aiderdesk/extensions';

export const PROVIDER_ID = 'opencode-free';
export const NATIVE_TOOLS = new Map([
  ['shell', 'power---bash'],
  ['read', 'power---file_read'],
]);

export const isFreeModel = (model: ModelInfo): boolean =>
  model.providerID === 'opencode' &&
  model.enabled &&
  model.status !== 'deprecated' &&
  (model.modelID === 'big-pickle' || model.modelID.endsWith('-free')) &&
  model.capabilities.tools &&
  model.capabilities.output.includes('text') &&
  model.cost.length > 0 &&
  model.cost.every((cost) => [cost.input, cost.output, cost.cache.read, cost.cache.write].every((price) => price === 0));

export const toModel = (model: ModelInfo, providerId: string): Model => ({
  id: `opencode/${model.modelID}`,
  providerId,
  maxInputTokens: model.limit.input ?? model.limit.context,
  maxOutputTokensLimit: model.limit.output,
  supportsTools: true,
  cacheReadInputTokenCost: 0,
  cacheWriteInputTokenCost: 0,
  inputCostPerToken: 0,
  outputCostPerToken: 0,
});

export const nativeInput = (name: string, input: Record<string, unknown>): Record<string, unknown> => {
  if (name === 'shell' && typeof input.workdir === 'string') {
    const { workdir, ...command } = input;
    return { ...command, cwd: workdir };
  }
  if (name !== 'read') {
    return input;
  }
  return {
    filePath: input.path,
    ...(typeof input.offset === 'number' ? { lineOffset: Math.max(0, input.offset - 1) } : {}),
    ...(typeof input.limit === 'number' ? { lineLimit: input.limit } : {}),
  };
};
