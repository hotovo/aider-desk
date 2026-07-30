import type { Model } from '@aiderdesk/extensions';

import { describe, expect, it } from 'vitest';

import { calculateCursorUsageCost, mapTokenUsage, type TurnUsage } from '../usage';

const usage: TurnUsage = {
  inputTokens: 1000,
  outputTokens: 200,
  cacheReadTokens: 100,
  cacheWriteTokens: 50,
};

const model: Model = {
  id: 'test-model',
  providerId: 'cursor-sdk',
  inputCostPerToken: 0.00001,
  outputCostPerToken: 0.00002,
  cacheReadInputTokenCost: 0.000002,
  cacheWriteInputTokenCost: 0.00003,
};

describe('Cursor SDK usage costs', () => {
  it('calculates input, output, cache read, and cache write costs', () => {
    expect(calculateCursorUsageCost(usage, model)).toBeCloseTo(0.0147);
  });

  it('maps usage and includes the cumulative agent cost', () => {
    const report = mapTokenUsage(usage, 'test-model', model, 0.02);

    expect(report).toMatchObject({
      model: 'test-model',
      sentTokens: 900,
      receivedTokens: 200,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
    });
    expect(report.messageCost).toBeCloseTo(0.0147);
    expect(report.agentTotalCost).toBeCloseTo(0.0347);
  });

  it('does not include an agent total when one is not provided', () => {
    expect(mapTokenUsage(usage, 'test-model', model)).not.toHaveProperty('agentTotalCost');
  });

  it('uses the input price for cache reads and zero for cache writes when prices are unset', () => {
    expect(calculateCursorUsageCost(usage, {
      id: 'test-model',
      providerId: 'cursor-sdk',
      inputCostPerToken: 0.00001,
      outputCostPerToken: 0.00002,
    })).toBeCloseTo(0.014);
  });
});
