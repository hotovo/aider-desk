import { randomBytes, createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir, platform, release, arch } from 'node:os';

import { createOpenAI } from '@ai-sdk/openai';

import type {
  Extension,
  ExtensionContext,
  ProviderDefinition,
  LoadModelsResponse,
  ProviderProfile,
  Model,
  AgentStartedEvent,
  PromptFinishedEvent,
  UIComponentDefinition,
} from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Public Codex CLI OAuth client, PKCE. OpenAI allows any loopback port in the redirect URI,
// matching how the official codex-rs binds an ephemeral port and reads back the actual port.
const CLIENT_ID_BASE64 = 'YXBwX0VNb2FtRUVaNzNmMENrWGFYcDdocmFubg==';
const getClientId = (): string => atob(CLIENT_ID_BASE64);
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const SCOPE = 'openid profile email offline_access';
const JWT_CLAIM_PATH = 'https://api.openai.com/auth';
const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';
const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const DEVICE_USER_CODE_URL = 'https://auth.openai.com/api/accounts/deviceauth/usercode';
const DEVICE_TOKEN_URL = 'https://auth.openai.com/api/accounts/deviceauth/token';
const DEVICE_VERIFICATION_URL = 'https://auth.openai.com/codex/device';
const DEVICE_EXCHANGE_REDIRECT_URI = 'https://auth.openai.com/deviceauth/callback';
const DEVICE_FLOW_TIMEOUT_MS = 15 * 60 * 1000;
const BROWSER_FLOW_TIMEOUT_MS = 10 * 60 * 1000;
// Hard timeout on every outbound call so an unreachable host can never leave a request hanging
// for minutes and stall UI data loading that awaits it
const FETCH_TIMEOUT_MS = 15_000;
const REFRESH_TOKEN_EXPIRY_BUFFER_MS = 60_000;
const CACHE_DURATION = 60_000;
const STATUS_BAR_COMPONENT_ID = 'openai-codex-quota-indicator';
const CONFIG_COMPONENT_ID = 'config';

interface CodexUsageWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_at: number;
}

interface CodexUsageResponse {
  plan_type?: string;
  rate_limit?: {
    primary_window?: CodexUsageWindow | null;
    secondary_window?: CodexUsageWindow | null;
  } | null;
}

interface CodexQuotaData {
  planType?: string;
  primary?: CodexUsageWindow;
  secondary?: CodexUsageWindow;
}

interface CachedData<T> {
  data: T | null;
  lastFetchTime: number;
}

const quotaCache: CachedData<CodexQuotaData> = { data: null, lastFetchTime: 0 };

// Per-task session ID used for prompt caching (set in onAgentStarted)
const PROMPT_CACHE_KEY_MAX_LENGTH = 64;
let currentSessionId: string | undefined;

const clampCacheKey = (key: string): string =>
  key.length <= PROMPT_CACHE_KEY_MAX_LENGTH ? key : Array.from(key).slice(0, PROMPT_CACHE_KEY_MAX_LENGTH).join('');

// Tokens live outside the extension install dir so they survive extension updates; the legacy
// location inside the extension install dir is migrated on load. Mirrors the app's home-dir
// resolution (src/main/constants.ts): AIDER_DESK_DATA_DIR → AIDER_DESK_HOME_DIR → ~/.aider-desk
const AIDER_DESK_HOME = process.env.AIDER_DESK_HOME_DIR ?? join(homedir(), process.env.AIDER_DESK_DIR ?? '.aider-desk');
const DATA_DIR = process.env.AIDER_DESK_DATA_DIR
  ? join(process.env.AIDER_DESK_DATA_DIR, 'extensions-data', 'openai-codex')
  : join(AIDER_DESK_HOME, 'extensions-data', 'openai-codex');
const TOKEN_FILE = join(DATA_DIR, 'auth-token.json');
const LEGACY_TOKEN_FILE = join(__dirname, 'auth-token.json');

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email?: string;
}

