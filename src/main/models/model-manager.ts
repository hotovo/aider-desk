import { promises as fs } from 'fs';
import path from 'path';

import { AVAILABLE_PROVIDERS, getDefaultProviderParams, LlmProvider, LlmProviderName } from '@common/agent';
import { AgentProfile, Model, ModelInfo, ModelOverrides, ProviderModelsData, ProviderProfile, UsageReportData } from '@common/types';

import { ollamaProviderStrategy } from './providers/ollama';
import { lmStudioProviderStrategy } from './providers/lm-studio';
import { openaiProviderStrategy } from './providers/openai';
import { anthropicProviderStrategy } from './providers/anthropic';
import { geminiProviderStrategy } from './providers/gemini';
import { bedrockProviderStrategy } from './providers/bedrock';
import { cerebrasProviderStrategy } from './providers/cerebras';
import { deepseekProviderStrategy } from './providers/deepseek';
import { groqProviderStrategy } from './providers/groq';
import { openaiCompatibleProviderStrategy } from './providers/openai-compatible';
import { openrouterProviderStrategy } from './providers/openrouter';
import { requestyProviderStrategy } from './providers/requesty';
import { vertexAiProviderStrategy } from './providers/vertex-ai';

import type { JSONValue, LanguageModel, LanguageModelUsage } from 'ai';

import { AIDER_DESK_DATA_DIR } from '@/constants';
import logger from '@/logger';
import { Store } from '@/store';
import { EventManager } from '@/events';
import { Project } from '@/project/project';
import { AiderModelMapping, CacheControl, LlmProviderRegistry } from '@/models/types';

const MODEL_INFO_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const MODELS_FILE = path.join(AIDER_DESK_DATA_DIR, 'models.json');

interface RawModelData {
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  supports_function_calling?: boolean;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
  // Add other fields from the JSON if needed, marking them as optional
}

export class ModelManager {
  private readonly modelsInfo: Record<string, ModelInfo> = {};
  private readonly initPromise: Promise<void>;
  private providerModels: Record<string, Model[]> = {};
  private providerErrors: Record<string, string> = {};
  private modelOverrides: Model[] = [];

