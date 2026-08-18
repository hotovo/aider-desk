export interface TlsPolicyOptions {
  rejectUnauthorized?: boolean;
  caCertPath?: string;
}

export interface TlsPolicyRegistrar {
  setTlsPolicy(origin: string, options: TlsPolicyOptions): void;
  clearTlsPolicy(origin: string): void;
}