// Hardcoded models from https://developers.openai.com/codex/models
const CODEX_MODELS: Model[] = [
  // Recommended
  {
    id: 'gpt-5.6-sol',
    providerId: '',
    maxInputTokens: 1050000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.000005,
    outputCostPerToken: 0.00003,
    cacheReadInputTokenCost: 0.0000005,
    cacheWriteInputTokenCost: 0.00000625,
  },
  {
    id: 'gpt-5.6-terra',
    providerId: '',
    maxInputTokens: 1050000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.000002,
    outputCostPerToken: 0.000012,
    cacheReadInputTokenCost: 0.0000002,
    cacheWriteInputTokenCost: 0.0000025,
  },
  {
    id: 'gpt-5.6-luna',
    providerId: '',
    maxInputTokens: 1050000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.0000002,
    outputCostPerToken: 0.0000012,
    cacheReadInputTokenCost: 0.00000002,
    cacheWriteInputTokenCost: 0.00000025,
  },
  {
    id: 'gpt-5.5',
    providerId: '',
    maxInputTokens: 1050000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.000005,
    outputCostPerToken: 0.00003,
    cacheReadInputTokenCost: 0.0000005,
  },
  {
    id: 'gpt-5.4',
    providerId: '',
    maxInputTokens: 1050000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.0000025,
    outputCostPerToken: 0.000015,
    cacheReadInputTokenCost: 0.00000025,
  },
  {
    id: 'gpt-5.4-mini',
    providerId: '',
    maxInputTokens: 400000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.00000075,
    outputCostPerToken: 0.0000045,
    cacheReadInputTokenCost: 0.000000075,
  },
  {
    id: 'gpt-5.3-codex',
    providerId: '',
    maxInputTokens: 400000,
    maxOutputTokensLimit: 128000,
    inputCostPerToken: 0.00000175,
    outputCostPerToken: 0.000014,
    cacheReadInputTokenCost: 0.000000175,
  },
  {
    id: 'gpt-5.3-codex-spark',
    providerId: '',
    maxInputTokens: 400000,
    maxOutputTokensLimit: 128000,
  },
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
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
};

const clearTokens = async (): Promise<void> => {
  await unlink(TOKEN_FILE).catch(() => {});
};

const migrateLegacyTokens = async (): Promise<void> => {
  if (!existsSync(LEGACY_TOKEN_FILE) || existsSync(TOKEN_FILE)) {
    return;
  }
  try {
    const tokens = JSON.parse(readFileSync(LEGACY_TOKEN_FILE, 'utf-8')) as StoredTokens;
    await saveTokens(tokens);
    await unlink(LEGACY_TOKEN_FILE).catch(() => {});
  } catch {
    // best-effort migration
  }
};

// --- PKCE and JWT ---

const generatePKCE = async (): Promise<{ verifier: string; challenge: string }> => {
  const verifierBytes = randomBytes(32);
  const verifier = verifierBytes.toString('base64url');

  const challengeBuffer = createHash('sha256').update(verifier).digest();
  const challenge = challengeBuffer.toString('base64url');

  return { verifier, challenge };
};

interface JwtPayload {
  [JWT_CLAIM_PATH]?: {
    chatgpt_account_id?: string;
  };
  email?: string;
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

const getEmail = (token: string): string | undefined => {
  const payload = decodeJwt(token);
  return typeof payload?.email === 'string' && payload.email.length > 0 ? payload.email : undefined;
};

// --- Token exchange & refresh ---

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}

const extractStoredTokens = async (json: TokenResponse): Promise<StoredTokens> => {
  if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
    throw new Error('Token response missing required fields');
  }

  const tokens: StoredTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    email: json.id_token ? getEmail(json.id_token) : undefined,
  };

  await saveTokens(tokens);
  return tokens;
};

const exchangeAuthorizationCode = async (code: string, codeVerifier: string, redirectUri: string): Promise<StoredTokens> => {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: getClientId(),
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkError(error, TOKEN_URL);
  }

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text().catch(() => '');
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${text}`);
  }

  return extractStoredTokens((await tokenResponse.json()) as TokenResponse);
};

const refreshAccessToken = async (refreshToken: string, context: ExtensionContext): Promise<StoredTokens> => {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: getClientId(),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw networkError(error, TOKEN_URL);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  return extractStoredTokens((await response.json()) as TokenResponse);
};

// --- Browser (loopback callback) OAuth flow ---

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

const startOAuthServer = (expectedState: string): Promise<{ server: Server; waitForCode: () => Promise<string>; redirectUri: string }> => {
  return new Promise((resolve, reject) => {
    let codeResolver: ((code: string) => void) | null = null;
    const codePromise = new Promise<string>((resolveCode) => {
      codeResolver = resolveCode;
    });

    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        const reply = (status: number, message: string) => {
          res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(OAUTH_ERROR_HTML(message));
        };

        if (url.pathname !== '/auth/callback') {
          reply(404, 'Callback route not found.');
          return;
        }

        const oauthError = url.searchParams.get('error');
        if (oauthError) {
          reply(400, url.searchParams.get('error_description') || oauthError);
          return;
        }

        if (url.searchParams.get('state') !== expectedState) {
          reply(400, 'State mismatch. Please try again.');
          return;
        }

        const code = url.searchParams.get('code');
        if (!code) {
          reply(400, 'Missing authorization code.');
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

    server.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`Failed to start OAuth callback server: ${err.message}`));
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, waitForCode: () => codePromise, redirectUri: `http://localhost:${port}/auth/callback` });
    });
  });
};

