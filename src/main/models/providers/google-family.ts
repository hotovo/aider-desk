/**
 * Shared behavior for the Gemini / Vertex AI strategies: the two usage reports and
 * thinkingConfig builders are near-verbatim twins that differ only in the provider
 * metadata / options registry key (`google` vs `vertex`), which callers pass in.
 */
import { Model, ProviderProfile, Reasoning, UsageReportData } from '@common/types';

import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModelUsage } from 'ai';
import type { Task } from '@/task/task';

import { calculateCost } from '@/models/providers/default';

type GoogleFamilyMetadata = {
  google?: {
    cachedContentTokenCount?: number;
  };
  vertex?: {
    cachedContentTokenCount?: number;
  };
};

/**
 * Deducts cached tokens from the sent-token count and prices the request with the
 * shared calculateCost defaults, reading cachedContentTokenCount from the Google
 * family metadata bucket named `metadataKey` before falling back to usage details.
 */
export const getGoogleFamilyUsageReport = (
  metadataKey: 'google' | 'vertex',
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache read tokens from provider metadata or usage
  const familyMetadata = (providerMetadata as GoogleFamilyMetadata | undefined)?.[metadataKey];
  const cacheReadTokens = familyMetadata?.cachedContentTokenCount ?? usage.inputTokenDetails?.cacheReadTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

/**
 * Builds the thinkingConfig provider options for Gemini / Vertex AI, keyed by
 * `metadataKey`. `includeThoughts`/`thinkingBudget` must already be resolved by
 * the caller (model-specific overrides falling back to provider defaults).
 */
export const getGoogleFamilyProviderOptions = (
  metadataKey: 'google' | 'vertex',
  includeThoughts: boolean,
  thinkingBudget: number | undefined,
  reasoning?: Reasoning,
): SharedV4ProviderOptions | undefined => {
  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // omit thinkingBudget from thinkingConfig so the AI SDK's portable reasoning takes effect.
  // Keep includeThoughts if set so reasoning output is still returned.
  if (reasoning && reasoning !== 'provider-default') {
    return {
      [metadataKey]: {
        ...(includeThoughts && {
          thinkingConfig: {
            includeThoughts: true,
          },
        }),
      } satisfies GoogleLanguageModelOptions,
    };
  }

  return {
    [metadataKey]: {
      ...((includeThoughts || thinkingBudget) && {
        thinkingConfig: {
          includeThoughts: includeThoughts && (thinkingBudget ?? 0) > 0,
          thinkingBudget,
        },
      }),
    } satisfies GoogleLanguageModelOptions,
  };
};
