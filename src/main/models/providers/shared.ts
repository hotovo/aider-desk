/**
 * Shared kernel helpers for provider strategies. Extracted from the per-provider
 * files so each strategy only keeps the parts that are genuinely provider-specific.
 */
import { v4 as uuidv4 } from 'uuid';
import { ContextUserMessage, Model, ModelInfo, ProviderProfile, Reasoning, ReasoningEffort, SettingsData } from '@common/types';

import type { ModelMessage } from 'ai';
import type { SharedV4ProviderOptions } from '@ai-sdk/provider';

import { AiderModelMapping, LoadModelsResponse } from '@/models/types';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils/environment';

/**
 * Resolves a credential using the canonical chain: `provider[field]`, then each
 * entry in `envKey` via getEffectiveEnvironmentVariable (with a debug log of the
 * source). When the credential is still missing and `required` is non-null, throws
 * an Error whose message is the exact `required` text the caller locks to.
 */
export interface ResolveProviderCredentialOptions {
  provider: unknown;
  field: string;
  settings: SettingsData;
  projectDir?: string;
  envKey?: string | string[];
  required: string | null;
}

// Overloads so TS knows a non-null `required` guarantees a string result.
export function resolveProviderCredential(opts: ResolveProviderCredentialOptions & { required: string }): string;
export function resolveProviderCredential(opts: ResolveProviderCredentialOptions & { required: null }): string | undefined;
export function resolveProviderCredential(opts: ResolveProviderCredentialOptions): string | undefined {
  const directValue = (opts.provider as Record<string, unknown> | undefined)?.[opts.field];
  if (typeof directValue === 'string' && directValue) {
    return directValue;
  }

  const envKeys = opts.envKey ? (Array.isArray(opts.envKey) ? opts.envKey : [opts.envKey]) : [];
  for (const envKey of envKeys) {
    const effectiveVar = getEffectiveEnvironmentVariable(envKey, opts.settings, opts.projectDir);
    if (effectiveVar) {
      logger.debug(`Loaded ${envKey} from ${effectiveVar.source}`);
      return effectiveVar.value;
    }
  }

  if (opts.required !== null) {
    throw new Error(opts.required);
  }

  return undefined;
}

/**
 * Normalizes an unknown thrown value into the error-message string the provider
 * strategies put on LoadModelsResponse. Callers pass the per-provider fallback
 * used when the value is neither a string nor an Error.
 */
export const normalizeError = (error: unknown, fallback?: string): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback ?? JSON.stringify(error);
};

