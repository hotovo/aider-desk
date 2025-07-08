import { ModelInfo } from '@common/types';

import logger from '@/logger';

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

export class ModelInfoManager {
  private readonly modelInfo: Record<string, ModelInfo> = {};
  private readonly initPromise: Promise<void>;
  private resolveInitPromise!: () => void;
  private rejectInitPromise!: (reason?: Error | undefined) => void;

  constructor() {
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.resolveInitPromise = resolve;
      this.rejectInitPromise = reject;
    });
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing ModelInfoManager...');
      const response = await fetch(MODEL_INFO_URL);
      if (!response.ok) {
        logger.error('Failed to fetch model info:', {
          status: response.status,
          statusText: response.statusText,
        });
        this.rejectInitPromise();
        return;
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

        this.modelInfo[modelName] = {
          maxInputTokens: modelData.max_input_tokens,
          maxOutputTokens: modelData.max_output_tokens,
          inputCostPerToken: modelData.input_cost_per_token,
          outputCostPerToken: modelData.output_cost_per_token,
          cacheReadInputTokenCost: modelData.cache_read_input_token_cost,
          supportsTools: modelData.supports_function_calling === true,
        };
      }
      logger.info('ModelInfoManager initialized successfully.', {
        modelCount: Object.keys(this.modelInfo).length,
      });
      this.resolveInitPromise();
    } catch (error) {
      logger.error('Error initializing ModelInfoManager:', error);
      this.rejectInitPromise(error as Error);
      // Decide how to handle the error, e.g., retry, use cached data, or throw
    }
  }

  getModelInfo(modelName: string): ModelInfo | undefined {
    const modelParts = modelName.split('/');
    return this.modelInfo[modelParts[modelParts.length - 1]];
  }

  async getAllModelsInfo(): Promise<Record<string, ModelInfo>> {
    await Promise.allSettled([this.initPromise]);
    return this.modelInfo;
  }
}
