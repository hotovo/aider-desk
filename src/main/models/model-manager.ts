import { promises as fs } from 'fs';
import path from 'path';

import { AVAILABLE_PROVIDERS, getDefaultProviderParams, LlmProvider, LlmProviderName } from '@common/agent';
import { AgentProfile, Model, ModelInfo, SettingsData, ModelOverrides, ProviderModelsData, ProviderProfile, UsageReportData } from '@common/types';

import { anthropicProviderStrategy } from './providers/anthropic';
import { azureProviderStrategy } from './providers/azure';
import { bedrockProviderStrategy } from './providers/bedrock';
import { cerebrasProviderStrategy } from './providers/cerebras';
import { deepseekProviderStrategy } from './providers/deepseek';
import { geminiProviderStrategy } from './providers/gemini';
import { groqProviderStrategy } from './providers/groq';
import { lmStudioProviderStrategy } from './providers/lm-studio';
import { ollamaProviderStrategy } from './providers/ollama';
import { openaiProviderStrategy } from './providers/openai';
import { openaiCompatibleProviderStrategy } from './providers/openai-compatible';
import { openrouterProviderStrategy } from './providers/openrouter';
import { requestyProviderStrategy } from './providers/requesty';
import { vertexAiProviderStrategy } from './providers/vertex-ai';
import { zaiPlanProviderStrategy } from './providers/zai-plan';

import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { LanguageModelUsage, ToolSet, JSONValue } from 'ai';

