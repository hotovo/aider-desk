import { promises as fs } from 'fs';
import path from 'path';

import { AVAILABLE_PROVIDERS, getDefaultProviderParams, LlmProvider, LlmProviderName } from '@common/agent';
import {
  AgentProfile,
  Model,
  ModelInfo,
  ModelOverrides,
  ProviderModelsData,
  ProviderProfile,
  SettingsData,
  UsageReportData,
  VoiceSession,
} from '@common/types';
import { extractProviderModel } from '@common/utils';

import { anthropicProviderStrategy } from './providers/anthropic';
import { anthropicCompatibleProviderStrategy } from './providers/anthropic-compatible';
import { azureProviderStrategy } from './providers/azure';
import { bedrockProviderStrategy } from './providers/bedrock';
import { cerebrasProviderStrategy } from './providers/cerebras';
import { claudeAgentSdkProviderStrategy } from './providers/claude-agent-sdk';
import { deepseekProviderStrategy } from './providers/deepseek';
import { geminiProviderStrategy } from './providers/gemini';
import { geminiCliProviderStrategy } from './providers/gemini-cli';
import { gpustackProviderStrategy } from './providers/gpustack';
import { groqProviderStrategy } from './providers/groq';
import { kimiPlanProviderStrategy } from './providers/kimi-plan';
import { litellmProviderStrategy } from './providers/litellm';
import { lmStudioProviderStrategy } from './providers/lm-studio';
import { minimaxProviderStrategy } from './providers/minimax';
import { ollamaProviderStrategy } from './providers/ollama';
import { openaiProviderStrategy } from './providers/openai';
import { openaiCompatibleProviderStrategy } from './providers/openai-compatible';
import { opencodeProviderStrategy } from './providers/opencode';
import { openrouterProviderStrategy } from './providers/openrouter';
import { requestyProviderStrategy } from './providers/requesty';
import { syntheticProviderStrategy } from './providers/synthetic';
import { vertexAiProviderStrategy } from './providers/vertex-ai';
import { zaiPlanProviderStrategy } from './providers/zai-plan';

import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { JSONValue, LanguageModelUsage, ModelMessage, ToolSet } from 'ai';

import { AIDER_DESK_CACHE_DIR, AIDER_DESK_DATA_DIR } from '@/constants';
import logger from '@/logger';
import { Store } from '@/store';
import { EventManager } from '@/events';
import { Task } from '@/task/task';
import { AiderModelMapping, CacheControl, LlmProviderRegistry, LlmProviderStrategy } from '@/models/types';

const MODELS_META_URL = 'https://models.dev/api.json';
const MODELS_FILE = path.join(AIDER_DESK_DATA_DIR, 'models.json');

type ModelsMetaResponse = Record<
  string,
  {
    models: Record<
      string,
      {
        id: string;
        cost?: {
          input?: number;
          output?: number;
          cache_read?: number;
          cache_write?: number;
        };
        temperature?: boolean;
        limit: {
          context: number;
          output: number;
        };
      }
    >;
  }
>;

export class ModelManager {
  private readonly modelsInfo: Record<string, ModelInfo> = {};
  private readonly initPromise: Promise<void>;
  private providerModels: Record<string, Model[]> = {};
  private providerErrors: Record<string, string> = {};
  private modelOverrides: Model[] = [];

