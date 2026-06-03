import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

import type {
  Extension,
  ExtensionContext,
  LoadModelsResponse,
  Model,
  ProviderDefinition,
  ProviderProfile,
  SettingsData,
  AiderModelMapping,
  UsageReportData,
} from '@aiderdesk/extensions';

type AuggieSdkModule = typeof import('@augmentcode/auggie-sdk');

const AUGGIE_PROVIDER_NAME = 'auggie';

const AUGGIE_MODELS = [
  {
    id: 'claude-haiku-4-5',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 8192,
  },
  {
    id: 'claude-sonnet-4-6',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 16384,
  },
  {
    id: 'claude-opus-4-7',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'claude-opus-4-8',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  {
    id: 'claude-opus-4-7',
    maxInputTokens: 200000,
    maxOutputTokensLimit: 32768,
  },
  { id: 'gpt-5-2', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
  { id: 'gpt-5-4', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
  { id: 'gpt-5-5', maxInputTokens: 200000, maxOutputTokensLimit: 16384 },
];

type AuggieSessionCredentials = {
  apiKey: string;
  apiUrl: string;
};

const readAuggieSession = (context: ExtensionContext): AuggieSessionCredentials | null => {
  const sessionFilePath = path.join(homedir(), '.augment', 'session.json');

  if (!existsSync(sessionFilePath)) {
    context.log(
      'Auggie session file not found at ~/.augment/session.json. Please install the auggie CLI and run `auggie login`.',
      'error',
    );
    return null;
  }

  try {
    const raw = readFileSync(sessionFilePath, 'utf-8');
    const session = JSON.parse(raw) as { accessToken?: string; tenantURL?: string };

    if (!session.accessToken || !session.tenantURL) {
      context.log(
        'Auggie session file is missing required fields (accessToken, tenantURL). Please run `auggie login` again.',
        'error',
      );
      return null;
    }

    return { apiKey: session.accessToken, apiUrl: session.tenantURL };
  } catch {
    context.log(
      'Failed to read or parse Auggie session file. Please install the auggie CLI and run `auggie login`.',
      'error',
    );
    return null;
  }
};

export default class AuggieSdkExtension implements Extension {
  static metadata = {
    name: 'Auggie SDK',
    version: '1.0.0',
    description: 'Integrates the Auggie SDK as an LLM provider using the Augment platform',
    author: 'wladimiiir',
    iconUrl:
      'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/auggie-sdk/icon.png',
    capabilities: ['providers'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Auggie SDK extension loaded', 'info');
  }

  getProviders(context: ExtensionContext): ProviderDefinition[] {
    return [
      {
        id: AUGGIE_PROVIDER_NAME,
        name: 'Auggie SDK',
        provider: {
          name: AUGGIE_PROVIDER_NAME,
          apiKey: '',
          apiUrl: '',
        },
        strategy: {
          createLlm: async (profile: ProviderProfile, model: Model): Promise<unknown> => {
            const provider = profile.provider as { name: string; apiKey?: string; apiUrl?: string };
            let apiKey = provider.apiKey;
            let apiUrl = provider.apiUrl;

            if (!apiKey || !apiUrl) {
              const sessionCredentials = readAuggieSession(context);
              if (sessionCredentials) {
                apiKey = apiKey || sessionCredentials.apiKey;
                apiUrl = apiUrl || sessionCredentials.apiUrl;
              }
            }

            if (!apiKey || !apiUrl) {
              throw new Error('Auggie credentials not found. Install the auggie CLI and run `auggie login`.');
            }

            const auggieSdk: AuggieSdkModule = await import('@augmentcode/auggie-sdk');
            const { AugmentLanguageModel } = auggieSdk;

            return new AugmentLanguageModel(model.id, { apiKey, apiUrl });
          },

          loadModels: async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
            try {
              const models: Model[] = AUGGIE_MODELS.map((model) => ({
                id: model.id,
                providerId: profile.id,
                maxInputTokens: model.maxInputTokens,
                maxOutputTokensLimit: model.maxOutputTokensLimit,
              }));

              return { models, success: true };
            } catch (error) {
              const errorMsg =
                typeof error === 'string'
                  ? error
                  : error instanceof Error
                    ? error.message
                    : 'Unknown error loading Auggie SDK models';
              return { models: [], success: false, error: errorMsg };
            }
          },

          getAiderMapping: (provider: ProviderProfile, modelId: string): AiderModelMapping => {
            const auggieProvider = provider.provider as { name: string; apiKey?: string; apiUrl?: string };
            const envVars: Record<string, string> = {};

            const apiKey = auggieProvider.apiKey || readAuggieSession(context)?.apiKey;
            const apiUrl = auggieProvider.apiUrl || readAuggieSession(context)?.apiUrl;

            if (apiKey) {
              envVars.AUGMENT_API_TOKEN = apiKey;
            }
            if (apiUrl) {
              envVars.AUGMENT_API_URL = apiUrl;
            }

            return {
              modelName: `auggie/${modelId}`,
              environmentVariables: envVars,
            };
          },

          getUsageReport: (
            _task: unknown,
            _provider: ProviderProfile,
            model: Model,
          ): UsageReportData => {
            return {
              model: model.id,
              sentTokens: 0,
              receivedTokens: 0,
              messageCost: 0,
              agentTotalCost: 0,
            };
          },
        },
      },
    ];
  }
}
