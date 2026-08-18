import { readFileSync } from 'fs';

import { setGlobalDispatcher, EnvHttpProxyAgent, Agent as UndiciAgent, Dispatcher } from 'undici';
import { bootstrap } from 'global-agent';

import type { ProviderProfile, SettingsData, TlsPolicyOptions, TlsPolicyRegistrar } from '@common/types';

import logger from '@/logger';

const PROXY_ENV_VAR_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'] as const;
const HEADERS_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const BODY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CONNECT_TIMEOUT_MS = 30 * 1000; // 30 seconds

type TlsConnectOptions = {
  rejectUnauthorized?: false;
  ca?: string[];
};

class TlsRoutingDispatcher extends Dispatcher {
  constructor(
    private readonly resolveDispatcher: (origin: string | undefined) => Dispatcher,
    private readonly getAllDispatchers: () => Dispatcher[],
  ) {
    super();
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    const origin = typeof options.origin === 'string' ? options.origin : options.origin instanceof URL ? options.origin.origin : undefined;
    return this.resolveDispatcher(origin).dispatch(options, handler);
  }

  close(): Promise<void> {
    return Promise.all(this.getAllDispatchers().map((dispatcher) => dispatcher.close())).then(() => undefined);
  }

  destroy(): Promise<void> {
    return Promise.all(this.getAllDispatchers().map((dispatcher) => dispatcher.destroy())).then(() => undefined);
  }
}

export const getProxyEnvVars = (settings: SettingsData): Record<string, string> => {
  if (settings.proxy?.enabled && settings.proxy?.url) {
    const url = settings.proxy.url;
    const noProxy = settings.proxy.noProxy;
    const vars: Record<string, string> = {
      HTTP_PROXY: url,
      HTTPS_PROXY: url,
      ALL_PROXY: url,
      http_proxy: url,
      https_proxy: url,
      all_proxy: url,
    };
    if (noProxy) {
      vars.NO_PROXY = noProxy;
      vars.no_proxy = noProxy;
    }
    return vars;
  }
  return Object.fromEntries(PROXY_ENV_VAR_NAMES.map((key) => [key, '']));
};

export const getTlsEnvVars = (providers: ProviderProfile[]): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const profile of providers || []) {
    const provider = profile.provider as { sslVerify?: boolean; caCertPath?: string } | undefined;
    if (!provider) {
      continue;
    }
    if (provider.sslVerify === false) {
      vars.AIDER_DESK_INSECURE_TLS = '1';
    } else if (provider.caCertPath && !vars.AIDER_DESK_CA_BUNDLE_PATH) {
      vars.AIDER_DESK_CA_BUNDLE_PATH = provider.caCertPath;
    }
  }
  return vars;
};

export const getNetworkEnvVars = (settings: SettingsData, providers: ProviderProfile[]): Record<string, string> => ({
  ...getProxyEnvVars(settings),
  ...getTlsEnvVars(providers),
});

export class NetworkManager implements TlsPolicyRegistrar {
  private currentUrl: string | null = null;
  private currentNoProxy: string | undefined;
  private readonly tlsRules = new Map<string, string>();
  private readonly tlsPolicies = new Map<string, TlsConnectOptions>();
  private readonly policyDispatchers = new Map<string, Dispatcher>();
  private defaultDispatcher: Dispatcher = new UndiciAgent();
  private router: TlsRoutingDispatcher = new TlsRoutingDispatcher(
    (origin) => this.resolveDispatcher(origin),
    () => this.getAllDispatchers(),
  );

  /**
   * Initialize network settings from settings. Called once during app startup (first in managers init).
   */
  init(settings: SettingsData): void {
    bootstrap();

    if (settings.proxy?.enabled && settings.proxy?.url) {
      this.applyProxy(settings.proxy.url, settings.proxy.noProxy);
    } else {
      this.clearProxy();
    }
  }

