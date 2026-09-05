import { describe, expect, it } from 'vitest';

import { ModelManager } from '../model-manager';

import type { OllamaProvider } from '@common/agent';
import type { Model, ProviderProfile } from '@common/types';

const makeManager = (models: Model[]): ModelManager => {
  const manager = Object.create(ModelManager.prototype) as ModelManager;
  (manager as unknown as { providerModels: Record<string, Model[]> }).providerModels = { prov: models };
  return manager;
};

const provider: ProviderProfile = { id: 'prov', provider: { name: 'ollama', baseUrl: '' } as unknown as OllamaProvider };

describe('ModelManager.modelSupportsVision', () => {
  it('returns false when the model is explicitly non-vision', () => {
    const manager = makeManager([{ id: 'm', providerId: 'prov', supportsVision: false }]);
    expect(manager.modelSupportsVision(provider, 'm')).toBe(false);
  });

  it('returns true when the model is explicitly vision-capable', () => {
    const manager = makeManager([{ id: 'm', providerId: 'prov', supportsVision: true }]);
    expect(manager.modelSupportsVision(provider, 'm')).toBe(true);
  });

  it('returns true when supportsVision is unknown (e.g. cloud models)', () => {
    const manager = makeManager([{ id: 'm', providerId: 'prov' }]);
    expect(manager.modelSupportsVision(provider, 'm')).toBe(true);
  });

  it('returns true when the model is not loaded (unknown)', () => {
    const manager = makeManager([]);
    expect(manager.modelSupportsVision(provider, 'm')).toBe(true);
  });

  it('accepts a Model object directly', () => {
    const manager = makeManager([]);
    expect(manager.modelSupportsVision(provider, { id: 'm', providerId: 'prov', supportsVision: false })).toBe(false);
  });
});
