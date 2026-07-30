import type { Model, UsageReportData } from '@aiderdesk/extensions';

export interface TurnUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens?: number;
  reasoningTokens?: number;
}

export const calculateCursorUsageCost = (usage: TurnUsage, model?: Model): number => {
  if (!model) return 0;

  const sentTokens = usage.inputTokens - usage.cacheReadTokens;
  const inputCost = sentTokens * (model.inputCostPerToken ?? 0);
  const outputCost = usage.outputTokens * (model.outputCostPerToken ?? 0);
  const cacheReadCost = usage.cacheReadTokens * (model.cacheReadInputTokenCost ?? model.inputCostPerToken ?? 0);
  const cacheWriteCost = usage.cacheWriteTokens * (model.cacheWriteInputTokenCost ?? 0);

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
};

export const mapTokenUsage = (
  usage: TurnUsage,
  modelName: string,
  model: Model | undefined,
  agentTotalCost?: number,
): UsageReportData => {
  const sentTokens = usage.inputTokens - usage.cacheReadTokens;
  const messageCost = calculateCursorUsageCost(usage, model);
  const report: UsageReportData = {
    model: modelName,
    sentTokens,
    receivedTokens: usage.outputTokens,
    messageCost,
    cacheWriteTokens: usage.cacheWriteTokens || undefined,
    cacheReadTokens: usage.cacheReadTokens || undefined,
  };

  if (agentTotalCost !== undefined) {
    report.agentTotalCost = agentTotalCost + messageCost;
  }

  return report;
};