const runBrowserOAuthFlow = async (context: ExtensionContext, signal: AbortSignal): Promise<void> => {
  context.log('Starting OpenAI browser OAuth flow...', 'info');

  const { verifier, challenge } = await generatePKCE();
  const state = randomBytes(16).toString('hex');

  const { server, waitForCode, redirectUri } = await startOAuthServer(state);

  try {
    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', getClientId());
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', SCOPE);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('id_token_add_organizations', 'true');
    authUrl.searchParams.set('codex_cli_simplified_flow', 'true');
    authUrl.searchParams.set('originator', 'aiderdesk');

    await context.openUrl(authUrl.toString(), 'external');

    const timeout = new Promise<never>((_, rejectTimeout) => {
      setTimeout(() => rejectTimeout(new Error('Sign-in timed out. Please try again.')), BROWSER_FLOW_TIMEOUT_MS).unref();
    });
    const aborted = new Promise<never>((_, rejectAbort) => {
      signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = abortErrorName;
        rejectAbort(err);
      }, { once: true });
    });

    const code = await Promise.race([waitForCode(), timeout, aborted]);
    context.log('Received authorization code, exchanging for tokens...', 'info');

    await exchangeAuthorizationCode(code, verifier, redirectUri);
    quotaCache.data = null;
    quotaCache.lastFetchTime = 0;
    context.triggerUIDataRefresh(STATUS_BAR_COMPONENT_ID);
  } finally {
    server.close();
  }
};

// --- Device code flow (works when the browser runs on a different machine than AiderDesk) ---

interface DeviceCodeResponse {
  device_auth_id?: string;
  user_code?: string;
  interval?: number | string;
}

interface DeviceTokenResponse {
  authorization_code?: string;
  code_verifier?: string;
}

interface DeviceFlowState {
  userCode: string;
  verificationUrl: string;
  abort: AbortController;
}

interface BrowserFlowState {
  abort: AbortController;
}

let deviceFlow: DeviceFlowState | null = null;
let browserFlow: BrowserFlowState | null = null;
let lastAuthError: string | undefined;

const abortErrorName = 'AbortError';

// Node's fetch reports network problems as a bare "fetch failed" TypeError; surface the cause
// (DNS, refusal, TLS, proxy) so users can actually tell what failed.
const networkError = (error: unknown, url: string): Error => {
  const cause = (error as { cause?: unknown })?.cause;
  const detail = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined;
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // keep full url as fallback
  }
  return new Error(detail ? `Network error calling ${host}: ${detail}` : `Network error calling ${host}`);
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        const err = new Error('Aborted');
        err.name = abortErrorName;
        reject(err);
      },
      { once: true },
    );
  });

const cancelDeviceFlow = (): void => {
  if (deviceFlow) {
    deviceFlow.abort.abort();
    deviceFlow = null;
  }
};

const cancelBrowserFlow = (): void => {
  if (browserFlow) {
    browserFlow.abort.abort();
    browserFlow = null;
  }
};

// Only mutates the flow that failed — a late error from an aborted/old flow must not taint a
// newer one, so the caller always passes its own flow instance
const failDeviceFlow = (flow: DeviceFlowState, message: string, context: ExtensionContext): void => {
  if (deviceFlow !== flow) {
    return;
  }
  context.log(`Device code sign-in failed: ${message}`, 'warn');
  lastAuthError = message;
  flow.abort.abort();
  if (deviceFlow === flow) {
    deviceFlow = null;
  }
};

