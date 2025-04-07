import fs from 'fs/promises';

import { LlmProvider, PROVIDER_MODELS } from './llm-providers';
import { UsageReportData } from './types';

export const SERVER_TOOL_SEPARATOR = '---';

type TextContent =
  | string
  | {
      type: 'text';
      text: string;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTextContent = (content: any): content is TextContent => content?.type === 'text' || typeof content === 'string';

export const extractTextContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(isTextContent)
      .map((c) => (typeof c === 'string' ? c : c.text))
      .join('\n\n');
  }

  if (typeof content === 'object' && content !== null && 'content' in content) {
    return extractTextContent((content as { content: unknown }).content);
  }

  return '';
};

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const parseUsageReport = (report: string): UsageReportData => {
  const sentMatch = report.match(/Tokens: ([\d.]+k?) sent/);
  const receivedMatch = report.match(/([\d.]+k?) received/);
  const messageCostMatch = report.match(/Cost: \$(\d+\.\d+) message/);
  const totalCostMatch = report.match(/\$(\d+\.\d+) session/);

  const parseTokens = (tokenStr: string): number => {
    if (tokenStr.includes('k')) {
      return parseFloat(tokenStr.replace('k', '')) * 1000;
    }
    return parseFloat(tokenStr);
  };

  const sentTokens = sentMatch ? parseTokens(sentMatch[1]) : 0;
  const receivedTokens = receivedMatch ? parseTokens(receivedMatch[1]) : 0;

  const messageCost = messageCostMatch ? parseFloat(messageCostMatch[1]) : 0;
  const aiderTotalCost = totalCostMatch ? parseFloat(totalCostMatch[1]) : 0;

  return {
    sentTokens,
    receivedTokens,
    messageCost,
    aiderTotalCost,
  };
};

export const normalizeBaseDir = (baseDir: string): string => {
  // On Windows, paths are case-insensitive so we normalize to lowercase
  return process.platform === 'win32' ? baseDir.toLowerCase() : baseDir;
};

export const fileExists = async (fileName: string): Promise<boolean> => {
  return (await fs.stat(fileName).catch(() => null)) !== null;
};

export const calculateCost = (llmProvider: LlmProvider, sentTokens: number, receivedTokens: number) => {
  const providerModels = PROVIDER_MODELS[llmProvider.name];
  if (!providerModels) {
    return 0;
  }

  // Get the model name directly from the provider
  const model = llmProvider.model;
  if (!model) {
    return 0;
  }

  // Find the model cost configuration
  const modelCost = providerModels.models[model];
  if (!modelCost) {
    return 0;
  }

  // Calculate cost in dollars (costs are per million tokens)
  const inputCost = (sentTokens * modelCost.inputCost) / 1_000_000;
  const outputCost = (receivedTokens * modelCost.outputCost) / 1_000_000;

  return inputCost + outputCost;
};

export const extractServerNameToolName = (toolCallName: string): [string, string] => {
  const [serverName, ...toolNameParts] = toolCallName.split(SERVER_TOOL_SEPARATOR);
  const toolName = toolNameParts.join(SERVER_TOOL_SEPARATOR);

  return [serverName, toolName];
};
