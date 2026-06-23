/**
 * Redact Secrets Extension
 *
 * Redacts secret values from file read results using two layers:
 * 1. Regex-based pattern matching for known secret formats (API keys,
 *    tokens, JWTs, Bearer tokens, inline env assignments).
 * 2. Value-based redaction from .env* files loaded from the project dir.
 *
 * Prevents accidental exposure of API keys, tokens, and other secrets.
 * Regex patterns adapted from Terax-AI (Apache-2.0).
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';

import type { Extension, ExtensionContext, ToolFinishedEvent } from '@aiderdesk/extensions';

const SECRET_KEY_PATTERNS = [
  /API[_-]?KEY/i,
  /TOKEN/i,
  /SECRET/i,
  /PASSWORD/i,
  /PASS[_-]?WD/i,
  /PRIVATE[_-]?KEY/i,
  /ACCESS[_-]?KEY/i,
  /AUTH[_-]?TOKEN/i,
  /BEARER/i,
  /CREDENTIAL/i,
];

const REDACTED_VALUE = '<redacted-secret>';

/**
 * Regex-based patterns for known secret formats. These scan the text of
 * any file read output, regardless of whether a value was found in an
 * env file.
 */
const SECRET_REGEX_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'github-token', re: /\bgh[opsur]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g },
  { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'slack-token', re: /\bxox[bpsare]-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'stripe-key', re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { kind: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{20,}/g },
  {
    kind: 'env-assign',
    re: /\b((?:[A-Z][A-Z0-9_]*)?(?:API[_-]?KEY|SECRET(?:[_-]?KEY)?|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|PASSWORD|PASSWD|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET)[A-Z0-9_]*)\s*[:=]\s*(["']?)([^\s"';|&]+)\2/gi,
  },
];

/**
 * Apply regex-based secret redaction to a string.
 * Handles env-assign patterns specially to preserve the key name and
 * quote characters while redacting only the value.
 */
export const redactRegexSecrets = function (text: string): string {
  let out = text;
  for (const { kind, re } of SECRET_REGEX_PATTERNS) {
    if (kind === 'env-assign') {
      out = out.replace(re, (_m, name, q) => `${name}=${q}<redacted-secret>${q}`);
    } else {
      out = out.replace(re, '<redacted-secret>');
    }
  }
  return out;
};

const isEnvFile = function (filename: string): boolean {
  if (filename.startsWith('.env')) {
    return true;
  }

  if (filename.endsWith('.env')) {
    return true;
  }

  const commonEnvFiles = ['.flaskenv', '.envrc', '.env.defaults'];
  if (commonEnvFiles.includes(filename)) {
    return true;
  }

  return false;
};

const loadEnvSecretValues = function (projectDir: string): Set<string> {
  const secretValues: Set<string> = new Set();
  const envFiles: string[] = [];

  try {
    const files = readdirSync(projectDir);
    for (const file of files) {
      if (isEnvFile(file)) {
        envFiles.push(join(projectDir, file));
      }
    }
  } catch {
    return secretValues;
  }

  for (const envFile of envFiles) {
    try {
      const parsed = config({ path: envFile });
      if (parsed.parsed) {
        for (const [key, value] of Object.entries(parsed.parsed)) {
          if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
            secretValues.add(value);
          }
        }
      }
    } catch {
      // Ignore errors loading individual env files
    }
  }

  return secretValues;
};

export const redactSecrets = function (text: string, secretValues: Set<string>): string {
  let result = redactRegexSecrets(text);
  for (const secret of secretValues) {
    if (secret && secret.length > 0) {
      result = result.split(secret).join(REDACTED_VALUE);
    }
  }
  return result;
};

const redactObject = function (obj: unknown, secretValues: Set<string>): unknown {
  if (typeof obj === 'string') {
    return redactSecrets(obj, secretValues);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, secretValues));
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = redactObject(value, secretValues);
    }
    return result;
  }

  return obj;
};

export default class RedactSecretsExtension implements Extension {
  static metadata = {
    name: 'Redact Secrets',
    version: '2.0.0',
    description: 'Redacts secrets from file read results using regex patterns and .env* file values',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/redact-secrets/icon.png',
    capabilities: ['security'],
  };

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>> {
    if (event.toolName !== 'power---file_read') {
      return undefined;
    }

    const projectDir = context.getProjectDir();
    const secretValues = loadEnvSecretValues(projectDir);

    const redactedOutput = redactObject(event.output, secretValues);

    return {
      output: redactedOutput,
    };
  }
}
