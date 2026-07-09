import { setGlobalDispatcher, EnvHttpProxyAgent, Agent as UndiciAgent } from 'undici';
import { bootstrap } from 'global-agent';

import type { SettingsData } from '@common/types';

import logger from '@/logger';

const PROXY_ENV_VAR_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'] as const;
const HEADERS_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const BODY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CONNECT_TIMEOUT_MS = 30 * 1000; // 30 seconds

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

export class ProxyManager {
  private currentUrl: string | null = null;

  /**
   * Initialize proxy from settings. Called once during app startup (first in managers init).
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
   * Re-initializes the proxy if the config changed.
   */
  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData): void {
    const oldProxy = oldSettings.proxy;
    const newProxy = newSettings.proxy;

    if (oldProxy?.enabled !== newProxy?.enabled || oldProxy?.url !== newProxy?.url || oldProxy?.noProxy !== newProxy?.noProxy) {
      if (newProxy?.enabled && newProxy?.url) {
        logger.info(`[ProxyManager] Applying proxy: ${newProxy.url}`);
        this.applyProxy(newProxy.url, newProxy.noProxy);
      } else if (this.currentUrl !== null) {
        logger.info('[ProxyManager] Clearing proxy');
        this.clearProxy();
      }
    }
  }

  private applyProxy(url: string, noProxy?: string): void {
    try {
      // Cover Axios, Got, and legacy HTTP libs via global-agent
      global.GLOBAL_AGENT.HTTP_PROXY = url;
      global.GLOBAL_AGENT.NO_PROXY = noProxy || undefined;

      const proxyAgent = new EnvHttpProxyAgent({
        httpProxy: url,
        httpsProxy: url,
        noProxy: noProxy || undefined,
        headersTimeout: HEADERS_TIMEOUT_MS,
        bodyTimeout: BODY_TIMEOUT_MS,
        connectTimeout: CONNECT_TIMEOUT_MS,
      });
      setGlobalDispatcher(proxyAgent);

      this.currentUrl = url;
      logger.info(`[ProxyManager] Proxy initialized: ${url}`);
    } catch (error) {
      logger.error('[ProxyManager] Failed to initialize proxy', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private clearProxy(): void {
    try {
      global.GLOBAL_AGENT.HTTP_PROXY = undefined;
      global.GLOBAL_AGENT.NO_PROXY = undefined;
      setGlobalDispatcher(
        new UndiciAgent({
          headersTimeout: HEADERS_TIMEOUT_MS,
          bodyTimeout: BODY_TIMEOUT_MS,
          connectTimeout: CONNECT_TIMEOUT_MS,
        }),
      );
      this.currentUrl = null;
      logger.info('[ProxyManager] Proxy cleared');
    } catch (error) {
      logger.error('[ProxyManager] Failed to clear proxy', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