/** Appends a trailing `/v1` when the base URL does not already end with it. */
export const ensureV1Suffix = (baseUrl: string): string => (baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`);

/** Removes a trailing `/v1` when present; URLs without the suffix pass through unchanged. */
export const stripV1Suffix = (baseUrl: string): string => (baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl);

/**
 * Applies the shared `model.providerOverrides?.k ?? provider.k` precedence for the
 * given keys, returning just the resolved subset.
 */
export const mergeModelProps = <T extends object, K extends keyof T>(model: Model, provider: T, keys: readonly K[]): Pick<T, K> => {
  const overrides = model.providerOverrides as Partial<T> | undefined;
  return Object.fromEntries(keys.map((key) => [key, overrides?.[key] ?? provider[key]])) as Pick<T, K>;
};

/**
 * Returns the static (hardcoded-catalog) loadModels response shape.
 */
export const staticModels = (models: Model[], label: string, profileId: string): LoadModelsResponse => {
  logger.info(`Loaded ${models.length} ${label} models for profile ${profileId}`);
  return { models, success: true };
};

interface LoadOpenAiCompatibleModelsOptions {
  url: string;
  headers: Record<string, string>;
  profile: ProviderProfile;
  /** display name used in all log/error texts, e.g. 'Groq' or 'OpenAI-compatible' */
  label: string;
  /**
   * Maps one item of the response collection to a Model (or its partial without
   * id/providerId, which the helper stamps). Returning null skips the item.
   */
  mapper: (id: string, item: unknown, provider: unknown) => Partial<Model> | null;
  /** log call for non-OK responses; 'none' = stay silent */
  notOkLog?: 'error' | 'warn' | 'debug' | 'none';
  /** log call for thrown errors; 'none' = stay silent */
  catchLog?: 'error' | 'warn' | 'none';
  /** drop duplicate ids (mistral returns duplicated entries) */
  dedupeById?: boolean;
}

/**
 * Shared guard -> fetch -> error-normalize -> map -> log frame for the
 * `<label> models API` loadModels implementations.
 */
export const loadOpenAiCompatibleModels = async (opts: LoadOpenAiCompatibleModelsOptions): Promise<LoadModelsResponse> => {
  const { url, headers, profile, label, mapper, notOkLog = 'error', catchLog = 'error', dedupeById = false } = opts;

  try {
    const response = await fetch(url, Object.keys(headers).length > 0 ? { headers } : undefined);
    if (!response.ok) {
      const errorMsg = `${label} models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      if (notOkLog === 'error') {
        logger.error(errorMsg, { status: response.status, statusText: response.statusText });
      } else if (notOkLog === 'warn') {
        logger.warn(errorMsg);
      } else if (notOkLog === 'debug') {
        logger.debug(errorMsg);
      }
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const items = data.data as Array<{ id?: string }> | undefined;
    const models =
      items
        ?.map((item) => {
          // keep a possibly-undefined id so malformed entries behave like the originals did
          const id = item.id as string;
          const mapped = mapper(id, item, profile.provider);
          // stamp id/providerId exactly like every per-provider implementation did
          return mapped ? { ...mapped, id, providerId: profile.id } : null;
        })
        .filter((model): model is Model => model !== null) || [];

    const resultModels = dedupeById ? models.filter((model, index, arr) => arr.findIndex((m) => m.id === model.id) === index) : models;

    logger.info(`Loaded ${resultModels.length} ${label} models for profile ${profile.id}`);
    return { models: resultModels, success: true };
  } catch (error) {
    const errorMsg = normalizeError(error, `Unknown error loading ${label} models`);
    if (catchLog === 'error') {
      logger.error(`Error loading ${label} models:`, error);
    } else if (catchLog === 'warn') {
      logger.warn(`Failed to fetch ${label} models via API:`, error);
    }
    return { models: [], success: false, error: errorMsg };
  }
};

export interface SimpleAiderMappingOptions {
  prefix: string;
  /** env var written into the mapping when a key is resolved */
  apiKeyEnv: string;
  /** env var consulted as fallback when provider.apiKey is missing (defaults to apiKeyEnv) */
  sourceEnvKey?: string;
  /** write the resolved key into apiKeyEnv even when the provider value is missing */
  readEnvFallback?: boolean;
  /** fixed upstream base URL written to OPENAI_API_BASE */
  upstreamBaseUrl?: string;
  /** provider field holding a dynamic base URL, written to OPENAI_API_BASE when set */
  baseUrlField?: string;
  /** extra environment variables (undefined values are skipped) */
  extraEnv?: Record<string, string | undefined>;
}

/**
 * Builds the standard getAiderMapping for simple providers:
 * `envVars.<apiKeyEnv> = resolved key` (+ optional fixed OPENAI_API_BASE, optional
 * extra vars) under a `<prefix>/<modelId>` model name.
 */
export const buildSimpleAiderMapping = (opts: SimpleAiderMappingOptions) => {
  return (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
    const envVars: Record<string, string> = {};

    let apiKey = (provider.provider as Record<string, unknown> | undefined)?.apiKey as string | undefined;
    const sourceEnvKey = opts.sourceEnvKey ?? opts.apiKeyEnv;
    // env fallback only applies when the explicit provider.apiKey is missing
    if (opts.readEnvFallback && !apiKey) {
      const effectiveVar = getEffectiveEnvironmentVariable(sourceEnvKey, settings, projectDir);
      if (effectiveVar) {
        logger.debug(`Loaded ${sourceEnvKey} from ${effectiveVar.source}`);
        apiKey = effectiveVar.value;
      }
    }
    if (apiKey) {
      envVars[opts.apiKeyEnv] = apiKey;
    }

    if (opts.upstreamBaseUrl) {
      envVars.OPENAI_API_BASE = opts.upstreamBaseUrl;
    }

    if (opts.baseUrlField) {
      const baseUrl = (provider.provider as Record<string, unknown> | undefined)?.[opts.baseUrlField] as string | undefined;
      if (baseUrl) {
        envVars.OPENAI_API_BASE = baseUrl;
      }
    }

    if (opts.extraEnv) {
      for (const [key, value] of Object.entries(opts.extraEnv)) {
        if (value !== undefined) {
          envVars[key] = value;
        }
      }
    }

    return {
      modelName: `${opts.prefix}/${modelId}`,
      environmentVariables: envVars,
    };
  };
};

