import { randomBytes, createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { platform, release, arch } from 'node:os';

import { createOpenAI } from '@ai-sdk/openai';

import type {
  Extension,
  ExtensionContext,
  ProviderDefinition,
  LoadModelsResponse,
  ProviderProfile,
  Model,
  SettingsData,
  AgentStartedEvent,
} from '@aiderdesk/extensions';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// OAuth configuration
const CLIENT_ID_BASE64 = 'YXBwX0VNb2FtRUVaNzNmMENrWGFYcDdocmFubg==';
const getClientId = (): string => atob(CLIENT_ID_BASE64);
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REDIRECT_URI = 'http://localhost:1455/auth/callback';
const SCOPE = 'openid profile email offline_access';
const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';

// Token storage
const TOKEN_FILE = join(__dirname, 'auth-token.json');

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Hardcoded models from https://developers.openai.com/codex/models
const CODEX_MODELS: Model[] = [
  // Recommended
  { id: 'gpt-5.6-sol', providerId: '', maxInputTokens: 1050000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.6-terra', providerId: '', maxInputTokens: 1050000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.6-luna', providerId: '', maxInputTokens: 1050000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.5', providerId: '', maxInputTokens: 1050000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.4', providerId: '', maxInputTokens: 1050000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.4-mini', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.3-codex', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.2-codex', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.2', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.1-codex-max', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
  { id: 'gpt-5.1-codex-mini', providerId: '', maxInputTokens: 400000, maxOutputTokensLimit: 128000 },
];

// --- Token storage ---

const loadTokens = async (): Promise<StoredTokens | null> => {
  try {
    const data = await readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(data) as StoredTokens;
  } catch {
    return null;
  }
};

const saveTokens = async (tokens: StoredTokens): Promise<void> => {
  await mkdir(__dirname, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
};

// --- PKCE ---

const generatePKCE = async (): Promise<{ verifier: string; challenge: string }> => {
  const verifierBytes = randomBytes(32);
  const verifier = verifierBytes.toString('base64url');

  const challengeBuffer = createHash('sha256').update(verifier).digest();
  const challenge = challengeBuffer.toString('base64url');

  return { verifier, challenge };
};

// --- JWT decoding ---

interface JwtPayload {
  [JWT_CLAIM_PATH]?: {
    chatgpt_account_id?: string;
  };
  [key: string]: unknown;
}

const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1]!;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as JwtPayload;
  } catch {
    return null;
  }
};

const getAccountId = (accessToken: string): string | null => {
  const payload = decodeJwt(accessToken);
  const accountId = payload?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
  return typeof accountId === 'string' && accountId.length > 0 ? accountId : null;
};

// --- Token refresh ---

const refreshAccessToken = async (refreshToken: string, context: ExtensionContext): Promise<StoredTokens> => {
  context.log('Refreshing OpenAI access token...', 'info');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getClientId(),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error('Token refresh response missing required fields');
  }

  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  await saveTokens(tokens);
  context.log('OpenAI access token refreshed successfully', 'info');

  return tokens;
};

// --- Local OAuth callback server ---

const OAUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html><head><title>Authentication Successful</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5}
.card{text-align:center;padding:2rem;border-radius:12px;background:#1a1a1a;border:1px solid #333}
h1{color:#10b981;font-size:1.5rem}p{color:#999;margin-top:0.5rem}
</style></head><body><div class="card"><h1>&#10003; Authentication Successful</h1><p>You can close this window and return to AiderDesk.</p></div></body></html>`;

const OAUTH_ERROR_HTML = (message: string) => `<!DOCTYPE html>
<html><head><title>Authentication Failed</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5}
.card{text-align:center;padding:2rem;border-radius:12px;background:#1a1a1a;border:1px solid #333}
h1{color:#ef4444;font-size:1.5rem}p{color:#999;margin-top:0.5rem}
</style></head><body><div class="card"><h1>&#10007; Authentication Failed</h1><p>${message}</p></div></body></html>`;

const startOAuthServer = (expectedState: string): Promise<{ server: Server; waitForCode: () => Promise<string> }> => {
  return new Promise((resolve, reject) => {
    let codeResolver: ((code: string) => void) | null = null;
    const codePromise = new Promise<string>((resolveCode) => {
      codeResolver = resolveCode;
    });

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');

        if (url.pathname !== '/auth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(OAUTH_ERROR_HTML('Callback route not found.'));
          return;
        }

        if (url.searchParams.get('state') !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(OAUTH_ERROR_HTML('State mismatch. Please try again.'));
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(OAUTH_ERROR_HTML('Missing authorization code.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(OAUTH_SUCCESS_HTML);
        codeResolver?.(code);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(OAUTH_ERROR_HTML('Internal error while processing OAuth callback.'));
      }
    });

    server.listen(1455, '127.0.0.1', () => {
      resolve({ server, waitForCode: () => codePromise });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`Failed to start OAuth callback server on port 1455: ${err.message}`));
    });
  });
};

// --- Full OAuth flow ---

