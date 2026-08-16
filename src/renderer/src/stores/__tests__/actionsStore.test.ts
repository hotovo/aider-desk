import { describe, it, expect, vi, afterEach } from 'vitest';

import { registerAction, unregisterAction, invokeAction } from '../actionsStore';

describe('actionsStore', () => {
  afterEach(() => {
    unregisterAction('test.action');
  });

  it('registers and invokes an action', () => {
    const handler = vi.fn();
    registerAction('test.action', handler);

    const result = invokeAction('test.action');

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns false for unknown action', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = invokeAction('nonexistent.action');

    expect(result).toBe(false);
    expect(warn).toHaveBeenCalledWith('Unknown UI action: nonexistent.action');
    warn.mockRestore();
  });

  it('unregisters an action', () => {
    const handler = vi.fn();
    registerAction('test.action', handler);
    unregisterAction('test.action');

    const result = invokeAction('test.action');

    expect(result).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('overwrites handler when re-registered', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    registerAction('test.action', handler1);
    registerAction('test.action', handler2);

    invokeAction('test.action');

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
  });
});