  // Provider registry for strategy pattern
  private providerRegistry: LlmProviderRegistry = {
    anthropic: anthropicProviderStrategy,
    'anthropic-compatible': anthropicCompatibleProviderStrategy,
    azure: azureProviderStrategy,
    bedrock: bedrockProviderStrategy,
    cerebras: cerebrasProviderStrategy,
    'claude-agent-sdk': claudeAgentSdkProviderStrategy,
    deepseek: deepseekProviderStrategy,
    gemini: geminiProviderStrategy,
    'gemini-cli': geminiCliProviderStrategy,
    gpustack: gpustackProviderStrategy,
    groq: groqProviderStrategy,
    'kimi-plan': kimiPlanProviderStrategy,
    litellm: litellmProviderStrategy,
    lmstudio: lmStudioProviderStrategy,
    minimax: minimaxProviderStrategy,
    ollama: ollamaProviderStrategy,
    openai: openaiProviderStrategy,
    'openai-compatible': openaiCompatibleProviderStrategy,
    opencode: opencodeProviderStrategy,
    openrouter: openrouterProviderStrategy,
    requesty: requestyProviderStrategy,
    synthetic: syntheticProviderStrategy,
    'vertex-ai': vertexAiProviderStrategy,
    'zai-plan': zaiPlanProviderStrategy,
  };

