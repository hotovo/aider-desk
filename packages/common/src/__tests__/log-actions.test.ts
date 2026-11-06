import { describe, expect, it } from 'vitest';

import { getLogActions } from '../log-actions';

import type { LogAction } from '../types';

describe('getLogActions', () => {
  it('preserves actions with and without JSON payloads through serialization', () => {
    const actions: LogAction[] = [
      { id: 'interrupt' },
      { id: 'custom', data: { snapshotId: 'snapshot-1', values: [null, true, 42, 'text', { nested: false }] } },
      { id: 'null', data: null },
      { id: 'primitive', data: false },
    ];
    const source = JSON.parse(JSON.stringify({ actions })) as { actions: LogAction[] };

    expect(getLogActions(source)).toEqual(actions);
    expect(getLogActions(source)).toBe(source.actions);
  });

  it('converts legacy action IDs without losing their order', () => {
    expect(getLogActions({ actionIds: ['interrupt', 'continue-rebase'] })).toEqual([{ id: 'interrupt' }, { id: 'continue-rebase' }]);
  });

  it('prefers structured actions, including an explicitly empty array', () => {
    expect(getLogActions({ actions: [], actionIds: ['interrupt'] })).toEqual([]);
  });

  it('keeps missing actions optional', () => {
    expect(getLogActions({})).toBeUndefined();
  });
});
