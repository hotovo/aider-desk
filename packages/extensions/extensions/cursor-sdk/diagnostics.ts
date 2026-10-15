export const redactCursorDiagnostic = (message: string, secrets: string[] = []): string => {
  let redacted = message;
  for (const secret of secrets.filter(Boolean).sort((left, right) => right.length - left.length)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization)(["']?\s*[:=]\s*["']?)[^\s,"';&}]+/gi, '$1$2[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@');
};

export const formatCursorError = (error: unknown, secrets: string[] = []): string => {
  const details = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : undefined;
  const message = typeof details?.message === 'string' ? details.message : String(error);
  const metadata = ['code', 'status', 'operation', 'requestId', 'isRetryable']
    .filter((key) => typeof details?.[key] === 'string' || typeof details?.[key] === 'number' || typeof details?.[key] === 'boolean')
    .map((key) => `${key}=${details?.[key]}`);
  return redactCursorDiagnostic(`${message}${metadata.length ? ` (${metadata.join(', ')})` : ''}`, secrets);
};
