import { describe, expect, it } from 'vitest';

import { isFreeModel, nativeInput, toModel } from '../catalog';

import type { ModelInfo } from '@opencode/client';

const freeModel = (): ModelInfo => ({
  id: 'opencode/nemotron-free',
  modelID: 'nemotron-free',
  providerID: 'opencode',
  name: 'Nemotron Free',
  enabled: true,
  status: 'active',
  capabilities: { tools: true, input: ['text'], output: ['text'] },
  variants: [],
  time: { released: 0 },
  cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
  limit: { context: 100000, output: 8192 },
});

describe('OpenCode Free model selection', () => {
  it('accepts explicitly free chat models and Big Pickle', () => {
    expect(isFreeModel(freeModel())).toBe(true);
    expect(isFreeModel({ ...freeModel(), modelID: 'big-pickle' })).toBe(true);
  });

  it.each([
    { enabled: false },
    { status: 'deprecated' },
    { providerID: 'opencode-go' },
    { modelID: 'paid-model' },
    { cost: [] },
    { cost: [{ input: 0, output: 0.01, cache: { read: 0, write: 0 } }] },
    { cost: [{ input: 0, output: 0, cache: { read: 0, write: 1 } }] },
    { capabilities: { tools: false, input: ['text'], output: ['text'] } },
    { capabilities: { tools: true, input: ['text'], output: ['decision'] } },
  ] satisfies Partial<ModelInfo>[])('rejects ineligible catalog entries: %j', (overrides) => {
    expect(isFreeModel({ ...freeModel(), ...overrides })).toBe(false);
  });

  it('requires every pricing tier to be free', () => {
    const model = freeModel();
    model.cost.push({ input: 0.1, output: 0, cache: { read: 0, write: 0 } });
    expect(isFreeModel(model)).toBe(false);
  });

  it('maps limits and explicitly zeroes all prices', () => {
    expect(toModel(freeModel(), 'profile')).toMatchObject({
      id: 'opencode/nemotron-free',
      providerId: 'profile',
      maxInputTokens: 100000,
      maxOutputTokensLimit: 8192,
      supportsTools: true,
      inputCostPerToken: 0,
      outputCostPerToken: 0,
      cacheReadInputTokenCost: 0,
      cacheWriteInputTokenCost: 0,
    });
  });

  it('maps one-based native read offsets to Power zero-based offsets', () => {
    expect(nativeInput('read', { path: '/fixture', offset: 3, limit: 2 })).toEqual({ filePath: '/fixture', lineOffset: 2, lineLimit: 2 });
    expect(nativeInput('shell', { command: 'pwd', workdir: '/project' })).toEqual({ command: 'pwd', cwd: '/project' });
    expect(nativeInput('shell', { command: 'pwd' })).toEqual({
      command: 'pwd',
    });
  });
});
