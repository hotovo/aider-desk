import { describe, expect, it } from 'vitest';

import { translate } from '../i18n';

describe('translate', () => {
  it('resolves a nested key in the requested language', () => {
    expect(translate('zh', 'mcp.oauth.authenticationRequired')).toBe('需要 OAuth 身份验证。');
  });

  it('interpolates placeholders in the message', () => {
    const message = translate('en', 'mcp.oauth.authenticationRequiredMessage', { serverName: 'sentry' });
    expect(message).toBe("MCP server 'sentry' requires OAuth authentication. Connect it in Settings → MCP Servers.");
  });

  it('translates the message for other languages', () => {
    expect(translate('zh', 'mcp.oauth.authenticationRequiredMessage', { serverName: 'sentry' })).toContain('需要 OAuth 身份验证');
    expect(translate('ru', 'mcp.oauth.authenticationRequiredMessage', { serverName: 'sentry' })).toContain('требует аутентификацию');
    expect(translate('ko', 'mcp.oauth.authenticationRequiredMessage', { serverName: 'sentry' })).toContain('OAuth 인증이 필요');
  });

  it('falls back to English for unknown languages and missing keys', () => {
    expect(translate('fr', 'mcp.oauth.authenticationRequired', {})).toBe('OAuth authentication is required.');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });
});
