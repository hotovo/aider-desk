/**
 * Shared mock harness for the provider snapshot tests: a configurable
 * `getEffectiveEnvironmentVariable` mock and a recording SDK-factory harness.
 *
 * Import the helpers from inside `vi.mock` factories via `await import` —
 * vi.mock factories are hoisted above static imports and cannot reference
 * test-file bindings, but dynamically imported helper modules resolve fine.
 */
import { vi } from 'vitest';
import { Model, ProviderProfile, SettingsData } from '@common/types';

export type SdkCall = { factory: string; kind: string; model: string; callArgs: unknown; options: unknown };

export const envMock = {
  /** every env key consulted via getEffectiveEnvironmentVariable */
  lookups: [] as string[],
  vars: new Map<string, { value: string; source: string }>(),
  getEffectiveEnvironmentVariable: vi.fn((key: string) => {
    envMock.lookups.push(key);
    return envMock.vars.get(key);
  }),
  reset: () => {
    envMock.lookups.length = 0;
    envMock.vars.clear();
  },
};

// ---------------------------------------------------------------------------
// SDK factory mocks — every factory records (callArgs, modelId, call kind)
// and returns a sentinel object so tests can assert identity through the
// whole chain (factory -> provider instance -> model call).
// ---------------------------------------------------------------------------
export const sdkMock = {
  calls: [] as SdkCall[],
  provider: (factory: string) => (callArgs: unknown) => {
    const call = (kind: string) => (model: string, options?: unknown) => {
      sdkMock.calls.push({ factory, kind, model, callArgs, options });
      return { sentinel: kind === 'model' ? `${factory}:${model}` : `${factory}:${kind}:${model}` };
    };
    return Object.assign(call('model'), { responses: call('responses'), chat: call('chat') });
  },
  reset: () => {
    sdkMock.calls.length = 0;
  },
};

export const settings = { aider: { environmentVariables: '', options: '' } } as unknown as SettingsData;

export const profileFor = (provider: Record<string, unknown>, headers?: Record<string, string>): ProviderProfile =>
  ({ id: 'p1', name: 'test-profile', provider, headers }) as unknown as ProviderProfile;

export const model = (id = 'm1') => ({ id, providerId: 'p1' }) as unknown as Model;