const runDeviceCodeFlow = async (context: ExtensionContext): Promise<void> => {
  if (!deviceFlow) {
    return;
  }
  const flow = deviceFlow;
  const signal = flow.abort.signal;

  try {
    let userCodeResponse: Response;
    try {
      userCodeResponse = await fetch(DEVICE_USER_CODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: getClientId() }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
      });
    } catch (error) {
      throw signal.aborted ? error : networkError(error, DEVICE_USER_CODE_URL);
    }

    if (!userCodeResponse.ok) {
      // Mirrors codex-rs: a 404 here (feature-gated endpoint) means the device flow is disabled /
      // unsupported on this auth server
      if (userCodeResponse.status === 404) {
        throw new Error(
          'Device code sign-in is not enabled for this account or not supported by the auth server. Enable it in ChatGPT security settings (or ask your workspace admin).',
        );
      }
      throw new Error(`Device code request failed: ${userCodeResponse.status}`);
    }

    const userCodeJson = (await userCodeResponse.json()) as DeviceCodeResponse;
    if (!userCodeJson.device_auth_id || !userCodeJson.user_code) {
      throw new Error('Device code response missing required fields');
    }
    const parsedInterval = typeof userCodeJson.interval === 'number' ? userCodeJson.interval : parseInt(String(userCodeJson.interval ?? '5'), 10);
    let pollIntervalMs = Math.max(Number.isFinite(parsedInterval) ? parsedInterval! : 5, 1) * 1000;

    if (deviceFlow !== flow) {
      return;
    }
    flow.userCode = userCodeJson.user_code;
    context.log(`Device code sign-in started: ${userCodeJson.user_code}`, 'info');

    const deadline = Date.now() + DEVICE_FLOW_TIMEOUT_MS;
    while (Date.now() < deadline && !signal.aborted) {
      await sleep(pollIntervalMs, signal);

      let pollResponse: Response;
      try {
        pollResponse = await fetch(DEVICE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_auth_id: userCodeJson.device_auth_id,
            user_code: userCodeJson.user_code,
          }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
        });
      } catch (error) {
        throw signal.aborted ? error : networkError(error, DEVICE_TOKEN_URL);
      }

      if (pollResponse.ok) {
        const pollJson = (await pollResponse.json()) as DeviceTokenResponse;
        if (!pollJson.authorization_code || !pollJson.code_verifier) {
          throw new Error('Device token response missing required fields');
        }
        await exchangeAuthorizationCode(pollJson.authorization_code, pollJson.code_verifier, DEVICE_EXCHANGE_REDIRECT_URI);
        context.log('OpenAI device code sign-in successful', 'info');
        if (deviceFlow === flow) {
          deviceFlow = null;
        }
        lastAuthError = undefined;
        quotaCache.data = null;
        quotaCache.lastFetchTime = 0;
        context.triggerUIDataRefresh(STATUS_BAR_COMPONENT_ID);
        return;
      }

      // Conservative pending semantics: the endpoint contract mirrors codex-rs (403/404 mean
      // "not approved yet"), and standard device grants report pending via 400 with an error
      // code. slow_down requires backing off; anything else is a real failure.
      const status = pollResponse.status;
      if (status === 400 || status === 403 || status === 404 || status === 408 || status >= 429) {
        const bodyText = await pollResponse.text().catch(() => '');
        let errorCode = '';
        try {
          errorCode = (JSON.parse(bodyText) as { error?: string }).error ?? '';
        } catch {
          // body is not JSON — no error code available
        }
        if (errorCode === 'slow_down') {
          pollIntervalMs += 5_000;
          continue;
        }
        if (status === 400 && errorCode && errorCode !== 'authorization_pending') {
          throw new Error(`Device code sign-in was rejected: ${errorCode}`);
        }
        continue;
      }

      throw new Error(`Device code polling failed: ${status}`);
    }

    if (!signal.aborted) {
      failDeviceFlow(flow, 'Device code sign-in timed out. Please try again.', context);
    }
  } catch (error) {
    if ((error as Error)?.name !== abortErrorName) {
      failDeviceFlow(flow, error instanceof Error ? error.message : String(error), context);
    }
  }
};

const startDeviceCodeFlow = (context: ExtensionContext): void => {
  cancelDeviceFlow();
  lastAuthError = undefined;
  deviceFlow = {
    userCode: '',
    verificationUrl: DEVICE_VERIFICATION_URL,
    abort: new AbortController(),
  };
  void runDeviceCodeFlow(context);
};

// --- Auth state (surfaced to the settings UI via config data and UI actions) ---

interface AuthState {
  status: 'signed-in' | 'expired' | 'signed-out';
  email?: string;
  accountId?: string;
  pendingFlow: null | { type: 'browser' | 'device'; userCode?: string; verificationUrl?: string };
  lastError?: string;
}