/**
 * Appends a synthetic "Continue" user message when the last message is not a user
 * message (required by Gemini-family APIs). `logLabel` closes the debug sentence
 * `Added "Continue" user message for <logLabel>`, so callers keep their exact log text.
 */
export const appendContinueUserMessage = (messages: ModelMessage[], logLabel: string): ModelMessage[] => {
  if (messages.length === 0) {
    return messages;
  }

  const lastMessage = messages[messages.length - 1];

  if (lastMessage.role !== 'user') {
    const continueMessage: ContextUserMessage = {
      id: uuidv4(),
      role: 'user',
      content: 'Continue',
    };

    logger.debug(`Added "Continue" user message for ${logLabel} (last message was not a user message)`);
    return [...messages, continueMessage];
  }

  return messages;
};

/**
 * Builds the OpenAI Responses provider options shared by the `openai` and `azure`
 * strategies (both write to the `openai` options registry key). `reasoningEffort`
 * must already be resolved by the caller (model overrides falling back to provider
 * config).
 */
export const getOpenAiFamilyProviderOptions = (
  metadataKey: string,
  reasoningEffort: ReasoningEffort | undefined,
  reasoning?: Reasoning,
): SharedV4ProviderOptions | undefined => {
  // When the top-level reasoning parameter is set (not undefined or 'provider-default'),
  // omit reasoningEffort from providerOptions so the AI SDK's portable reasoning takes effect.
  // Keep reasoningSummary so reasoning output is still returned.
  if (reasoning && reasoning !== 'provider-default') {
    return {
      [metadataKey]: {
        reasoningSummary: 'auto',
      },
    };
  }

  // Map ReasoningEffort enum to AI SDK format
  const mappedReasoningEffort =
    reasoningEffort === undefined || reasoningEffort === ReasoningEffort.None
      ? undefined
      : (reasoningEffort.toLowerCase() as 'minimal' | 'low' | 'medium' | 'high' | 'xhigh');

  if (mappedReasoningEffort) {
    logger.debug('Using reasoning effort:', { mappedReasoningEffort });
    return {
      [metadataKey]: {
        reasoningSummary: 'auto',
        reasoningEffort: mappedReasoningEffort,
      },
    };
  }

  return undefined;
};

/**
 * Builds the Anthropic adaptive-thinking provider options shared by the
 * `anthropic`, `anthropic-compatible` and `minimax` strategies (all speak the
 * Anthropic wire protocol). Callers keep their own type-guard/reasoning gating
 * and only delegate the payload construction.
 */
export const getAnthropicAdaptiveThinkingOptions = (): SharedV4ProviderOptions =>
  // Explicitly request adaptive thinking with summarized display so reasoning/thinking
  // text is returned via thinking_delta events. Without this, newer Claude models (opus-4-7+)
  // default to 'omitted' display and return empty thinking blocks.
  ({
    anthropic: {
      thinking: { type: 'adaptive', display: 'summarized' },
    },
  });

export interface ModelTemperatureRule {
  match: (modelId: string) => boolean;
  temperature: number | undefined;
}

/**
 * Default temperature heuristic used by aggregator-style providers (OpenRouter,
 * Requesty, OpenCode): well-known families get curated temperatures, everything
 * else stays undefined so the provider default applies. `extraRules` run after the
 * built-in rules for provider-specific families.
 */
export const getDefaultModelTemperature = (modelId: string, extraRules?: ModelTemperatureRule[]): number | undefined => {
  if (modelId.includes('claude')) {
    return undefined;
  }
  if (modelId.includes('gemini')) {
    return 0.7;
  }
  if (modelId.includes('gpt-5')) {
    return undefined;
  }
  if (modelId.includes('qwen')) {
    return 0.55;
  }
  for (const rule of extraRules ?? []) {
    if (rule.match(modelId)) {
      return rule.temperature;
    }
  }
  return undefined;
};

/**
 * Builds the fixed-prefix getModelInfo implementations used by providers whose
 * model-info keys never vary with the profile (e.g. `google/${modelId}` for the
 * Gemini strategies).
 */
export const getModelInfoByPrefix =
  (prefix: string) =>
  (_provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>): ModelInfo | undefined =>
    allModelInfos[`${prefix}/${modelId}`];
