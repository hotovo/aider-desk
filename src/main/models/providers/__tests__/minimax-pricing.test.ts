/**
 * Pricing-parity lock for the shared MiniMax-M3 entry: the minimax strategy and
 * the ClinePass vendor catalog must expose exactly the same shared pricing
 * (MINIMAX_M3_MODEL_PRICING), while keeping their provider-specific ids.
 */
import { describe, expect, it, vi } from 'vitest';

import { clinePassProviderStrategy } from '../clinepass';
import { minimaxProviderStrategy, MINIMAX_M3_MODEL_PRICING } from '../minimax';

import { profileFor, settings } from './test-utils';

vi.mock('@/logger');

vi.mock('@/utils/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/environment')>();
  const { envMock } = await import('./test-utils');
  return { ...actual, getEffectiveEnvironmentVariable: envMock.getEffectiveEnvironmentVariable };
});

const loadStaticClinePassModels = async (): Promise<{ id: string }[]> => {
  // no apiKey anywhere -> ClinePass falls back to its static catalog
  const result = await clinePassProviderStrategy.loadModels!(profileFor({ name: 'clinepass' }), settings);
  expect(result.success).toBe(true);
  return result.models as { id: string }[];
};

const loadMinimaxModels = async (): Promise<{ id: string }[]> => {
  const result = await minimaxProviderStrategy.loadModels!(profileFor({ name: 'minimax' }), settings);
  expect(result.success).toBe(true);
  return result.models as { id: string }[];
};

describe('MiniMax-M3 shared pricing parity', () => {
  it('minimax and clinepass expose identical shared pricing for MiniMax M3', async () => {
    const minimaxM3 = (await loadMinimaxModels()).find((m) => m.id === 'MiniMax-M3');
    const clinepassM3 = (await loadStaticClinePassModels()).find((m) => m.id === 'minimax-m3');

    expect(minimaxM3).toBeDefined();
    expect(clinepassM3).toBeDefined();

    // both spread the same shared pricing entry, including cache-write cost
    expect(minimaxM3).toMatchObject(MINIMAX_M3_MODEL_PRICING);
    expect(clinepassM3).toMatchObject(MINIMAX_M3_MODEL_PRICING);

    // ids and provider-specific catalog metadata stay independent
    expect(minimaxM3!.id).toBe('MiniMax-M3');
    expect(clinepassM3!.id).toBe('minimax-m3');
  });
});