import { AIDER_DESK_DATA_DIR, AIDER_DESK_CACHE_DIR } from '@/constants';
import logger from '@/logger';
import { Store } from '@/store';
import { EventManager } from '@/events';
import { Task } from '@/task/task';
import { AiderModelMapping, CacheControl, LlmProviderRegistry } from '@/models/types';

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
    azure: azureProviderStrategy,
    bedrock: bedrockProviderStrategy,
    cerebras: cerebrasProviderStrategy,
    deepseek: deepseekProviderStrategy,
    gemini: geminiProviderStrategy,
    groq: groqProviderStrategy,
    lmstudio: lmStudioProviderStrategy,
    ollama: ollamaProviderStrategy,
    openai: openaiProviderStrategy,
    'openai-compatible': openaiCompatibleProviderStrategy,
    openrouter: openrouterProviderStrategy,
    requesty: requestyProviderStrategy,
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
      await this.loadProviderModels(this.store.getProviders());

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
        const modelData = providerData.models[modelKey];
        const existingModelInfo = this.modelsInfo[modelKey];

        if (existingModelInfo) {
          // Add properties only if they don't exist
          if (!existingModelInfo.maxInputTokens) {
            existingModelInfo.maxInputTokens = modelData.limit.context;
          }
          if (!existingModelInfo.maxOutputTokens) {
            existingModelInfo.maxOutputTokens = modelData.limit.output;
          }
          if (!existingModelInfo.inputCostPerToken && modelData.cost?.input) {
            existingModelInfo.inputCostPerToken = modelData.cost.input / 1_000_000;
          }
          if (!existingModelInfo.outputCostPerToken && modelData.cost?.output) {
            existingModelInfo.outputCostPerToken = modelData.cost.output / 1_000_000;
          }
          if (!existingModelInfo.cacheReadInputTokenCost && modelData.cost?.cache_read) {
            existingModelInfo.cacheReadInputTokenCost = modelData.cost.cache_read / 1_000_000;
          }
          if (!existingModelInfo.cacheWriteInputTokenCost && modelData.cost?.cache_write) {
            existingModelInfo.cacheReadInputTokenCost = modelData.cost.cache_write / 1_000_000;
          }
        } else {
          this.modelsInfo[modelData.id] = {
            maxInputTokens: modelData.limit.context,
            maxOutputTokens: modelData.limit.output,
            inputCostPerToken: (modelData.cost?.input || 0) / 1_000_000,
            outputCostPerToken: (modelData.cost?.output || 0) / 1_000_000,
            cacheReadInputTokenCost: modelData.cost?.cache_read ? modelData.cost.cache_read / 1_000_000 : undefined,
            cacheWriteInputTokenCost: modelData.cost?.cache_write ? modelData.cost.cache_write / 1_000_000 : undefined,
          } satisfies ModelInfo;
        }
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
    }

    const changedProviderProfiles = this.getChangedProviders(oldProviders, newProviders);
    await this.loadProviderModels(changedProviderProfiles);

    return changedProviderProfiles.length > 0 || removedProviders.length > 0;
  }

  async getAllModelsInfo(): Promise<Record<string, ModelInfo>> {
    await Promise.allSettled([this.initPromise]);
    return this.modelsInfo;
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
            const allModels: Model[] = [];
            const response = await strategy.loadModels(profile, this.modelsInfo, this.store.getSettings());

            delete this.providerErrors[profile.id];
            if (response.success) {
              allModels.push(...response.models);
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

            // Add custom models or override existing ones
            const providerModelOverrides = this.modelOverrides.filter((modelOverride) => modelOverride.providerId === profile.id);
            for (const modelOverride of providerModelOverrides) {
              const existingIndex = allModels.findIndex((m) => m.id === modelOverride.id);
              if (existingIndex >= 0) {
                const cleanedOverride = Object.fromEntries(Object.entries(modelOverride).filter(([_, value]) => value !== undefined));
                logger.debug(`Overriding model: ${profile.id}/${modelOverride.id}`, {
                  existing: allModels[existingIndex],
                  override: modelOverride,
                  cleanedOverrides: cleanedOverride,
                });

                allModels[existingIndex] = {
                  ...allModels[existingIndex],
                  ...cleanedOverride,
                  isCustom: false,
                  hasModelOverrides: Object.keys(cleanedOverride).length > 0,
                };
              } else if (modelOverride.isCustom) {
                allModels.push({ ...modelOverride });
              }
            }

            this.providerModels[profile.id] = allModels;
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
    await this.store.updateProviderModelInAgentProfiles(Object.values(this.providerModels).flat());
    this.eventManager.sendSettingsUpdated(this.store.getSettings());
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

  async getProviderModels(): Promise<ProviderModelsData> {
    await this.initPromise;
    if (Object.keys(this.providerModels).length === 0) {
      // Fallback in case loading failed during init
      await this.loadProviderModels(this.store.getProviders());
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

  getAiderModelMapping(modelName: string): AiderModelMapping {
    const providers = this.store.getProviders();
    const [providerId, ...modelIdParts] = modelName.split('/');
    const modelId = modelIdParts.join('/');
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

    return this.getProviderAiderMapping(provider, modelId);
  }

  private getProviderAiderMapping(provider: ProviderProfile, modelId: string): AiderModelMapping {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      return {
        modelName: modelId,
        environmentVariables: {},
      };
    }

    return strategy.getAiderMapping(provider, modelId);
  }

  getModel(providerId: string, modelId: string): Model | undefined {
    const providerModels = this.providerModels[providerId];
    if (!providerModels) {
      return undefined;
    }
    return providerModels.find((m) => m.id === modelId);
  }

  createLlm(profile: ProviderProfile, model: string | Model, settings: SettingsData, projectDir: string): LanguageModelV2 {
    const strategy = this.providerRegistry[profile.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${profile.provider.name}`);
    }

    // Resolve Model object if string is provided
    let modelObj: Model | undefined;
    if (typeof model === 'string') {
      modelObj = this.getModel(profile.id, model);
      if (!modelObj) {
        // Fallback to creating a minimal Model object if not found
        modelObj = {
          id: model,
          providerId: profile.id,
        };
      }
    } else {
      modelObj = model;
    }

    if (!modelObj) {
      throw new Error(`Model not found: ${model}`);
    }

    return strategy.createLlm(profile, modelObj, settings, projectDir);
  }

  getUsageReport(task: Task, provider: ProviderProfile, model: string | Model, usage: LanguageModelUsage, providerMetadata?: unknown): UsageReportData {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${provider.provider.name}`);
    }

    // Resolve Model object
    let modelObj: Model | undefined;
    if (typeof model === 'string') {
      modelObj = this.getModel(provider.id, model);
      if (!modelObj) {
        // Fallback to creating a minimal Model object if not found
        const modelInfo = this.getModelInfo(model);
        modelObj = {
          ...modelInfo,
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

    return strategy.getUsageReport(task, provider, modelObj, usage, providerMetadata);
  }

  getCacheControl(profile: AgentProfile, llmProvider: LlmProvider): CacheControl {
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getCacheControl) {
      return undefined;
    }
    return strategy.getCacheControl(profile, llmProvider);
  }

  getProviderOptions(llmProvider: LlmProvider, modelId: string): Record<string, Record<string, JSONValue>> | undefined {
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderOptions) {
      return undefined;
    }

    // Find the provider profile for this LLM provider
    const providers = this.store.getProviders();
    const providerProfile = providers.find((p) => p.provider.name === llmProvider.name);

    if (!providerProfile) {
      logger.warn(`Provider profile not found for ${llmProvider.name}, using fallback without model overrides`, {
        modelId,
        providerName: llmProvider.name,
      });
      const fallbackModel: Model = {
        id: modelId,
        providerId: '',
      };
      return strategy.getProviderOptions(llmProvider, fallbackModel);
    }

    // Look up the actual Model object from providerModels
    const models = this.providerModels[providerProfile.id] || [];
    const modelObj = models.find((m) => m.id === modelId);

    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${providerProfile.id}, using fallback without model overrides`, {
        modelId,
        providerId: providerProfile.id,
        availableModels: models.map((m) => m.id),
      });
      const fallbackModel: Model = {
        id: modelId,
        providerId: providerProfile.id,
      };
      return strategy.getProviderOptions(llmProvider, fallbackModel);
    }

    logger.debug(`Found model object for ${modelId} in provider ${providerProfile.id}`, {
      hasProviderOverrides: !!modelObj.providerOverrides,
    });

    return strategy.getProviderOptions(llmProvider, modelObj);
  }

  /**
   * Returns provider-specific tools for the given provider and model
   */
  async getProviderTools(providerId: string, modelId: string): Promise<ToolSet> {
    const providers = this.store.getProviders();
    const providerProfile = providers.find((p) => p.id === providerId);
    if (!providerProfile) {
      logger.warn(`Provider profile not found for ${providerId}`);
      return {};
    }
    const llmProvider = providerProfile.provider;
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderTools) {
      return {};
    }

    // Resolve Model object
    const modelObj = this.getModel(providerProfile.id, modelId);
    if (!modelObj) {
      logger.warn(`Model ${modelId} not found in provider ${llmProvider.name}`);
      return {};
    }

    return strategy.getProviderTools(llmProvider, modelObj);
  }
}
