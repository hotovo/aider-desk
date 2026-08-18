import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNetworkEnvVars, getTlsEnvVars, NetworkManager } from '../network-manager';

import type { LlmProvider } from '@common/agent';
import type { ProviderProfile, SettingsData } from '@common/types';

vi.mock('undici', () => {
  class Dispatcher {
    dispatch(): boolean {
      throw new Error('not implemented');
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
    destroy(): Promise<void> {
      return Promise.resolve();
    }
  }
  return {
    Dispatcher,
    Agent: class extends Dispatcher {},
    EnvHttpProxyAgent: class extends Dispatcher {},
    setGlobalDispatcher: vi.fn(),
  };
});

vi.mock('global-agent', () => ({
  bootstrap: vi.fn(),
}));

const baseSettings = {
  language: 'en',
  renderMarkdown: true,
  fullMessageRendering: true,
  aiderDeskAutoUpdate: true,
  telemetryEnabled: false,
} as SettingsData;

const profileWith = (provider: Partial<LlmProvider> & { name: string }): ProviderProfile => ({
  id: 'profile-1',
  provider: provider as LlmProvider,
});

describe('getTlsEnvVars', () => {
  it('emits insecure TLS var for provider with sslVerify disabled', () => {
    const providers = [profileWith({ name: 'openai-compatible', baseUrl: 'https://llm.local', sslVerify: false })];

    expect(getTlsEnvVars(providers)).toEqual({ AIDER_DESK_INSECURE_TLS: '1' });
  });

  it('emits CA bundle path for provider with caCertPath', () => {
    const providers = [profileWith({ name: 'anthropic-compatible', baseUrl: 'https://llm.local', caCertPath: '/ca.pem' })];

    expect(getTlsEnvVars(providers)).toEqual({ AIDER_DESK_CA_BUNDLE_PATH: '/ca.pem' });
  });

  it('prefers insecure over CA bundle and returns first CA path only', () => {
    const providers = [
      profileWith({ name: 'openai-compatible', baseUrl: 'https://a.local', caCertPath: '/first.pem' }),
      profileWith({ name: 'openai-compatible', baseUrl: 'https://b.local', sslVerify: false, caCertPath: '/second.pem' }),
    ];

    expect(getTlsEnvVars(providers)).toEqual({ AIDER_DESK_CA_BUNDLE_PATH: '/first.pem', AIDER_DESK_INSECURE_TLS: '1' });
  });

  it('returns empty vars for providers without TLS overrides', () => {
    const providers = [profileWith({ name: 'openai-compatible', baseUrl: 'https://llm.local' })];

    expect(getTlsEnvVars(providers)).toEqual({});
    expect(getTlsEnvVars([])).toEqual({});
  });
});

describe('getNetworkEnvVars', () => {
  it('merges proxy and TLS vars', () => {
    const settings = { ...baseSettings, proxy: { enabled: true, url: 'http://proxy.local:3128' } } as SettingsData;
    const providers = [profileWith({ name: 'openai-compatible', baseUrl: 'https://llm.local', sslVerify: false })];

    expect(getNetworkEnvVars(settings, providers)).toMatchObject({
      HTTP_PROXY: 'http://proxy.local:3128',
      AIDER_DESK_INSECURE_TLS: '1',
    });
  });

  it('clears proxy vars when proxy disabled', () => {
    const settings = { ...baseSettings, proxy: { enabled: false, url: '' } } as SettingsData;

    expect(getNetworkEnvVars(settings, [])).toMatchObject({ HTTP_PROXY: '' });
  });
});

describe('NetworkManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { GLOBAL_AGENT?: Record<string, unknown> }).GLOBAL_AGENT = {};
  });

  it('applies rules through the registrar interface', () => {
    const manager = new NetworkManager();
    manager.init(baseSettings);

    expect(manager.hasTlsPolicy('https://llm.local')).toBe(false);

    manager.setTlsPolicy('https://llm.local', { rejectUnauthorized: false });
    expect(manager.hasTlsPolicy('https://llm.local')).toBe(true);

    manager.clearTlsPolicy('https://llm.local');
    expect(manager.hasTlsPolicy('https://llm.local')).toBe(false);
  });

  it('re-registering with no override clears the rule', () => {
    const manager = new NetworkManager();
    manager.init(baseSettings);

    manager.setTlsPolicy('https://llm.local', { rejectUnauthorized: false });
    manager.setTlsPolicy('https://llm.local', {});

    expect(manager.hasTlsPolicy('https://llm.local')).toBe(false);
  });

  it('swaps to a different policy when re-set', () => {
    const manager = new NetworkManager();
    manager.init(baseSettings);

    manager.setTlsPolicy('https://llm.local', { rejectUnauthorized: false });
    manager.setTlsPolicy('https://llm.local', { caCertPath: '/ca.pem' });

    expect(manager.hasTlsPolicy('https://llm.local')).toBe(true);
  });

  it('ignores missing CA file without throwing', () => {
    const manager = new NetworkManager();
    manager.init(baseSettings);

    expect(() => manager.setTlsPolicy('https://llm.local', { caCertPath: '/nonexistent-ca.pem' })).not.toThrow();
    expect(manager.hasTlsPolicy('https://llm.local')).toBe(false);
  });

  it('shares one policy dispatcher across origins and drops it when last rule clears', () => {
    const manager = new NetworkManager();
    manager.init(baseSettings);

    manager.setTlsPolicy('https://a.local', { rejectUnauthorized: false });
    manager.setTlsPolicy('https://b.local', { rejectUnauthorized: false });

    manager.clearTlsPolicy('https://a.local');
    expect(manager.hasTlsPolicy('https://b.local')).toBe(true);

    manager.clearTlsPolicy('https://b.local');
    expect(manager.hasTlsPolicy('https://b.local')).toBe(false);
  });
});
