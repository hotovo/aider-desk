/**
 * Pins the intentional fail-fast contract of `createStrategyFromDescriptor`:
 * every provider file constructs its strategy at module import time, so an
 * invalid descriptor aborts startup immediately instead of quietly producing a
 * broken strategy. This documents the accepted blast radius (see audit finding
 * F4): these are compile-time-static constants, and types guard most of the
 * descriptor shape, so a throw here means a programming error that should be
 * loud. If this contract is ever revisited, replace these with tests for the
 * new controlled-point validation.
 */
import { describe, expect, it, vi } from 'vitest';

import { createStrategyFromDescriptor, ProviderDescriptor } from '../strategy-factory';

vi.mock('@/logger');

const validDescriptor = (): ProviderDescriptor => ({
  name: 'test-provider',
  label: 'Test Provider',
  sdkFactory: (): never => {
    throw new Error('not used in this test');
  },
  modelsLoader: { type: 'static', items: () => [] },
  aider: { prefix: 'test', apiKeyEnv: 'TEST_API_KEY' },
});

describe('createStrategyFromDescriptor fail-fast descriptor validation', () => {
  it('rejects a descriptor with neither modelsLoader nor overrides.loadModels', () => {
    const descriptor = validDescriptor();
    delete (descriptor as Partial<ProviderDescriptor>).modelsLoader;

    expect(() => createStrategyFromDescriptor(descriptor)).toThrow(/needs modelsLoader or overrides\.loadModels/);
  });

  it('rejects a descriptor with neither aider nor overrides.getAiderMapping', () => {
    const descriptor = validDescriptor();
    delete (descriptor as Partial<ProviderDescriptor>).aider;

    expect(() => createStrategyFromDescriptor(descriptor)).toThrow(/needs aider config or overrides\.getAiderMapping/);
  });

  it('rejects a descriptor with both aider and overrides.getAiderMapping', () => {
    const descriptor = validDescriptor();
    descriptor.overrides = {
      getAiderMapping: () => ({ modelName: 'x', environmentVariables: {} }),
    };

    expect(() => createStrategyFromDescriptor(descriptor)).toThrow(/must not set both aider and overrides\.getAiderMapping/);
  });
});
