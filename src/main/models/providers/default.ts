import { Model, ModelInfo, ProviderProfile, UsageReportData } from '@common/types';

import type { LanguageModelUsage } from 'ai';

import { Task } from '@/task';
import logger from '@/logger';

export const getDefaultModelInfo = (provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined => {
  // Try provider.name prefix first
  let fullModelId = `${provider.name}/${modelId}`;
  let modelInfo = allModelInfos[fullModelId];

  // If not found, try provider.id prefix
  if (!modelInfo) {
    fullModelId = `${provider.id}/${modelId}`;
    modelInfo = allModelInfos[fullModelId];
  }

  logger.debug('getDefaultModelInfo', {
    providerName: provider.name,
    providerId: provider.id,
    modelId,
    fullModelId,
    found: !!modelInfo,
  });

  return modelInfo;
};

// === Cost and Usage Functions ===
export const calculateCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0, cacheWriteTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;
  const cacheWriteInputTokenCost = model.cacheWriteInputTokenCost ?? 0;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCreationCost = cacheWriteTokens * cacheWriteInputTokenCost;
  const cacheReadCost = cacheReadTokens * cacheReadInputTokenCost;
  const cacheCost = cacheCreationCost + cacheReadCost;

  return inputCost + outputCost + cacheCost;
};

export const getDefaultUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
  const sentTokens = usage.inputTokenDetails?.noCacheTokens || totalSentTokens - cacheReadTokens;

  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens, cacheWriteTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    cacheWriteTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};