const runOAuthFlow = async (context: ExtensionContext): Promise<StoredTokens> => {
  context.log('Starting OpenAI OAuth flow...', 'info');

  const { verifier, challenge } = await generatePKCE();
  const state = randomBytes(16).toString('hex');

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', getClientId());
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('id_token_add_organizations', 'true');
  authUrl.searchParams.set('codex_cli_simplified_flow', 'true');
  authUrl.searchParams.set('originator', 'aiderdesk');

  const { server, waitForCode } = await startOAuthServer(state);

  try {
    await context.openUrl(authUrl.toString(), 'external');
    context.log('Browser opened for OpenAI login. Waiting for callback...', 'info');

    const code = await waitForCode();
    context.log('Received authorization code, exchanging for tokens...', 'info');

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text().catch(() => '');
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${text}`);
    }

    const json = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
      throw new Error('Token exchange response missing required fields');
    }

    const tokens: StoredTokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };

    await saveTokens(tokens);
    context.log('OpenAI authentication successful!', 'info');

    return tokens;
  } finally {
    server.close();
  }
};

// --- Get valid access token ---

const getValidAccessToken = async (context: ExtensionContext): Promise<{ accessToken: string; accountId: string }> => {
  const tokens = await loadTokens();

  if (tokens) {
    // Refresh if expired (with 60s buffer)
    if (Date.now() >= tokens.expiresAt - 60_000) {
      try {
        const refreshed = await refreshAccessToken(tokens.refreshToken, context);
        const accountId = getAccountId(refreshed.accessToken);
        if (!accountId) {
          throw new Error('Failed to extract account ID from refreshed token');
        }
        return { accessToken: refreshed.accessToken, accountId };
      } catch (error) {
        context.log(`Token refresh failed: ${error instanceof Error ? error.message : error}. Re-authenticating...`, 'warn');
      }
    } else {
      const accountId = getAccountId(tokens.accessToken);
      if (accountId) {
        return { accessToken: tokens.accessToken, accountId };
      }
      context.log('Failed to extract account ID from stored token, re-authenticating...', 'warn');
    }
  }

  // No valid tokens — trigger full OAuth flow
  const newTokens = await runOAuthFlow(context);
  const accountId = getAccountId(newTokens.accessToken);
  if (!accountId) {
    throw new Error('Failed to extract account ID from token');
  }
  return { accessToken: newTokens.accessToken, accountId };
};

// --- Extension class ---

const PROVIDER_ID = 'openai-codex';

export default class OpenAICodexAuthExtension implements Extension {
  static metadata = {
    name: 'OpenAI Codex Auth',
    version: '1.2.0',
    description: 'OpenAI Codex provider using ChatGPT Plus/Pro OAuth authentication',
    iconUrl:
      'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/openai-codex/icon.png',
    author: 'wladimiiir',
  };

  private currentSystemPrompt: string | undefined;

  async onLoad(context: ExtensionContext): Promise<void> {
    const tokens = await loadTokens();
    if (tokens && Date.now() < tokens.expiresAt) {
      context.log('OpenAI Codex Auth loaded (authenticated)', 'info');
    } else if (tokens) {
      context.log('OpenAI Codex Auth loaded (token expired, will refresh on use)', 'info');
    } else {
      context.log('OpenAI Codex Auth loaded (not authenticated — will prompt on first use)', 'info');
    }
  }

  async onAgentStarted(event: AgentStartedEvent) {
    if (event.providerProfile.provider.name !== PROVIDER_ID) {
      return undefined;
    }

    this.currentSystemPrompt = event.systemPrompt ?? undefined;
    return {
      systemPrompt: '', // Clear system prompt since it's used as instructions for the provider instead,
    };
  }

  getProviders(context: ExtensionContext): ProviderDefinition[] {
    const createLlm = async (_profile: ProviderProfile, model: Model) => {
      context.log(`Creating OpenAI Codex model: ${model.id}`, 'info');

      const { accessToken, accountId } = await getValidAccessToken(context);

      const provider = createOpenAI({
        baseURL: CODEX_BASE_URL,
        apiKey: accessToken,
        headers: {
          'chatgpt-account-id': accountId,
          'OpenAI-Beta': 'responses=experimental',
          originator: 'aiderdesk',
          'User-Agent': `aiderdesk (${platform()} ${release()}; ${arch()})`,
        },
      });

      return provider.responses(model.id);
    };

    const loadModels = async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
      const models = CODEX_MODELS.map((m) => ({
        ...m,
        providerId: profile.id,
      }));

      return { models, success: true };
    };

    const getProviderOptions = () => {
      return {
        openai: {
          store: false,
          instructions: this.currentSystemPrompt || '',
          reasoningSummary: 'detailed',
        },
      };
    };

    return [
      {
        id: PROVIDER_ID,
        name: 'OpenAI Codex',
        provider: {
          name: PROVIDER_ID,
        },
        strategy: {
          createLlm,
          loadModels,
          getProviderOptions,
        },
      },
    ];
  }
}