  constructor(
    private store: Store,
    private eventManager: EventManager,
  ) {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      logger.info('Initializing ModelInfoManager...');

      this.updateEnvVarsProviders();

      await this.loadModelsInfo();
      await this.loadModelOverrides();
      await this.loadProviderModels(this.store.getProviders().filter((p) => !p.disabled));

      logger.info('ModelInfoManager initialized successfully.', {
        modelCount: Object.keys(this.modelsInfo).length,
      });
    } catch (error) {
      logger.error('Error initializing ModelInfoManager:', error);
    }
  }

  private async loadModelsInfo(): Promise<void> {
    const cacheFile = path.join(AIDER_DESK_CACHE_DIR, 'models-meta.json');
    let cacheLoaded = false;

    // Try to load from cache first
    try {
      await fs.access(cacheFile);
      const cachedData = await fs.readFile(cacheFile, 'utf-8');
      const cachedJson = JSON.parse(cachedData) as ModelsMetaResponse;
      this.processModelsMeta(cachedJson);
      logger.info('Loaded models info from cache');
      cacheLoaded = true;
    } catch {
      // Cache file doesn't exist or is invalid, we'll fetch fresh data
      logger.info('Cache file not found or invalid, fetching fresh data');
    }

    const fetchFreshDataAndCache = async (cacheFile: string): Promise<void> => {
      const response = await fetch(MODELS_META_URL);
      if (!response.ok) {
        logger.error('Failed to fetch model info:', {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error('Failed to fetch model info');
      }
      const data = (await response.json()) as ModelsMetaResponse;
      this.processModelsMeta(data);

      // Save the fresh data to cache
      try {
        await fs.mkdir(AIDER_DESK_CACHE_DIR, { recursive: true });
        await fs.writeFile(cacheFile, JSON.stringify(data, null, 2));
        logger.info('Saved models info to cache');
      } catch (error) {
        logger.error('Failed to save models info to cache:', error);
      }
    };

    // Fetch fresh data in background if cache was loaded, otherwise await it
    const freshDataPromise = fetchFreshDataAndCache(cacheFile);

    if (cacheLoaded) {
      freshDataPromise.catch((error) => {
        logger.error('Background fetch of fresh models data failed:', error);
      });
    } else {
      await freshDataPromise;
    }
  }

  private processModelsMeta(data: ModelsMetaResponse) {
    for (const providerId in data) {
      const providerData = data[providerId];
      if (!providerData.models) {
        continue;
      }

      for (const modelKey in providerData.models) {
        const modelId = `${providerId}/${modelKey}`;
        const modelData = providerData.models[modelKey];
        this.modelsInfo[modelId] = {
          maxInputTokens: modelData.limit.context,
          maxOutputTokens: modelData.limit.output,
          inputCostPerToken: (modelData.cost?.input || 0) / 1_000_000,
          outputCostPerToken: (modelData.cost?.output || 0) / 1_000_000,
          cacheReadInputTokenCost: modelData.cost?.cache_read ? modelData.cost.cache_read / 1_000_000 : undefined,
          cacheWriteInputTokenCost: modelData.cost?.cache_write ? modelData.cost.cache_write / 1_000_000 : undefined,
          useTemperature: modelData.temperature,
        } satisfies ModelInfo;
      }
    }
  }

  getModelInfo(modelName: string): ModelInfo | undefined {
    const modelParts = modelName.split('/');
    return this.modelsInfo[modelParts[modelParts.length - 1]];
  }

  private createEnvVarProvider(providerName: LlmProviderName): ProviderProfile {
    return {
      id: providerName,
      provider: getDefaultProviderParams(providerName),
    };
  }

  private getChangedProviders(oldProviders: ProviderProfile[], newProviders: ProviderProfile[]): ProviderProfile[] {
    const oldMap = new Map(oldProviders.map((p) => [p.id, p]));
    const changed = new Set<ProviderProfile>();

    // Check for added/modified providers
    for (const newProfile of newProviders) {
      const oldProfile = oldMap.get(newProfile.id);
      if (!oldProfile || JSON.stringify(oldProfile) !== JSON.stringify(newProfile)) {
        changed.add(newProfile);
      }
    }

    return Array.from(changed);
  }

  async providersChanged(oldProviders: ProviderProfile[], newProviders: ProviderProfile[]) {
    await this.initPromise;

    const removedProviders = oldProviders.filter((p) => !newProviders.find((np) => np.id === p.id));
    for (const removedProvider of removedProviders) {
      delete this.providerErrors[removedProvider.id];
      // Clear models for removed providers
      delete this.providerModels[removedProvider.id];
    }

    // Clear models for providers that became disabled
    const disabledProviders = oldProviders.filter((old) => {
      const newProfile = newProviders.find((np) => np.id === old.id);
      return newProfile && newProfile.disabled && !old.disabled;
    });
    for (const disabledProvider of disabledProviders) {
      delete this.providerErrors[disabledProvider.id];
      delete this.providerModels[disabledProvider.id];
      logger.info(`Cleared models for disabled provider: ${disabledProvider.id}`);
    }

    const changedProviderProfiles = this.getChangedProviders(oldProviders, newProviders);
    await this.loadProviderModels(changedProviderProfiles.filter((p) => !p.disabled));

    return changedProviderProfiles.length > 0 || removedProviders.length > 0;
  }

  private async loadProviderModels(providers: ProviderProfile[]): Promise<void> {
    this.eventManager.sendProviderModelsUpdated({ loading: true });

    // Group providers by their provider name
    const providersByName: Record<LlmProviderName, ProviderProfile[]> = {} as Record<LlmProviderName, ProviderProfile[]>;
    for (const provider of providers || []) {
      if (!providersByName[provider.provider.name]) {
        providersByName[provider.provider.name] = [];
      }
      providersByName[provider.provider.name].push(provider);
    }

    const toLoadPromises: Promise<void>[] = [];

    for (const providerName of Object.keys(providersByName) as LlmProviderName[]) {
      const profilesForProvider = providersByName[providerName];
      const strategy = this.providerRegistry[providerName];

      if (strategy && profilesForProvider.length > 0) {
        const loadModels = async () => {
          // Load models from each profile for this provider type
          for (const profile of profilesForProvider) {
            // Skip disabled providers
            if (profile.disabled) {
              logger.debug(`Skipping disabled provider profile ${profile.id}`);
              continue;
            }

            let providerModels: Model[] = [];
            const response = await strategy.loadModels(profile, this.store.getSettings());

            delete this.providerErrors[profile.id];
            if (response.success) {
              providerModels.push(...response.models);
            } else {
              if (response.error) {
                logger.error(`Failed to load models for provider profile ${profile.id}:`, {
                  error: response.error,
                });
                this.providerErrors[profile.id] = response.error;
              } else {
                logger.warn(`Models for provider profile '${profile.id}' were not loaded due to misconfiguration.`);
              }
            }

            providerModels = this.enrichWithModelInfo(providerModels, profile, strategy);
            providerModels = this.enrichWithOverrides(providerModels, profile.id);

            this.providerModels[profile.id] = providerModels;
          }
        };

        toLoadPromises.push(loadModels());
      }
    }

    await Promise.all(toLoadPromises);

    // Emit the updated provider models event
    this.eventManager.sendProviderModelsUpdated({
      models: Object.values(this.providerModels).flat(),
      loading: false,
      errors: this.providerErrors,
    });

    // Update agent profiles with the new models
    // Note: agent profiles are now file-based, so this update is handled differently
    this.eventManager.sendSettingsUpdated(this.store.getSettings());
  }

  private enrichWithModelInfo(models: Model[], profile: ProviderProfile, strategy: LlmProviderStrategy): Model[] {
    const enrichedModels = [...models];

    for (const model of enrichedModels) {
      if (strategy.getModelInfo) {
        const modelInfo = strategy.getModelInfo(profile, model.id, this.modelsInfo);
        if (modelInfo) {
          logger.debug(`Enriching model ${model.id} with info`, modelInfo);

          model.maxInputTokens = model.maxInputTokens ?? modelInfo.maxInputTokens;
          model.maxOutputTokensLimit = model.maxOutputTokensLimit ?? modelInfo.maxOutputTokens;
          model.inputCostPerToken = model.inputCostPerToken ?? modelInfo.inputCostPerToken;
          model.outputCostPerToken = model.outputCostPerToken ?? modelInfo.outputCostPerToken;
          model.cacheWriteInputTokenCost = model.cacheWriteInputTokenCost ?? modelInfo.cacheWriteInputTokenCost;
          model.cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? modelInfo.cacheReadInputTokenCost;

          // remove temperature if model does not support it
          if (modelInfo.useTemperature === false) {
            model.temperature = undefined;
          }
        }
      }
    }

    return enrichedModels;
  }

  private enrichWithOverrides(models: Model[], providerId: string): Model[] {
    const enrichedModels = [...models];
    const providerModelOverrides = this.modelOverrides.filter((modelOverride) => modelOverride.providerId === providerId);

    for (const modelOverride of providerModelOverrides) {
      const existingIndex = enrichedModels.findIndex((model) => model.id === modelOverride.id);
      if (existingIndex >= 0) {
        const cleanedOverride = Object.fromEntries(Object.entries(modelOverride).filter(([_, value]) => value !== undefined));
        logger.debug(`Overriding model: ${providerId}/${modelOverride.id}`, {
          existing: enrichedModels[existingIndex],
          override: modelOverride,
          cleanedOverrides: cleanedOverride,
        });

        enrichedModels[existingIndex] = {
          ...enrichedModels[existingIndex],
          ...cleanedOverride,
          // maxOutputTokens and temperature should be also overridden by undefined values
          maxOutputTokens: cleanedOverride.maxOutputTokens,
          temperature: cleanedOverride.temperature,
          isCustom: false,
          hasModelOverrides: Object.keys(cleanedOverride).length > 0,
        };
      } else if (modelOverride.isCustom) {
        enrichedModels.push({ ...modelOverride });
      }
    }

    return enrichedModels;
  }

  /**
   * Detect and add automatic providers from environment variables
   */
  private updateEnvVarsProviders() {
    let providers = this.store.getProviders();
    const existingNames = new Set(providers.map((provider) => provider.provider.name));
    const envVarProviders: ProviderProfile[] = [];

    for (const providerName of AVAILABLE_PROVIDERS) {
      if (!existingNames.has(providerName)) {
        const strategy = this.providerRegistry[providerName];
        if (strategy?.hasEnvVars(this.store.getSettings())) {
          envVarProviders.push(this.createEnvVarProvider(providerName));
        }
      }
    }

    if (envVarProviders.length > 0) {
      providers = [...providers, ...envVarProviders];
      this.store.setProviders(providers);
      logger.info(`Added ${envVarProviders.length} auto-detected providers`);
    }
  }

  async getProviderModels(reload = false): Promise<ProviderModelsData> {
    await this.initPromise;

    if (reload || Object.keys(this.providerModels).length === 0) {
      // Clear cached models if reloading
      if (reload) {
        this.providerModels = {};
        this.providerErrors = {};
      }
      // Load models from all enabled providers
      await this.loadProviderModels(this.store.getProviders().filter((p) => !p.disabled));
    }

    return {
      models: Object.values(this.providerModels).flat(),
      loading: false,
      errors: this.providerErrors,
    };
  }

  private async loadModelOverrides(): Promise<void> {
    try {
      await fs.access(MODELS_FILE);
    } catch {
      logger.info('Custom models file does not exist yet. No custom models loaded.');
      this.modelOverrides = [];
      return;
    }

    try {
      const content = await fs.readFile(MODELS_FILE, 'utf-8');
      const modelsFile: ModelOverrides = JSON.parse(content);
      this.modelOverrides = modelsFile.models;
      logger.info(`Loaded ${this.modelOverrides.length} model overrides.`);
    } catch (error) {
      logger.error('Error loading model overrides:', error);
      this.modelOverrides = [];
    }
  }

  private async saveModelOverrides(): Promise<void> {
    try {
      const modelOverrides: ModelOverrides = {
        version: 1,
        models: this.modelOverrides || [],
      };

      await fs.mkdir(path.dirname(MODELS_FILE), { recursive: true });
      await fs.writeFile(MODELS_FILE, JSON.stringify(modelOverrides, null, 2));
      logger.info(`Saved ${this.modelOverrides?.length || 0} model overrides.`);
    } catch (error) {
      logger.error('Error saving model overrides:', error);
      throw error;
    }
  }

  async upsertModel(providerId: string, modelId: string, model: Model): Promise<void> {
    await this.initPromise;

    if (!this.modelOverrides) {
      this.modelOverrides = [];
    }

    const existingIndex = this.modelOverrides.findIndex((m) => m.id === modelId && m.providerId === providerId);

    const modelOverride: Model = {
      ...model,
      id: modelId,
      providerId,
    };

    if (existingIndex >= 0) {
      this.modelOverrides[existingIndex] = modelOverride;
      logger.info(`Updated model override: ${providerId}/${modelId}`);
    } else {
      this.modelOverrides.push(modelOverride);
      logger.info(`Added model override: ${providerId}/${modelId}`);
    }

    await this.saveModelOverrides();
    await this.loadProviderModels(this.store.getProviders().filter((provider) => provider.id === providerId));
  }

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await this.initPromise;

    if (!this.modelOverrides) {
      return;
    }

    const initialLength = this.modelOverrides.length;
    this.modelOverrides = this.modelOverrides.filter((m) => !(m.id === modelId && m.providerId === providerId && m.isCustom));

    if (this.modelOverrides.length < initialLength) {
      await this.saveModelOverrides();
      logger.info(`Deleted model override: ${providerId}/${modelId}`);
      await this.loadProviderModels(this.store.getProviders().filter((provider) => provider.id === providerId));
    } else {
      logger.warn(`Model override not found for deletion: ${providerId}/${modelId}`);
    }
  }

  async updateModels(modelUpdates: Array<{ providerId: string; modelId: string; model: Model }>): Promise<void> {
    await this.initPromise;

    if (!this.modelOverrides) {
      this.modelOverrides = [];
    }

    const affectedProviderIds = new Set<string>();

    for (const { providerId, modelId, model } of modelUpdates) {
      const existingIndex = this.modelOverrides.findIndex((m) => m.id === modelId && m.providerId === providerId);

      const modelOverride: Model = {
        ...model,
        id: modelId,
        providerId,
      };

      if (existingIndex >= 0) {
        this.modelOverrides[existingIndex] = modelOverride;
        logger.info(`Updated model override: ${providerId}/${modelId}`);
      } else {
        this.modelOverrides.push(modelOverride);
        logger.info(`Added model override: ${providerId}/${modelId}`);
      }

      affectedProviderIds.add(providerId);
    }

    await this.saveModelOverrides();

    // Reload models for all affected providers at once
    const affectedProviders = this.store.getProviders().filter((provider) => affectedProviderIds.has(provider.id));
    await this.loadProviderModels(affectedProviders);

    logger.info(`Bulk updated ${modelUpdates.length} model overrides for ${affectedProviderIds.size} providers`);
  }

  getAiderModelMapping(modelName: string, projectDir: string): AiderModelMapping {
    const providers = this.store.getProviders();
    const [providerId, modelId] = extractProviderModel(modelName);
    if (!providerId || !modelId) {
      logger.error('Invalid provider/model format:', modelName);
      return {
        modelName: modelName,
        environmentVariables: {},
      };
    }

    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      logger.debug('Provider not found:', providerId, '- returning modelName with empty env vars');
      return {
        modelName: modelName,
        environmentVariables: {},
      };
    }

    return this.getProviderAiderMapping(provider, modelId, projectDir);
  }

  private getProviderAiderMapping(provider: ProviderProfile, modelId: string, projectDir: string): AiderModelMapping {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      return {
        modelName: modelId,
        environmentVariables: {},
      };
    }

    return strategy.getAiderMapping(provider, modelId, this.store.getSettings(), projectDir);
  }

  getModelSettings(providerId: string, modelId: string, useModelInfoFallback = false): Model | undefined {
    let model: Model | undefined;
    const providerModels = this.providerModels[providerId];
    if (providerModels) {
      model = providerModels.find((m) => m.id === modelId);
    }

    if (!model && useModelInfoFallback) {
      const modelInfo = this.getModelInfo(`${providerId}/${modelId}`);
      if (modelInfo) {
        model = {
          id: modelId,
          providerId: providerId,
          ...modelInfo,
        };
      }
    }

    return model;
  }

  createLlm(
    provider: ProviderProfile,
    model: string | Model,
    settings: SettingsData,
    projectDir: string,
    toolSet?: ToolSet,
    systemPrompt?: string,
    providerMetadata?: unknown,
  ): LanguageModelV2 | Promise<LanguageModelV2> {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${provider.provider.name}`);
    }

    // Resolve Model object if string is provided
    let modelObj: Model | undefined;
    if (typeof model === 'string') {
      modelObj = this.getModelSettings(provider.id, model);
      if (!modelObj) {
        // Fallback to creating a minimal Model object if not found
        modelObj = {
          id: model,
          providerId: provider.id,
        };
      }
    } else {
      modelObj = model;
    }

    if (!modelObj) {
      throw new Error(`Model not found: ${model}`);
    }

    return strategy.createLlm(provider, modelObj, settings, projectDir, toolSet, systemPrompt, providerMetadata);
  }

  getUsageReport(task: Task, provider: ProviderProfile, model: string | Model, usage: LanguageModelUsage, providerMetadata?: unknown): UsageReportData {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${provider.provider.name}`);
    }

    // Resolve Model object
    let modelObj: Model | undefined;
    if (typeof model === 'string') {
      modelObj = this.getModelSettings(provider.id, model, true);
    } else {
      modelObj = model;
    }

    if (!modelObj) {
      throw new Error(`Model not found: ${model}`);
    }

    return strategy.getUsageReport(task, provider, modelObj, usage, providerMetadata);
  }

  getCacheControl(profile: AgentProfile, llmProvider: LlmProvider): CacheControl | undefined {
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getCacheControl) {
      return undefined;
    }
    return strategy.getCacheControl(profile, llmProvider);
  }

  isStreamingDisabled(provider: ProviderProfile, modelId: string): boolean {
    const llmProvider = provider.provider;
    const models = this.providerModels[provider.id] || [];
    const modelObj = models.find((m) => m.id === modelId);

    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${provider.id}, using provider settings for streaming`, {
        modelId,
        providerId: provider.id,
        streamingDisabled: llmProvider.disableStreaming,
      });
      return llmProvider.disableStreaming ?? false;
    }

    return typeof modelObj.providerOverrides?.disableStreaming === 'boolean'
      ? modelObj.providerOverrides.disableStreaming
      : (llmProvider.disableStreaming ?? false);
  }

  getProviderOptions(provider: ProviderProfile, modelId: string): Record<string, Record<string, JSONValue>> | undefined {
    const llmProvider = provider.provider;
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderOptions) {
      return undefined;
    }

    // Look up the actual Model object from providerModels
    const models = this.providerModels[provider.id] || [];
    const modelObj = models.find((m) => m.id === modelId);

    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${provider.id}, using fallback without model overrides`, {
        modelId,
        providerId: provider.id,
        availableModels: models.map((m) => m.id),
      });
      const fallbackModel: Model = {
        id: modelId,
        providerId: provider.id,
      };
      return strategy.getProviderOptions(llmProvider, fallbackModel);
    }

    logger.debug(`Found model object for ${modelId} in provider ${provider.id}`, {
      hasProviderOverrides: !!modelObj.providerOverrides,
    });

    return strategy.getProviderOptions(llmProvider, modelObj);
  }

  getProviderParameters(provider: ProviderProfile, modelId: string): Record<string, unknown> {
    const llmProvider = provider.provider;
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderParameters) {
      return {};
    }

    // Look up the actual Model object from providerModels
    const models = this.providerModels[provider.id] || [];
    const modelObj = models.find((m) => m.id === modelId);

    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${provider.id}, using fallback without model overrides`, {
        modelId,
        providerId: provider.id,
        availableModels: models.map((m) => m.id),
      });
      const fallbackModel: Model = {
        id: modelId,
        providerId: provider.id,
      };
      return strategy.getProviderParameters(llmProvider, fallbackModel);
    }

    logger.debug(`Found model object for ${modelId} in provider ${provider.id}`, {
      hasProviderOverrides: !!modelObj.providerOverrides,
    });

    return strategy.getProviderParameters(llmProvider, modelObj);
  }

  /**
   * Returns provider-specific tools for the given provider and model
   */
  async getProviderTools(provider: ProviderProfile, modelId: string): Promise<ToolSet> {
    const llmProvider = provider.provider;
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderTools) {
      return {};
    }

    // Resolve Model object
    const modelObj = this.getModelSettings(provider.id, modelId);
    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${llmProvider.name}`);
      return {};
    }

    return strategy.getProviderTools(llmProvider, modelObj);
  }

  /**
   * Creates a voice session if supported by the provider
   */
  async createVoiceSession(provider: ProviderProfile): Promise<VoiceSession> {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy?.createVoiceSession) {
      throw new Error(`Voice not supported for provider: ${provider.provider.name}`);
    }

    return await strategy.createVoiceSession(provider, this.store.getSettings());
  }

  /**
   * Normalizes messages for provider-specific requirements
   */
  normalizeMessages(provider: ProviderProfile, model: string | Model, messages: ModelMessage[]): ModelMessage[] {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy?.normalizeMessages) {
      return messages;
    }

    // Resolve Model object
    let modelObj: Model | undefined;
    if (typeof model === 'string') {
      modelObj = this.getModelSettings(provider.id, model);
    } else {
      modelObj = model;
    }

    if (!modelObj) {
      logger.warn(`Model not found for normalization: ${model}`);
      return messages;
    }

    return strategy.normalizeMessages(provider.provider, modelObj, messages);
  }

  /**
   * Determines if an error is retryable for the given provider and model
   * Defaults to true (retryable) if the provider doesn't implement isRetryable
   */
  isRetryable(provider: ProviderProfile, _modelId: string, error: unknown): boolean {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy?.isRetryable) {
      // Default to retryable if provider doesn't implement this method
      return true;
    }

    return strategy.isRetryable(error);
  }
}