  // Provider registry for strategy pattern
  private providerRegistry: LlmProviderRegistry = {
    anthropic: anthropicProviderStrategy,
    openai: openaiProviderStrategy,
    gemini: geminiProviderStrategy,
    'vertex-ai': vertexAiProviderStrategy,
    deepseek: deepseekProviderStrategy,
    groq: groqProviderStrategy,
    cerebras: cerebrasProviderStrategy,
    lmstudio: lmStudioProviderStrategy,
    'openai-compatible': openaiCompatibleProviderStrategy,
    bedrock: bedrockProviderStrategy,
    ollama: ollamaProviderStrategy,
    openrouter: openrouterProviderStrategy,
    requesty: requestyProviderStrategy,
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

      await this.fetchAndProcessModelInfo();
      await this.loadModelOverrides();
      await this.loadProviderModels(this.store.getProviders());

      logger.info('ModelInfoManager initialized successfully.', {
        modelCount: Object.keys(this.modelsInfo).length,
      });
    } catch (error) {
      logger.error('Error initializing ModelInfoManager:', error);
    }
  }

  private async fetchAndProcessModelInfo(): Promise<void> {
    const response = await fetch(MODEL_INFO_URL);
    if (!response.ok) {
      logger.error('Failed to fetch model info:', {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error('Failed to fetch model info');
    }
    const data = (await response.json()) as Record<string, RawModelData>;

    for (const key in data) {
      if (key === 'sample_spec') {
        // Skip the sample_spec entry
        continue;
      }
      if (key.startsWith('wandb/')) {
        // Ignore wandb/ models
        continue;
      }

      const modelData = data[key];
      // Ensure modelData is not undefined and has the expected properties
      if (
        !modelData ||
        typeof modelData.max_input_tokens === 'undefined' ||
        typeof modelData.max_output_tokens === 'undefined' ||
        typeof modelData.input_cost_per_token === 'undefined' ||
        typeof modelData.output_cost_per_token === 'undefined'
      ) {
        // console.warn(`Skipping model ${key} due to missing or invalid data`);
        continue;
      }

      const modelName = key.split('/').pop() || key;

      this.modelsInfo[modelName] = {
        maxInputTokens: modelData.max_input_tokens,
        maxOutputTokens: modelData.max_output_tokens,
        inputCostPerToken: modelData.input_cost_per_token,
        outputCostPerToken: modelData.output_cost_per_token,
        cacheReadInputTokenCost: modelData.cache_read_input_token_cost,
        cacheWriteInputTokenCost: modelData.cache_creation_input_token_cost,
        supportsTools: modelData.supports_function_calling === true,
      };
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
            const response = await strategy.loadModels(profile, this.modelsInfo);

            delete this.providerErrors[profile.id];
            if (response.success) {
              allModels.push(...response.models);
            } else {
              logger.error(`Failed to load models for provider profile ${profile.id}:`, response.error);
              if (response.error) {
                this.providerErrors[profile.id] = response.error;
              }
            }

            // Add custom models or override existing ones
            const providerModelOverrides = this.modelOverrides.filter((modelOverride) => modelOverride.providerId === profile.id);
            for (const modelOverride of providerModelOverrides) {
              const existingIndex = allModels.findIndex((m) => m.id === modelOverride.id);
              if (existingIndex >= 0) {
                allModels[existingIndex] = { ...allModels[existingIndex], ...modelOverride };
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
    this.eventManager.sendProviderModelsUpdated({ models: Object.values(this.providerModels).flat(), loading: false, errors: this.providerErrors });

    // Update agent profiles with the new models
    await this.store.updateProviderModelInAgentProfiles(Object.values(this.providerModels).flat());
    this.eventManager.sendSettingsUpdated(this.store.getSettings());
  }

  /**
   * Detect and add automatic providers from environment variables
   */
  private updateEnvVarsProviders() {
    let providers = this.store.getProviders();
    const existingNames = new Set(providers.map((p) => p.provider.name));
    const envVarProviders: ProviderProfile[] = [];

    for (const providerName of AVAILABLE_PROVIDERS) {
      if (!existingNames.has(providerName)) {
        const strategy = this.providerRegistry[providerName];
        if (strategy?.hasEnvVars()) {
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

    return { models: Object.values(this.providerModels).flat(), loading: false, errors: this.providerErrors };
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
    this.eventManager.sendProviderModelsUpdated({ loading: true });
    await this.loadProviderModels(this.store.getProviders().filter((provider) => provider.id === providerId));
    this.eventManager.sendProviderModelsUpdated(await this.getProviderModels());
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
      this.eventManager.sendProviderModelsUpdated({ loading: true });
      await this.loadProviderModels(this.store.getProviders().filter((provider) => provider.id === providerId));
      this.eventManager.sendProviderModelsUpdated(await this.getProviderModels());
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

  createLlm(profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel {
    const strategy = this.providerRegistry[profile.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${profile.provider.name}`);
    }
    return strategy.createLlm(profile, model, env);
  }

  calculateCost(provider: ProviderProfile, model: string, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${provider.provider.name}`);
    }
    return strategy.calculateCost(this.getModelInfo(model), sentTokens, receivedTokens, providerMetadata);
  }

  getUsageReport(
    project: Project,
    provider: ProviderProfile,
    modelId: string,
    messageCost: number,
    usage: LanguageModelUsage,
    providerMetadata?: unknown,
  ): UsageReportData {
    const strategy = this.providerRegistry[provider.provider.name];
    if (!strategy) {
      throw new Error(`Unsupported LLM provider: ${provider.provider.name}`);
    }
    return strategy.getUsageReport(project, provider, modelId, messageCost, usage, providerMetadata);
  }

  getCacheControl(profile: AgentProfile, llmProvider: LlmProvider): CacheControl {
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getCacheControl) {
      return undefined;
    }
    return strategy.getCacheControl(profile, llmProvider);
  }

  getProviderOptions(llmProvider: LlmProvider): Record<string, Record<string, JSONValue>> | undefined {
    const strategy = this.providerRegistry[llmProvider.name];
    if (!strategy?.getProviderOptions) {
      return undefined;
    }
    return strategy.getProviderOptions(llmProvider);
  }
}
