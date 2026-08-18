import { describe, expect, it, vi } from 'vitest';

import { syncProviderTlsRule } from '../models/utils';

import type { TlsPolicyRegistrar } from '@common/types';

const makeRegistrar = (): { registrar: TlsPolicyRegistrar; setTlsPolicy: ReturnType<typeof vi.fn>; clearTlsPolicy: ReturnType<typeof vi.fn> } => {
  const setTlsPolicy = vi.fn();
  const clearTlsPolicy = vi.fn();
  return { registrar: { setTlsPolicy, clearTlsPolicy }, setTlsPolicy, clearTlsPolicy };
};

describe('syncProviderTlsRule', () => {
  it('registers insecure policy when sslVerify disabled', () => {
    const { registrar, setTlsPolicy, clearTlsPolicy } = makeRegistrar();

    syncProviderTlsRule(registrar, 'https://llm.local:8443/v1', false, undefined);

    expect(setTlsPolicy).toHaveBeenCalledWith('https://llm.local:8443', { rejectUnauthorized: false });
    expect(clearTlsPolicy).not.toHaveBeenCalled();
  });

  it('registers CA policy when caCertPath set', () => {
    const { registrar, setTlsPolicy } = makeRegistrar();

    syncProviderTlsRule(registrar, 'https://llm.local', true, '/ca.pem');

    expect(setTlsPolicy).toHaveBeenCalledWith('https://llm.local', { caCertPath: '/ca.pem' });
  });

  it('registers combined policy when both sslVerify disabled and caCertPath set', () => {
    const { registrar, setTlsPolicy } = makeRegistrar();

    syncProviderTlsRule(registrar, 'https://llm.local', false, '/ca.pem');

    expect(setTlsPolicy).toHaveBeenCalledWith('https://llm.local', { rejectUnauthorized: false, caCertPath: '/ca.pem' });
  });

  it('clears policy when no TLS override is configured', () => {
    const { registrar, setTlsPolicy, clearTlsPolicy } = makeRegistrar();

    syncProviderTlsRule(registrar, 'https://llm.local', true, undefined);
    syncProviderTlsRule(registrar, 'https://llm.local', undefined, '');

    expect(setTlsPolicy).not.toHaveBeenCalled();
    expect(clearTlsPolicy).toHaveBeenCalledWith('https://llm.local');
  });

  it('does nothing without a registrar, base URL, or valid URL', () => {
    const { registrar, setTlsPolicy, clearTlsPolicy } = makeRegistrar();

    syncProviderTlsRule(undefined, 'https://llm.local', false, undefined);
    syncProviderTlsRule(registrar, undefined, false, undefined);
    syncProviderTlsRule(registrar, 'not-a-url', false, undefined);

    expect(setTlsPolicy).not.toHaveBeenCalled();
    expect(clearTlsPolicy).not.toHaveBeenCalled();
  });
});
