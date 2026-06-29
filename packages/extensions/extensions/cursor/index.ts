import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type {
  Extension,
  ExtensionContext,
  LoadModelsResponse,
  Model,
  ProjectStoppedEvent,
  ProviderDefinition,
  ProviderProfile,
  SettingsData,
} from '@aiderdesk/extensions';

import { exchangeApiKeyForAccessToken, clearCachedToken } from './auth';
import {
  connectToProxy,
  pushToken,
  stopProxy,
  cleanupSession,
  type ProxyConnection,
  type ProxySpawnConfig,
} from './proxy-lifecycle';

type LogFn = (message: string, type?: 'info' | 'error' | 'warn' | 'debug') => void;

interface CursorModel {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  supportsImages: boolean;
  contextWindowMaxMode?: number;
  supportsMaxMode?: boolean;
}

const CURSOR_PROVIDER_NAME = 'cursor';

export interface CursorConfig {
  apiKey: string;
  nativeToolsMode: 'reject' | 'redirect' | 'native';
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: CursorConfig = {
  apiKey: '',
  nativeToolsMode: 'reject',
  maxMode: false,
  fast: false,
  thinking: true,
  maxRetries: 2,
};

interface ProjectProxyState {
  connection: ProxyConnection | null;
  port: number | null;
  models: CursorModel[];
  conversationDir: string;
}

const configComponentJsx = existsSync(join(__dirname, 'ConfigComponent.jsx'))
  ? readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8')
  : '';

function toAiderDeskModels(models: CursorModel[], providerId: string): Model[] {
  return models.map((m) => ({
    id: m.id,
    providerId,
    ...(m.contextWindow ? { maxInputTokens: m.contextWindow } : {}),
    ...(m.maxTokens ? { maxOutputTokensLimit: m.maxTokens } : {}),
  }));
}

export default class CursorExtension implements Extension {
  static metadata = {
    name: 'Cursor',
    version: '1.1.0',
    description: 'Integrates Cursor as a provider via a local OpenAI-compatible proxy with full tool approval control',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/cursor/icon.png',
    capabilities: ['providers'],
  };

  private configPath = join(__dirname, 'config.json');
  private projectStates = new Map<string, ProjectProxyState>();

