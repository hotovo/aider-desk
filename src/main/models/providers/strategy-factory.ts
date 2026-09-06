/**
 * Descriptor-driven factory for the two dominant provider shapes:
 *
 * 1. "simple API-key SDK provider" — one credential, a fixed or resolved base URL,
 *    a single vendored SDK factory, optional models listing, the standard Aider mapping.
 * 2. "fixed-URL OpenAI-compatible provider" — same as (1) with a hardcoded base URL.
 *
 * Anything genuinely bespoke stays in the provider file and is spread on top via
 * `overrides`, keeping the generated strategy behavior-identical to the originals.
 */
import { LlmProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData, TlsPolicyRegistrar } from '@common/types';

import type { LanguageModel, ToolSet } from 'ai';
import type { LanguageModelV2, LanguageModelV3, LanguageModelV4 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { syncProviderTlsRule } from '@/models/utils';
import {
  buildSimpleAiderMapping,
  loadOpenAiCompatibleModels,
  resolveProviderCredential,
  staticModels,
  type SimpleAiderMappingOptions,
} from '@/models/providers/shared';
import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import { getDefaultModelInfo, getDefaultUsageReport } from '@/models/providers/default';

type ProviderRecord = Record<string, unknown>;

/**
 * SDK factories declare their own options types. Typing the parameter as `never`
 * (contravariance) lets any concrete factory (createGroq, createAnthropic,
 * createOpenAICompatible, ...) be assigned as-is; the invocation below performs the
 * single internal cast.
 */
/** concrete model instance returned by an SDK factory (never a model-id string) */
type SdkModel = LanguageModelV2 | LanguageModelV3 | LanguageModelV4;

type SdkModelFactory = (opts: never) => (modelId: string) => SdkModel;

export interface CredentialResolutionContext {
  provider: ProviderRecord;
  settings: SettingsData;
  projectDir?: string;
}

export interface SdkFactoryContext {
  provider: ProviderRecord;
  profile: ProviderProfile;
  model: Model;
  apiKey: string | undefined;
  baseUrl: string | undefined;
}

interface OpenAiCompatibleLoader {
  type: 'openai-compatible';
  /** endpoint of the models collection */
  url: string;
  /** debug message logged when no credential resolves; unset = stay silent */
  noKeyDebug?: string;
  notOkLog?: 'error' | 'warn' | 'debug';
  catchLog?: 'error' | 'warn';
  dedupeById?: boolean;
  /** defaults to `(id) => ({ id })`; id/providerId are stamped by the shared loader */
  mapper?: (id: string, item: unknown, provider: LlmProvider) => Partial<Model> | null;
}

interface StaticLoader {
  type: 'static';
  /** env var gated on before returning the list; unset = no credential gate */
  apiKeyEnv?: string;
  noKeyDebug?: string;
  items: (profile: ProviderProfile) => Model[];
}

export interface ProviderDescriptor {
  /** identifier used in descriptor-validation and error messages; the model-manager
   * provider registry keys are derived independently from the provider list */
  name: string;
  /** human label used in log/error texts */
  label: string;
  sdkFactory: SdkModelFactory;

  /** env var(s) consulted when the provider API-key field is missing */
  apiKeyEnv?: string | string[];
  /** provider field holding the API key (default 'apiKey') */
  apiKeyField?: string;
  /**
   * message thrown when no credential resolves (function form receives the provider).
   * Default: `<label> API key is required in Providers settings or Aider environment
   * variables (<first apiKeyEnv>)`; null = credential is optional.
   */
  apiKeyRequired?: string | ((provider: ProviderRecord) => string) | null;
  /** replaces the default provider-field → env resolution chain (see clinepass) */
  credResolver?: (ctx: CredentialResolutionContext) => string | undefined;

  /** dynamic base URL, resolved like a credential from a provider field + env fallback */
  baseUrl?: {
    field?: string;
    envKey?: string | string[];
    required: string | ((provider: ProviderRecord) => string);
    transform?: (url: string) => string;
  };
  /** fixed base URL passed to the SDK factory (ignored when `baseUrl` is set) */
  fixedBaseURL?: string;
  /** call syncProviderTlsRule(tlsRegistrar, resolvedUrl, sslVerify, caCertPath) during createLlm */
  tlsSync?: boolean;

  /** merged over the default `{ apiKey, headers, baseURL }` factory options */
  extraFactoryOptions?: (ctx: SdkFactoryContext) => Record<string, unknown>;
  /** final decoration of the constructed language model (e.g. ollama streaming middleware) */
  wrapModel?: (model: SdkModel) => LanguageModel;
  /** model id passed to the SDK instance (default model.id) */
  createModelId?: (model: Model) => string;

  /** loadModels gate: return { models: [], success: false } unless this holds */
  isProvider?: (provider: LlmProvider) => boolean;
  modelsLoader?: OpenAiCompatibleLoader | StaticLoader;
  /** keys OR-checked by the default hasEnvVars (default: [apiKeyEnv]) */
  hasEnvKeys?: string[];
  /** replaces the default hasEnvVars; false = never any env var present */
  hasEnvVars?: ((settings: SettingsData) => boolean) | false;

  /** standard buildSimpleAiderMapping implementation; required unless overrides
   * supplies getAiderMapping (e.g. lm-studio / ollama keep bespoke mappings) */
  aider?: SimpleAiderMappingOptions;
  /** bespoke strategy members spread on top of the generated ones */
  overrides?: Partial<LlmProviderStrategy>;
}

const arrayify = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export const createStrategyFromDescriptor = (d: ProviderDescriptor): LlmProviderStrategy => {
  if (!d.modelsLoader && !d.overrides?.loadModels) {
    throw new Error(`Provider '${d.name}' descriptor needs modelsLoader or overrides.loadModels`);
  }
  if (!d.aider && !d.overrides?.getAiderMapping) {
    throw new Error(`Provider '${d.name}' descriptor needs aider config or overrides.getAiderMapping`);
  }
  // The generated mapping is always shadowed by overrides (spread last), so the
  // combination above would silently make the aider config dead code.
  if (d.aider && d.overrides?.getAiderMapping) {
    throw new Error(`Provider '${d.name}' descriptor must not set both aider and overrides.getAiderMapping`);
  }

  const apiKeyRequiredMessage: string | ((provider: ProviderRecord) => string) | null = (() => {
    if (d.apiKeyRequired !== undefined) {
      return d.apiKeyRequired;
    }
    const env = arrayify(d.apiKeyEnv)[0];
    return env ? `${d.label} API key is required in Providers settings or Aider environment variables (${env})` : null;
  })();

  const createLlm: LlmProviderStrategy['createLlm'] = (
    profile,
    model,
    settings,
    projectDir,
    _toolSet?: ToolSet,
    _systemPrompt?: string,
    _providerMetadata?: unknown,
    tlsRegistrar?: TlsPolicyRegistrar,
  ): LanguageModel => {
    const provider = profile.provider as unknown as ProviderRecord;

    const apiKey = d.credResolver
      ? d.credResolver({ provider, settings, projectDir })
      : resolveProviderCredential({
          provider,
          field: d.apiKeyField ?? 'apiKey',
          settings,
          projectDir,
          envKey: d.apiKeyEnv,
          required: null,
        });

    if (!apiKey && apiKeyRequiredMessage !== null) {
      throw new Error(typeof apiKeyRequiredMessage === 'function' ? apiKeyRequiredMessage(provider) : apiKeyRequiredMessage);
    }

    let baseUrl: string | undefined;
    if (d.baseUrl) {
      const raw = resolveProviderCredential({
        provider,
        field: d.baseUrl.field ?? 'baseUrl',
        settings,
        projectDir,
        envKey: d.baseUrl.envKey,
        required: null,
      });
      // Pre-refactor providers validated with `!baseUrl`, so an explicitly configured
      // empty value (e.g. OPENAI_API_BASE='') must be rejected, not just an absent one.
      // Whitespace stays accepted, matching the original truthy-string behavior.
      if (raw === undefined || raw === '') {
        throw new Error(typeof d.baseUrl.required === 'function' ? d.baseUrl.required(provider) : d.baseUrl.required);
      }
      baseUrl = d.baseUrl.transform ? d.baseUrl.transform(raw) : raw;
    } else if (d.fixedBaseURL !== undefined) {
      baseUrl = d.fixedBaseURL;
    }

    if (d.tlsSync) {
      syncProviderTlsRule(tlsRegistrar, baseUrl, provider.sslVerify as boolean | undefined, provider.caCertPath as string | undefined);
    }

    const factoryOptions: Record<string, unknown> = { [d.apiKeyField ?? 'apiKey']: apiKey, headers: profile.headers };
    if (baseUrl !== undefined) {
      factoryOptions.baseURL = baseUrl;
    }
    Object.assign(factoryOptions, d.extraFactoryOptions?.({ provider, profile, model, apiKey, baseUrl }) ?? {});

    // `never` cast: see SdkModelFactory above.
    const languageModel = d.sdkFactory(factoryOptions as never)(d.createModelId ? d.createModelId(model) : model.id);
    return d.wrapModel ? d.wrapModel(languageModel) : languageModel;
  };

  const loadModels: LlmProviderStrategy['loadModels'] = async (profile, settings) => {
    if (d.isProvider && !d.isProvider(profile.provider as LlmProvider)) {
      return { models: [], success: false };
    }

    const loader = d.modelsLoader!;
    const provider = profile.provider as unknown as ProviderRecord;
    const apiKeyField = d.apiKeyField ?? 'apiKey';

    if (loader.type === 'static') {
      if (loader.apiKeyEnv) {
        const apiKey = resolveProviderCredential({ provider, field: apiKeyField, settings, envKey: loader.apiKeyEnv, required: null });
        if (!apiKey) {
          if (loader.noKeyDebug) {
            logger.debug(loader.noKeyDebug);
          }
          return { models: [], success: false };
        }
      }
      return staticModels(loader.items(profile), d.label, profile.id);
    }

    const apiKey = resolveProviderCredential({ provider, field: apiKeyField, settings, envKey: d.apiKeyEnv, required: null });
    if (!apiKey) {
      if (loader.noKeyDebug) {
        logger.debug(loader.noKeyDebug);
      }
      return { models: [], success: false };
    }

    return loadOpenAiCompatibleModels({
      url: loader.url,
      headers: { Authorization: `Bearer ${apiKey}` },
      profile,
      label: d.label,
      notOkLog: loader.notOkLog,
      catchLog: loader.catchLog,
      dedupeById: loader.dedupeById,
      mapper: loader.mapper
        ? (id, item, provider) => {
            const map = loader.mapper!;
            return map(id, item, provider as LlmProvider);
          }
        : (id) => ({ id }),
    });
  };

  return {
    // Core LLM functions
    createLlm,
    getUsageReport: getDefaultUsageReport,
    // default modelsInfo enrichment lookup; provider overrides (e.g. synthetic,
    // zai-plan) spread after this and still win
    getModelInfo: getDefaultModelInfo,

    // Model discovery functions
    loadModels,
    hasEnvVars:
      d.hasEnvVars === undefined
        ? (() => {
            const envKeys = d.hasEnvKeys ?? arrayify(d.apiKeyEnv);
            return (settings: SettingsData): boolean =>
              envKeys.length > 0 && envKeys.some((key) => !!getEffectiveEnvironmentVariable(key, settings, undefined)?.value);
          })()
        : d.hasEnvVars === false
          ? (): boolean => false
          : d.hasEnvVars,
    getAiderMapping: d.aider
      ? buildSimpleAiderMapping(d.aider)
      : // unreachable: validated above that overrides supplies getAiderMapping
        (_provider, modelId): AiderModelMapping => ({ modelName: modelId, environmentVariables: {} }),

    ...d.overrides,
  };
};