const getAuthState = async (): Promise<AuthState> => {
  const tokens = await loadTokens();
  const state: AuthState = {
    status: tokens ? (Date.now() < tokens.expiresAt ? 'signed-in' : 'expired') : 'signed-out',
    pendingFlow: null,
  };
  if (tokens) {
    state.email = tokens.email;
    const accountId = getAccountId(tokens.accessToken);
    if (accountId) {
      state.accountId = accountId;
    }
  }
  if (deviceFlow) {
    state.pendingFlow = {
      type: 'device',
      userCode: deviceFlow.userCode || undefined,
      verificationUrl: DEVICE_VERIFICATION_URL,
    };
  } else if (browserFlow) {
    state.pendingFlow = { type: 'browser' };
  }
  if (lastAuthError) {
    state.lastError = lastAuthError;
  }
  return state;
};

// Silent variant for background work (quota display): null on unauthenticated or refresh failure
const getValidTokensNonInteractive = async (context: ExtensionContext): Promise<StoredTokens | null> => {
  try {
    return await getValidTokensForCall(context);
  } catch (error) {
    context.log(`Token refresh failed: ${error instanceof Error ? error.message : error}`, 'warn');
    return null;
  }
};

// Throwing variant for the model-call path: the two failure kinds produce distinct, actionable
// errors instead of one "go re-auth" message
const getValidTokensForCall = async (context: ExtensionContext): Promise<StoredTokens> => {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error('OpenAI Codex is not authenticated. Open extension settings for OpenAI Codex Auth and sign in.');
  }

  if (Date.now() >= tokens.expiresAt - REFRESH_TOKEN_EXPIRY_BUFFER_MS) {
    return refreshAccessToken(tokens.refreshToken, context);
  }

  return tokens;
};

