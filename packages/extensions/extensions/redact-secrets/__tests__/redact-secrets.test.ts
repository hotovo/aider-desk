import { describe, it, expect } from 'vitest';

import { redactRegexSecrets, redactSecrets } from '../index';

describe('redactRegexSecrets', () => {
  it('redacts OpenAI API keys (sk- format)', () => {
    const input = 'const key = "sk-abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz567890"';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('sk-abcd1234efgh');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts OpenAI project keys (sk-proj- format)', () => {
    const input = 'key: sk-proj-ABCDEFGHIJKLMNOPqrst1234567890WXYZ';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('sk-proj-');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Anthropic API keys', () => {
    const input = 'ANTHROPIC_KEY=sk-ant-api03-1234567890ABCDEFGHIJKLMNOPQRSTUVWX';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('sk-ant-api03-');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts AWS access keys (AKIA prefix)', () => {
    const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('AKIAIOSFODNN7');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts AWS access keys (ASIA prefix)', () => {
    const input = 'credential: ASIAIOSFODNN7EXAMPLE';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('ASIAIOSFODNN7');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts GitHub tokens (ghp_ format)', () => {
    const input = 'token = "ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD"';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('ghp_1234567890');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts GitHub PATs (github_pat_ format)', () => {
    const input = 'GITHUB_PAT=github_pat_1234567890abcdefghijklmnopqrstuvwxyzABCD1234';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('github_pat_');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Google API keys (AIza prefix)', () => {
    const input = 'GOOGLE_API_KEY=AIzaSyABCDEFGHIJKLMNoPQRSTUvwxyz_1234567';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('AIzaSy');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Slack tokens (xox format)', () => {
    const input = 'SLACK_TOKEN=xoxb-1234567890123-abcdefghijklmnop';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('xoxb-');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Stripe secret keys', () => {
    const input = 'stripe_key = sk_live_1234567890ABCDEFGHIJKLMNopqrstuv';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('sk_live_');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Stripe publishable keys', () => {
    const input = 'pk_test_1234567890ABCDEFGHIJKLMNopqrstuv';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('pk_test_');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts JWTs', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3ODkw.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('eyJhbGciOi');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('Bearer abcdefghijklmnopqrstuvwxyz1234567890');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts env assignments with API_KEY', () => {
    const input = 'OPENAI_API_KEY=sk-somethingverylongvalue123';
    const result = redactRegexSecrets(input);
    expect(result).toContain('OPENAI_API_KEY=');
    expect(result).not.toContain('sk-somethingverylongvalue123');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts env assignments with quoted values', () => {
    const input = 'API_KEY: "my-super-secret-value"';
    const result = redactRegexSecrets(input);
    expect(result).toContain('API_KEY=');
    expect(result).not.toContain('my-super-secret-value');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts env assignments for PASSWORD', () => {
    const input = 'PASSWORD=hunter2passwordhere';
    const result = redactRegexSecrets(input);
    expect(result).toContain('PASSWORD=');
    expect(result).not.toContain('hunter2passwordhere');
    expect(result).toContain('<redacted-secret>');
  });

  it('redacts env assignments for PRIVATE_KEY', () => {
    const input = 'PRIVATE_KEY="begin-private-key-data"';
    const result = redactRegexSecrets(input);
    expect(result).toContain('PRIVATE_KEY=');
    expect(result).not.toContain('begin-private-key-data');
    expect(result).toContain('<redacted-secret>');
  });

  it('does not redact non-secret text', () => {
    const input = 'This is a normal text with no secrets in it.';
    const result = redactRegexSecrets(input);
    expect(result).toBe(input);
  });

  it('handles multiple secrets in one string', () => {
    const input = 'key1=sk-1234567890abcdefghijklmnopqrstuv key2=ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD';
    const result = redactRegexSecrets(input);
    expect(result).not.toContain('sk-1234567890');
    expect(result).not.toContain('ghp_1234567890');
    expect(result.match(/<redacted-secret>/g)?.length).toBeGreaterThan(0);
  });
});

describe('redactSecrets (with env values)', () => {
  it('redacts env-based secret values alongside regex patterns', () => {
    const secretValues = new Set(['my-database-password-123']);
    const input = 'DB_PASSWORD=my-database-password-123 and sk-1234567890abcdefghijklmnopqrstuv';
    const result = redactSecrets(input, secretValues);
    expect(result).not.toContain('my-database-password-123');
    expect(result).not.toContain('sk-1234567890');
    expect(result).toContain('<redacted-secret>');
  });

  it('preserves non-secret text', () => {
    const secretValues = new Set<string>();
    const input = 'Just a regular configuration file with no secrets.';
    const result = redactSecrets(input, secretValues);
    expect(result).toBe(input);
  });

  it('redacts both regex matches and env values', () => {
    const secretValues = new Set(['super-secret-env-value']);
    const input = 'ENV_SECRET=super-secret-env-value\nAPI_KEY=sk-1234567890abcdefghijklmnopqrstuv';
    const result = redactSecrets(input, secretValues);
    expect(result).not.toContain('super-secret-env-value');
    expect(result).not.toContain('sk-1234567890');
  });
});
