import type { TlsPolicyOptions, TlsPolicyRegistrar } from '@common/types';

export const syncProviderTlsRule = (registrar: TlsPolicyRegistrar | undefined, baseUrl: string | undefined, sslVerify?: boolean, caCertPath?: string): void => {
  if (!registrar) {
    return;
  }

  let origin: string | undefined;
  try {
    origin = baseUrl ? new URL(baseUrl).origin : undefined;
  } catch {
    origin = undefined;
  }
  if (!origin) {
    return;
  }

  const options: TlsPolicyOptions = {
    ...(sslVerify === false ? { rejectUnauthorized: false } : {}),
    ...(caCertPath ? { caCertPath } : {}),
  };

  if (options.rejectUnauthorized === false || options.caCertPath) {
    registrar.setTlsPolicy(origin, options);
  } else {
    registrar.clearTlsPolicy(origin);
  }
};
