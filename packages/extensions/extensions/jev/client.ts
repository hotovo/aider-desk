/**
 * JevClient — resolves provider + credentials from extension config, falling back to
 * AiderDesk provider settings and environment. Ported from github.com/disler/ten-levels-of-jev (MIT).
 *
 * Wire formats:
 * - typesafe: native SystemOne contract, POST https://api.typesafe.ai/v1/systemone
 * - openrouter: same native contract via https://openrouter.ai/api/alpha/decisions
 * - requesty: Chat Completions with response_format {type: 'questions'}; answers parsed from the assistant message
 */
import { MockJev } from './mock';
import { validateRequest, validateResponse, type JevProvider, type Questions, type State, type SystemOneRequest, type SystemOneResponse } from './types';

const ENDPOINTS = {
  typesafe: 'https://api.typesafe.ai/v1/systemone',
  openrouter: 'https://openrouter.ai/api/alpha/decisions',
  requesty: 'https://router.requesty.ai/v1/chat/completions',
} as const;

const DEFAULT_MODELS = {
  typesafe: 'jev-latest',
  openrouter: '~typesafe/jev-latest',
  requesty: 'typesafe/jev-latest',
  mock: 'jev-1.13.0-mock',
} as const;

const KEY_ENV = {
  typesafe: 'TYPESAFE_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  requesty: 'REQUESTY_API_KEY',
  mock: '',
} as const;

const RETRY_STATUSES = new Set([429, 502, 503, 529]);
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

export interface JevClientConfig {
  provider: JevProvider;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface SystemOneResult {
  model: string;
  answers: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number | null };
  meta: { provider: JevProvider; resolvedModel: string; elapsedMs: number; attempts: number };
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Requesty wraps answers in an assistant message; unwrap to the standard {model, answers, usage} shape. */
const convertRequestyResponse = (parsed: unknown, requestedModel: string): unknown => {
  if (!isRecord(parsed) || !Array.isArray(parsed.choices) || !parsed.choices.length) {
    throw new Error('Invalid Requesty response envelope: expected choices.');
  }
  const message = (parsed.choices[0] as { message?: { content?: unknown } }).message;
  let contentUnknown = message?.content;
  if (typeof contentUnknown === 'string') {
    try {
      contentUnknown = JSON.parse(contentUnknown);
    } catch {
      throw new Error('Requesty assistant content is not JSON.');
    }
  }
  if (!isRecord(contentUnknown)) throw new Error('Requesty assistant content must be a JSON object.');
  const answers = isRecord(contentUnknown.answers) ? contentUnknown.answers : contentUnknown;
  const usage = isRecord(parsed.usage) ? parsed.usage : {};
  const reportedCost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : undefined;
  return {
    model: typeof parsed.model === 'string' ? parsed.model : requestedModel,
    answers,
    usage: {
      input_tokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
      output_tokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0,
      ...(reportedCost !== undefined ? { cost: reportedCost } : {}),
    },
  };
};

/** Requesty uses Chat Completions: state as user message(s), questions in response_format. */
const toRequestyRequest = (request: SystemOneRequest, state: State): unknown => {
  const stateText = typeof state === 'string' ? state : JSON.stringify(state);
  return {
    model: request.model,
    messages: [{ role: 'user', content: stateText }],
    response_format: { type: 'questions', questions: request.questions },
  };
};

const extractCost = (usage: { cost?: unknown }): number | null =>
  typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : null;

export class JevClient {
  readonly provider: JevProvider;
  private readonly apiKey?: string;
  private readonly model?: string;
  private readonly timeoutMs: number;
  private readonly mock = new MockJev();

  constructor(config: JevClientConfig) {
    this.provider = config.provider;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.model = config.model?.trim() || undefined;
    this.timeoutMs = config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : REQUEST_TIMEOUT_MS;
  }

  get isLive(): boolean {
    return this.provider !== 'mock';
  }

  async systemOne(
    state: State,
    questions: Questions,
    opts: { model?: string; signal?: AbortSignal } = {},
  ): Promise<SystemOneResult> {
    const requestedModel = opts.model ?? this.model ?? DEFAULT_MODELS[this.provider];

    if (this.provider === 'mock') {
      const response = this.mock.systemOne({ model: requestedModel, state, questions });
      return {
        model: response.model,
        answers: response.answers,
        usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens, cost_usd: 0 },
        meta: { provider: this.provider, resolvedModel: response.model, elapsedMs: 0, attempts: 1 },
      };
    }

    const request: SystemOneRequest = { model: requestedModel, state, questions };
    validateRequest(request);
    const bodyText = JSON.stringify(this.provider === 'requesty' ? toRequestyRequest(request, state) : request);

    const started = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      opts.signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(this.timeoutMs);
      const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
      try {
        const res = await fetch(ENDPOINTS[this.provider], {
          method: 'POST',
          headers: this.headers(),
          body: bodyText,
          signal,
          redirect: 'error',
        });
        if (RETRY_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
          await res.body?.cancel();
          const retryAfter = Number(res.headers.get('retry-after')) * 1000;
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 8000) : 500 * 2 ** (attempt - 1), opts.signal);
          continue;
        }
        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          const snippet = errorBody ? ` — ${errorBody.slice(0, 500)}` : '';
          const hint = res.status === 401 ? ` Check the ${KEY_ENV[this.provider]}.` : res.status === 402 ? ' Check account credits.' : '';
          throw new Error(`Jev ${this.provider} HTTP ${res.status}.${hint}${snippet}`);
        }
        const responseText = await res.text();
        opts.signal?.throwIfAborted();
        let parsed: unknown;
        try {
          parsed = JSON.parse(responseText);
        } catch {
          throw new Error('Invalid response JSON.');
        }
        const converted = this.provider === 'requesty' ? convertRequestyResponse(parsed, requestedModel) : parsed;
        const valid = validateResponse(converted, questions);
        return {
          model: valid.model,
          answers: valid.answers as Record<string, unknown>,
          usage: { ...valid.usage, cost_usd: extractCost(valid.usage) },
          meta: { provider: this.provider, resolvedModel: valid.model, elapsedMs: Date.now() - started, attempts: attempt },
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (opts.signal?.aborted || timeout.aborted) throw lastError;
        if (err instanceof TypeError) throw lastError; // network-level failures are not retried
        if (attempt === MAX_ATTEMPTS) throw lastError;
      }
    }
    throw lastError ?? new Error('Jev request failed');
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (this.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://aiderdesk.hotovo.com';
      headers['X-Title'] = 'AiderDesk';
    }
    return headers;
  }
}
