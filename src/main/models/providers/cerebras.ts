import { SettingsData, Model, ModelInfo } from '@common/types';
import { CerebrasProvider, getLlmProviderConfig } from '@common/agent';

import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import logger from '@/logger';

interface CerebrasModel {
  id: string;
  max_context_length?: number;
  description?: string;
}

export const loadCerebrasModels = async (settings: SettingsData, modelsInfo: Record<string, ModelInfo>): Promise<Model[]> => {
  const cerebrasProvider = getLlmProviderConfig('cerebras', settings) as CerebrasProvider;
  const apiKeyEnv = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', undefined, settings);
  const apiKey = cerebrasProvider.apiKey || apiKeyEnv?.value;

  if (!apiKey) {
    logger.debug('Cerebras API key not found, skipping model loading');
    return [];
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logger.warn(`Failed to fetch Cerebras models: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      logger.warn('Invalid response format from Cerebras models API');
      return [];
    }

    const models: Model[] = data.data.map((model: CerebrasModel) => {
      const info = modelsInfo[model.id];

      return {
        ...info,
        id: model.id,
        maxInputTokens: model.max_context_length || info?.maxInputTokens,
      } satisfies Model;
    });

    logger.debug(`Loaded ${models.length} Cerebras models`);
    return models;
  } catch (error) {
    logger.warn('Failed to load Cerebras models:', error);
    return [];
  }
};