const fetchQuota = async (context: ExtensionContext): Promise<CodexQuotaData | null> => {
  try {
    const tokens = await getValidTokensNonInteractive(context);
    if (!tokens) {
      return null;
    }
    const accountId = getAccountId(tokens.accessToken);
    if (!accountId) {
      return null;
    }
    let response: Response;
    try {
      response = await fetch(CODEX_USAGE_URL, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'ChatGPT-Account-Id': accountId,
          'User-Agent': `aiderdesk (${platform()} ${release()}; ${arch()})`,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      throw networkError(error, CODEX_USAGE_URL);
    }

    if (!response.ok) {
      context.log(`Failed to fetch OpenAI Codex usage: ${response.status} ${response.statusText}`, 'warn');
      return null;
    }

    const data = (await response.json()) as CodexUsageResponse;
    return {
      planType: data.plan_type,
      primary: data.rate_limit?.primary_window ?? undefined,
      secondary: data.rate_limit?.secondary_window ?? undefined,
    };
  } catch (error) {
    context.log(`Failed to fetch OpenAI Codex usage: ${error instanceof Error ? error.message : error}`, 'warn');
    return null;
  }
};

let quotaInflight: Promise<CodexQuotaData | null> | null = null;

const getQuota = async (context: ExtensionContext): Promise<CodexQuotaData | null> => {
  const now = Date.now();
  if (quotaCache.data && now - quotaCache.lastFetchTime < CACHE_DURATION) {
    return quotaCache.data;
  }

  // Deduplicate concurrent calls — multiple UI slots can request quota data at the same time
  if (quotaInflight) {
    return quotaInflight;
  }

  quotaInflight = fetchQuota(context)
    .then((data) => {
      quotaCache.data = data;
      quotaCache.lastFetchTime = Date.now();
      return data;
    })
    .finally(() => {
      quotaInflight = null;
    });

  return quotaInflight;
};

// --- Extension class ---

const PROVIDER_ID = 'openai-codex';

export default class OpenAICodexAuthExtension implements Extension {
  static metadata = {
    name: 'OpenAI Codex Auth',
    version: '2.0.0',
    description: 'OpenAI Codex provider using ChatGPT Plus/Pro OAuth authentication with a dedicated sign-in UI (browser or device code)',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/openai-codex/icon.png',
    author: 'wladimiiir',
  };

  private configComponentJsx = '';

  async onLoad(context: ExtensionContext): Promise<void> {
    await migrateLegacyTokens();

    try {
      this.configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
    } catch {
      context.log('OpenAI Codex Auth: ConfigComponent.jsx not found', 'warn');
    }

    const tokens = await loadTokens();
    if (tokens && Date.now() < tokens.expiresAt) {
      context.log('OpenAI Codex Auth loaded (authenticated)', 'info');
    } else if (tokens) {
      context.log('OpenAI Codex Auth loaded (token expired, will refresh on use)', 'info');
    } else {
      context.log('OpenAI Codex Auth loaded (not authenticated — use extension settings to sign in)', 'info');
    }

    // Pre-fetch quota data so usage is available immediately when the component first mounts
    if (tokens) {
      void getQuota(context);
    }
  }

  async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext): Promise<void> {
    if (event.providerProfile.provider.name !== PROVIDER_ID) {
      return undefined;
    }
    const taskContext = context.getTaskContext();
    currentSessionId = taskContext?.data.id;
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    quotaCache.data = null;
    quotaCache.lastFetchTime = 0;
    context.triggerUIDataRefresh(STATUS_BAR_COMPONENT_ID);
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const jsx = readFileSync(join(__dirname, './StatusBarComponent.jsx'), 'utf-8');
    return [
      {
        id: STATUS_BAR_COMPONENT_ID,
        placement: 'task-usage-info-bottom',
        jsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== STATUS_BAR_COMPONENT_ID) {
      return undefined;
    }

    return getQuota(context);
  }

  getConfigComponent(): string | undefined {
    return this.configComponentJsx || undefined;
  }

  async getConfigData(): Promise<AuthState> {
    return getAuthState();
  }

  async saveConfigData(): Promise<AuthState> {
    // No editable fields — sign-in changes go through executeUIExtensionAction
    return getAuthState();
  }

  async executeUIExtensionAction(componentId: string, action: string, _args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId !== CONFIG_COMPONENT_ID) {
      return undefined;
    }

    switch (action) {
      case 'getAuthState':
        return getAuthState();

      case 'signInBrowser': {
        if (browserFlow || deviceFlow) {
          return getAuthState();
        }
        lastAuthError = undefined;
        const flow: BrowserFlowState = { abort: new AbortController() };
        browserFlow = flow;
        void (async () => {
          try {
            await runBrowserOAuthFlow(context, flow.abort.signal);
            context.log('OpenAI browser sign-in successful', 'info');
          } catch (error) {
            if (browserFlow === flow && (error as Error)?.name !== abortErrorName) {
              const message = error instanceof Error ? error.message : String(error);
              context.log(`Browser sign-in failed: ${message}`, 'warn');
              lastAuthError = message;
            }
          } finally {
            if (browserFlow === flow) {
              browserFlow = null;
            }
          }
        })();
        return getAuthState();
      }

      case 'signInDeviceCode':
        startDeviceCodeFlow(context);
        return getAuthState();

      case 'cancelSignIn':
        cancelDeviceFlow();
        cancelBrowserFlow();
        lastAuthError = undefined;
        return getAuthState();

      case 'signOut':
        cancelDeviceFlow();
        cancelBrowserFlow();
        lastAuthError = undefined;
        await clearTokens();
        context.log('OpenAI Codex signed out', 'info');
        return getAuthState();

      default:
        return undefined;
    }
  }

  getProviders(context: ExtensionContext): ProviderDefinition[] {
    const createLlm = async (_profile: ProviderProfile, model: Model) => {
      // Never start OAuth here — sign-in is an explicit user action from the settings UI.
      // Throws distinct errors: "not authenticated" vs "refresh failed: <cause>", so a network
      // blip doesn't send users to re-auth pointlessly.
      const tokens = await getValidTokensForCall(context);
      const accountId = getAccountId(tokens.accessToken);
      if (!accountId) {
        throw new Error('OpenAI Codex: failed to extract account ID from token. Sign in again from extension settings.');
      }

      const sessionId = currentSessionId ?? '';
      const headers: Record<string, string> = {
        'chatgpt-account-id': accountId,
        'OpenAI-Beta': 'responses=experimental',
        originator: 'aiderdesk',
        'User-Agent': `aiderdesk (${platform()} ${release()}; ${arch()})`,
      };
      if (sessionId) {
        headers['session-id'] = sessionId;
        headers['x-client-request-id'] = sessionId;
      }

      const provider = createOpenAI({
        baseURL: CODEX_BASE_URL,
        apiKey: tokens.accessToken,
        headers,
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
      const cacheKey = currentSessionId ? clampCacheKey(currentSessionId) : undefined;
      return {
        openai: {
          store: false,
          reasoningSummary: 'detailed',
          parallelToolCalls: true,
          ...(cacheKey && { promptCacheKey: cacheKey }),
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
