import { afterEach, describe, expect, it, vi } from 'vitest';

import { finishStartup } from '../startup';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('finishStartup', () => {
  it('removes the loading shell and signals readiness without removing the application', () => {
    document.body.innerHTML = '<div id="startup"></div><div id="root">Application</div>';
    const ready = vi.fn();
    window.addEventListener('aiderdesk:ready', ready, { once: true });
    finishStartup();
    expect(document.getElementById('startup')).toBeNull();
    expect(document.getElementById('root')?.textContent).toBe('Application');
    expect(ready).toHaveBeenCalledOnce();
  });

  it('is safe without a loading shell, including repeated calls in development', () => {
    expect(() => {
      finishStartup();
      finishStartup();
    }).not.toThrow();
  });
});
