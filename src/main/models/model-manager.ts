import { ModelInfo, ProviderModels, SettingsData } from '@common/types';
import { AVAILABLE_PROVIDERS, LlmProviderName } from '@common/agent';

import { loadOllamaModels } from './providers/ollama';
import { loadLmStudioModels } from './providers/lm-studio';
import { loadOpenAiModels } from './providers/openai';
import { loadAnthropicModels } from './providers/anthropic';
import { loadGeminiModels } from './providers/gemini';
import { loadBedrockModels } from './providers/bedrock';
import { loadDeepseekModels } from './providers/deepseek';
import { loadGroqModels } from './providers/groq';
import { loadCerebrasModels } from './providers/cerebras';
import { loadOpenaiCompatibleModels } from './providers/openai-compatible';
import { loadOpenrouterModels } from './providers/openrouter';
import { loadRequestyModels } from './providers/requesty';
import { loadVertexAIModels } from './providers/vertex-ai';

import logger from '@/logger';
import { Store } from '@/store';
import { EventManager } from '@/events';

const MODEL_INFO_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

interface RawModelData {
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  supports_function_calling?: boolean;
  cache_read_input_token_cost?: number;
  // Add other fields from the JSON if needed, marking them as optional
}

export class ModelManager {
  private readonly modelsInfo: Record<string, ModelInfo> = {};
  private providerModels?: ProviderModels;
  private readonly initPromise: Promise<void>;

  constructor(
    private store: Store,
    private eventManager: EventManager,
  ) {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      logger.info('Initializing ModelInfoManager...');

      await Promise.all([this.fetchAndProcessModelInfo(), this.loadProviderModels()]);

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

      const modelName = key.includes('/') ? key.substring(key.lastIndexOf('/') + 1) : key;

      this.modelsInfo[modelName] = {
        maxInputTokens: modelData.max_input_tokens,
        maxOutputTokens: modelData.max_output_tokens,
        inputCostPerToken: modelData.input_cost_per_token,
        outputCostPerToken: modelData.output_cost_per_token,
        cacheReadInputTokenCost: modelData.cache_read_input_token_cost,
        supportsTools: modelData.supports_function_calling === true,
      };
    }
  }

  getModelInfo(modelName: string): ModelInfo | undefined {
    const modelParts = modelName.split('/');
    return this.modelsInfo[modelParts[modelParts.length - 1]];
  }

  private getChangedProviders(oldProviders: Record<string, unknown>, newProviders: Record<string, unknown>): LlmProviderName[] {
    return AVAILABLE_PROVIDERS.filter((key) => JSON.stringify(oldProviders?.[key]) !== JSON.stringify(newProviders?.[key]));
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    const changedProviders = this.getChangedProviders(oldSettings.llmProviders, newSettings.llmProviders);
    if (changedProviders.length === 0) {
      return false;
    }

    await this.initPromise;
    await this.loadProviderModels(changedProviders);

    return true;
  }

  async getAllModelsInfo(): Promise<Record<string, ModelInfo>> {
    await Promise.allSettled([this.initPromise]);
    return this.modelsInfo;
  }

  private async loadProviderModels(providersToLoad: LlmProviderName[] = AVAILABLE_PROVIDERS): Promise<void> {
    if (!this.providerModels) {
      if (providersToLoad) {
        providersToLoad = AVAILABLE_PROVIDERS; // do full reload
      }
    }

    const settings = this.store.getSettings();
    const updatedProviderModels: Partial<ProviderModels> = {};

    const providerLoaders: Record<LlmProviderName, () => Promise<void>> = {
      anthropic: async () => {
        updatedProviderModels.anthropic = await loadAnthropicModels(settings, this.modelsInfo);
      },
      bedrock: async () => {
        updatedProviderModels.bedrock = await loadBedrockModels(settings, this.modelsInfo);
      },
      deepseek: async () => {
        updatedProviderModels.deepseek = await loadDeepseekModels(settings, this.modelsInfo);
      },
      gemini: async () => {
        updatedProviderModels.gemini = await loadGeminiModels(settings, this.modelsInfo);
      },
      groq: async () => {
        updatedProviderModels.groq = await loadGroqModels(settings, this.modelsInfo);
      },
      cerebras: async () => {
        updatedProviderModels.cerebras = await loadCerebrasModels(settings, this.modelsInfo);
      },
      lmstudio: async () => {
        updatedProviderModels.lmstudio = await loadLmStudioModels(settings, this.modelsInfo);
      },
      ollama: async () => {
        updatedProviderModels.ollama = await loadOllamaModels(settings, this.modelsInfo);
      },
      'openai-compatible': async () => {
        updatedProviderModels['openai-compatible'] = await loadOpenaiCompatibleModels(settings, this.modelsInfo);
      },
      openai: async () => {
        updatedProviderModels.openai = await loadOpenAiModels(settings, this.modelsInfo);
      },
      openrouter: async () => {
        updatedProviderModels.openrouter = await loadOpenrouterModels(settings, this.modelsInfo);
      },
      requesty: async () => {
        updatedProviderModels.requesty = await loadRequestyModels(settings, this.modelsInfo);
      },
      'vertex-ai': async () => {
        updatedProviderModels['vertex-ai'] = await loadVertexAIModels(settings, this.modelsInfo);
      },
    };

    const toLoadPromises: Promise<void>[] = [];
    for (const key of providersToLoad) {
      if (providerLoaders[key]) {
        toLoadPromises.push(providerLoaders[key]());
      }
    }
    await Promise.all(toLoadPromises);

    this.providerModels = {
      ...(this.providerModels || {}),
      ...updatedProviderModels,
    } as ProviderModels;

    // Emit the updated provider models event
    this.eventManager.sendProviderModelsUpdated(this.providerModels);
  }

  async getProviderModels(): Promise<ProviderModels> {
    await this.initPromise;
    if (!this.providerModels) {
      // Fallback in case loading failed during init
      await this.loadProviderModels();
    }
    if (!this.providerModels) {
      throw new Error('Failed to load provider models');
    }
    return this.providerModels;
  }
}
