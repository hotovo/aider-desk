import type { ModelListItem, ModelSelection } from '@cursor/sdk';

import { createModelAliases, resolveModelSelection } from '../model-selection';

describe('Cursor SDK model selections', () => {
  const model: ModelListItem = {
    id: 'claude-fable-5',
    displayName: 'Claude Fable 5',
    parameters: [
      { id: 'context', values: [{ value: '200k' }, { value: '1m' }] },
      { id: 'effort', values: [{ value: 'low' }, { value: 'high' }] },
      { id: 'thinking', values: [{ value: 'false' }, { value: 'true' }] },
    ],
    variants: [
      {
        displayName: 'High reasoning',
        isDefault: true,
        params: [
          { id: 'context', value: '200k' },
          { id: 'effort', value: 'high' },
          { id: 'thinking', value: 'true' },
        ],
      },
      {
        displayName: 'High reasoning with 1M context',
        params: [
          { id: 'context', value: '1m' },
          { id: 'effort', value: 'high' },
          { id: 'thinking', value: 'true' },
        ],
      },
      {
        displayName: 'Thinking disabled',
        params: [
          { id: 'context', value: '1m' },
          { id: 'effort', value: 'high' },
          { id: 'thinking', value: 'false' },
        ],
      },
    ],
  };

  it('uses readable effort aliases and adds a context suffix only for 1M context', () => {
    expect(createModelAliases(model)).toEqual([
      {
        id: 'claude-fable-5-high',
        selection: {
          id: 'claude-fable-5',
          params: [
            { id: 'context', value: '200k' },
            { id: 'effort', value: 'high' },
            { id: 'thinking', value: 'true' },
          ],
        },
      },
      {
        id: 'claude-fable-5-high[1m]',
        selection: {
          id: 'claude-fable-5',
          params: [
            { id: 'context', value: '1m' },
            { id: 'effort', value: 'high' },
            { id: 'thinking', value: 'true' },
          ],
        },
      },
    ]);
  });

  it('does not list effort variants unless thinking is enabled', () => {
    const aliases = createModelAliases(model);

    expect(aliases.some((alias) => alias.selection.params?.some(
      (param) => param.id === 'thinking' && param.value === 'false',
    ))).toBe(false);
  });

  it('uses Cursor reasoning levels in aliases and filters disabled reasoning', () => {
    const aliases = createModelAliases({
      id: 'gpt-5.6-luna',
      displayName: 'GPT-5.6 Luna',
      variants: [
        { params: [{ id: 'context', value: '272k' }, { id: 'fast', value: 'false' }, { id: 'reasoning', value: 'none' }] },
        { params: [{ id: 'context', value: '272k' }, { id: 'fast', value: 'false' }, { id: 'reasoning', value: 'high' }] },
        { params: [{ id: 'context', value: '1m' }, { id: 'fast', value: 'true' }, { id: 'reasoning', value: 'high' }] },
      ],
    } as ModelListItem);

    expect(aliases.map((alias) => alias.id)).toEqual([
      'gpt-5.6-luna-high',
      'gpt-5.6-luna-high-fast[1m]',
    ]);
  });

  it('resolves a displayed alias to its exact Cursor selection and supports the legacy fast alias', () => {
    const selections = new Map<string, ModelSelection>(
      createModelAliases(model).map((alias) => [alias.id, alias.selection]),
    );

    expect(resolveModelSelection('claude-fable-5-high[1m]', selections)).toEqual({
      id: 'claude-fable-5',
      params: [
        { id: 'context', value: '1m' },
        { id: 'effort', value: 'high' },
        { id: 'thinking', value: 'true' },
      ],
    });
    expect(resolveModelSelection('composer-2.5#cursor-sdk-params=effort=high&thinking=true', selections)).toEqual({
      id: 'composer-2.5',
      params: [
        { id: 'effort', value: 'high' },
        { id: 'thinking', value: 'true' },
      ],
    });
    expect(resolveModelSelection('composer-2.5-fast', selections)).toEqual({
      id: 'composer-2.5',
      params: [{ id: 'fast', value: 'true' }],
    });
  });
});
