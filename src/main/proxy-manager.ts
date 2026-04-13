import { setGlobalDispatcher, ProxyAgent, Agent as UndiciAgent } from 'undici';
import { bootstrap } from 'global-agent';

import type { SettingsData } from '@common/types';

import logger from '@/logger';

const PROXY_ENV_VAR_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'] as const;

export const getProxyEnvVars = (settings: SettingsData): Record<string, string> => {
  if (settings.proxy?.enabled && settings.proxy?.url) {
    const url = settings.proxy.url;
    return {
      HTTP_PROXY: url,
      HTTPS_PROXY: url,
      ALL_PROXY: url,
      http_proxy: url,
      https_proxy: url,
      all_proxy: url,
    };
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
      this.applyProxy(settings.proxy.url);
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

    if (oldProxy?.enabled !== newProxy?.enabled || oldProxy?.url !== newProxy?.url) {
      if (newProxy?.enabled && newProxy?.url) {
        logger.info(`[ProxyManager] Applying proxy: ${newProxy.url}`);
        this.applyProxy(newProxy.url);
      } else if (this.currentUrl !== null) {
        logger.info('[ProxyManager] Clearing proxy');
        this.clearProxy();
      }
    }
  }

  private applyProxy(url: string): void {
    try {
      // Cover Axios, Got, and legacy HTTP libs via global-agent
      global.GLOBAL_AGENT.HTTP_PROXY = url;

      // Cover native fetch via undici
      const proxyAgent = new ProxyAgent(url);
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
      setGlobalDispatcher(
        new UndiciAgent({
          headersTimeout: 30 * 60 * 1000, // 30 minutes
          bodyTimeout: 30 * 60 * 1000, // 30 minutes
          connectTimeout: 30 * 1000, // 30 seconds
        }),
      );
      this.currentUrl = null;
      logger.info('[ProxyManager] Proxy cleared');
    } catch (error) {
      logger.error('[ProxyManager] Failed to clear proxy', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}