  private loadConfig(): CursorConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<CursorConfig>;
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // Ignore errors
    }
    return { ...DEFAULT_CONFIG };
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Cursor extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    for (const [, state] of this.projectStates) {
      if (state.connection) {
        stopProxy(state.connection, state.conversationDir);
      }
    }
    this.projectStates.clear();
  }

  async onProjectStopped(event: ProjectStoppedEvent): Promise<void> {
    const state = this.projectStates.get(event.baseDir);
    if (state?.connection) {
      await cleanupSession(state.connection.port, state.connection.sessionId).catch(() => {});
      stopProxy(state.connection, state.conversationDir);
    }
    this.projectStates.delete(event.baseDir);
  }

  private async ensureProxy(
    projectDir: string,
    config: CursorConfig,
    log: LogFn,
  ): Promise<ProjectProxyState> {
    let state = this.projectStates.get(projectDir);
    if (state?.connection && state.port) {
      return state;
    }

    const conversationDir = join(projectDir, '.aider-desk', 'cursor');
    mkdirSync(conversationDir, { recursive: true });

    const apiKey = config.apiKey || process.env.CURSOR_API_KEY;
    if (!apiKey) {
      throw new Error('Cursor API key not configured. Set it in extension settings or CURSOR_API_KEY env var.');
    }

    log('Exchanging API key for access token...', 'info');
    const accessToken = await exchangeApiKeyForAccessToken(apiKey);
    log('Access token obtained', 'info');

    const spawnConfig: ProxySpawnConfig = {
      accessToken,
      conversationDir,
      nativeToolsMode: config.nativeToolsMode,
      maxMode: config.maxMode,
      fast: config.fast,
      thinking: config.thinking,
      maxRetries: config.maxRetries,
    };

    const sessionId = `aiderdesk-${projectDir}`;

    log('Starting Cursor proxy...', 'info');
    const result = await connectToProxy(sessionId, spawnConfig);
    log(`Cursor proxy started on port ${result.port}`, 'info');

    state = {
      connection: result.connection,
      port: result.port,
      models: result.models,
      conversationDir,
    };
    this.projectStates.set(projectDir, state);

    return state;
  }

  getProviders(context: ExtensionContext): ProviderDefinition[] {
    const log: LogFn = (message, type) => context.log(message, type);

    return [
      {
        id: CURSOR_PROVIDER_NAME,
        name: CURSOR_PROVIDER_NAME,
        provider: { name: CURSOR_PROVIDER_NAME },
        strategy: {
          createLlm: (
            _profile: ProviderProfile,
            model: Model,
            _settings: SettingsData,
            projectDir: string,
          ): unknown => {
            return createOpenAICompatibleLm(model.id, projectDir, this, log);
          },

          loadModels: async (profile): Promise<LoadModelsResponse> => {
            try {
              const config = this.loadConfig();
              const apiKey = config.apiKey || process.env.CURSOR_API_KEY;
              if (!apiKey) {
                return { models: [], success: false, error: 'Cursor API key not configured. Set it in extension settings.' };
              }

              // If a proxy is already running for any project, fetch models from it
              for (const [, state] of this.projectStates) {
                if (state.port && state.models.length > 0) {
                  log(`Returning ${state.models.length} cached models from running proxy`, 'info');
                  return {
                    models: toAiderDeskModels(state.models, profile.id),
                    success: true,
                  };
                }
              }

              // No proxy running — start a temporary one to discover models
              log('Starting temporary proxy for model discovery...', 'info');
              const accessToken = await exchangeApiKeyForAccessToken(apiKey);

              const os = await import('node:os');
              const tempDir = join(os.tmpdir(), `cursor-model-discovery-${Date.now()}`);
              mkdirSync(tempDir, { recursive: true });

              const spawnConfig: ProxySpawnConfig = {
                accessToken,
                conversationDir: tempDir,
                nativeToolsMode: config.nativeToolsMode,
                maxMode: config.maxMode,
                fast: config.fast,
                thinking: config.thinking,
                maxRetries: config.maxRetries,
              };

              const sessionId = `model-discovery-${Date.now()}`;
              const result = await connectToProxy(sessionId, spawnConfig);
              const models = result.models;
              log(`Loaded ${models.length} models from Cursor`, 'info');

              // Clean up the temporary proxy
              if (result.connection) {
                await cleanupSession(result.connection.port, sessionId).catch(() => {});
                stopProxy(result.connection, tempDir);
              }

              return {
                models: toAiderDeskModels(models, profile.id),
                success: true,
              };
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              log(`Failed to load models: ${errorMsg}`, 'error');
              return {
                models: [],
                success: false,
                error: errorMsg,
              };
            }
          },
        },
      },
    ];
  }

  private async setConfig(config: Partial<CursorConfig>): Promise<void> {
    const merged = { ...this.loadConfig(), ...config };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');

    if (config.apiKey !== undefined) {
      clearCachedToken();
    }

    // If settings changed, restart proxies for all projects
    for (const [, state] of this.projectStates) {
      if (state.connection) {
        const apiKey = merged.apiKey || process.env.CURSOR_API_KEY;
        if (apiKey) {
          await pushToken(state.connection.port, await exchangeApiKeyForAccessToken(apiKey));
        }
      }
    }
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<CursorConfig> {
    return this.loadConfig();
  }

  async saveConfigData(configData: unknown): Promise<unknown> {
    const config = configData as Partial<CursorConfig>;
    await this.setConfig(config);
    return this.loadConfig();
  }

  // Expose for createLlm closure
  _ensureProxy = this.ensureProxy.bind(this);
  _loadConfig = this.loadConfig.bind(this);
}

async function createOpenAICompatibleLm(
  modelId: string,
  projectDir: string,
  extension: CursorExtension,
  log: LogFn,
): Promise<unknown> {
  const config = extension._loadConfig();
  const state = await extension._ensureProxy(projectDir, config, log);

  const sessionId = state.connection?.sessionId ?? `aiderdesk-${projectDir}`;

  const compatibleProvider = createOpenAICompatible({
    name: CURSOR_PROVIDER_NAME,
    apiKey: 'cursor-proxy',
    baseURL: `http://localhost:${String(state.port)}/v1`,
    headers: {
      'X-Session-Id': sessionId,
      'X-Project-Dir': projectDir,
    },
  });

  return compatibleProvider(modelId);
}