  /**
   * React to settings changes. Called on every saveSettings().
   * Re-initializes the proxy if the proxy config changed.
   */
  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData): void {
    const oldProxy = oldSettings.proxy;
    const newProxy = newSettings.proxy;

    if (oldProxy?.enabled !== newProxy?.enabled || oldProxy?.url !== newProxy?.url || oldProxy?.noProxy !== newProxy?.noProxy) {
      if (newProxy?.enabled && newProxy?.url) {
        logger.info(`[NetworkManager] Applying proxy: ${newProxy.url}`);
        this.applyProxy(newProxy.url, newProxy.noProxy);
      } else if (this.currentUrl !== null) {
        logger.info('[NetworkManager] Clearing proxy');
        this.clearProxy();
      }
    }
  }

  setTlsPolicy(origin: string, options: TlsPolicyOptions): void {
    let connectOptions: TlsConnectOptions | undefined;
    let policyKey: string | undefined;

    if (options.rejectUnauthorized === false) {
      connectOptions = { rejectUnauthorized: false };
      policyKey = 'insecure';
    } else if (options.caCertPath) {
      try {
        connectOptions = { ca: [readFileSync(options.caCertPath).toString()] };
        policyKey = `ca:${options.caCertPath}`;
      } catch (error) {
        logger.error(`[NetworkManager] Failed to load CA certificate from ${options.caCertPath}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }

    if (!connectOptions || !policyKey) {
      this.clearTlsPolicy(origin);
      return;
    }

    if (!this.tlsPolicies.has(policyKey)) {
      this.tlsPolicies.set(policyKey, connectOptions);
      this.policyDispatchers.set(policyKey, this.buildDispatcher(connectOptions));
    }
    if (this.tlsRules.get(origin) !== policyKey) {
      this.tlsRules.set(origin, policyKey);
      logger.info(`[NetworkManager] TLS policy registered for ${origin} (${policyKey})`);
    }
  }

  hasTlsPolicy(origin: string): boolean {
    return this.tlsRules.has(origin);
  }

  clearTlsPolicy(origin: string): void {
    const policyKey = this.tlsRules.get(origin);
    if (!policyKey) {
      return;
    }

    this.tlsRules.delete(origin);
    if (![...this.tlsRules.values()].includes(policyKey)) {
      this.tlsPolicies.delete(policyKey);
      const dispatcher = this.policyDispatchers.get(policyKey);
      this.policyDispatchers.delete(policyKey);
      if (dispatcher) {
        void dispatcher.close();
      }
    }
  }

  private resolveDispatcher(origin: string | undefined): Dispatcher {
    if (origin) {
      const policyKey = this.tlsRules.get(origin);
      if (policyKey) {
        return this.policyDispatchers.get(policyKey) ?? this.defaultDispatcher;
      }
    }
    return this.defaultDispatcher;
  }

  private getAllDispatchers(): Dispatcher[] {
    return [this.defaultDispatcher, ...this.policyDispatchers.values()];
  }

  private applyProxy(url: string, noProxy?: string): void {
    try {
      // Cover Axios, Got, and legacy HTTP libs via global-agent
      global.GLOBAL_AGENT.HTTP_PROXY = url;
      global.GLOBAL_AGENT.NO_PROXY = noProxy || undefined;

      this.currentUrl = url;
      this.currentNoProxy = noProxy;
      this.rebuildDispatchers();

      logger.info(`[NetworkManager] Proxy initialized: ${url}`);
    } catch (error) {
      logger.error('[NetworkManager] Failed to initialize proxy', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private clearProxy(): void {
    try {
      global.GLOBAL_AGENT.HTTP_PROXY = undefined;
      global.GLOBAL_AGENT.NO_PROXY = undefined;

      this.currentUrl = null;
      this.currentNoProxy = undefined;
      this.rebuildDispatchers();

      logger.info('[NetworkManager] Proxy cleared');
    } catch (error) {
      logger.error('[NetworkManager] Failed to clear proxy', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private rebuildDispatchers(): void {
    const oldDispatchers = this.getAllDispatchers();

    this.defaultDispatcher = this.buildDispatcher();
    this.policyDispatchers.clear();
    for (const [policyKey, connectOptions] of this.tlsPolicies) {
      this.policyDispatchers.set(policyKey, this.buildDispatcher(connectOptions));
    }

    setGlobalDispatcher(this.router);
    oldDispatchers.forEach((dispatcher) => void dispatcher.close());
  }

  private buildDispatcher(connectOptions?: TlsConnectOptions): Dispatcher {
    const baseOptions = {
      headersTimeout: HEADERS_TIMEOUT_MS,
      bodyTimeout: BODY_TIMEOUT_MS,
      connectTimeout: CONNECT_TIMEOUT_MS,
      // `connect` applies to plain Agents, `requestTls` to origins tunneled through ProxyAgent CONNECT
      ...(connectOptions ? { connect: connectOptions, requestTls: connectOptions } : {}),
    };

    if (this.currentUrl) {
      return new EnvHttpProxyAgent({
        httpProxy: this.currentUrl,
        httpsProxy: this.currentUrl,
        noProxy: this.currentNoProxy || undefined,
        ...baseOptions,
      });
    }
    return new UndiciAgent(baseOptions);
  }
}
