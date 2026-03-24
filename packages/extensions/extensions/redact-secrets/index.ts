/**
 * Redact Secrets Extension
 *
 * Loads .env* files and redacts secret values from file read results.
 * Prevents accidental exposure of API keys, tokens, and other secrets.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { config } from 'dotenv';

import type { Extension, ExtensionContext, ToolFinishedEvent } from '@aiderdesk/extensions';

const SECRET_PATTERNS = [
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

const loadEnvFiles = function (projectDir: string): Set<string> {
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
          if (SECRET_PATTERNS.some((pattern) => pattern.test(key))) {
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

const redactSecrets = function (text: string, secretValues: Set<string>): string {
  let result = text;
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
    version: '1.0.0',
    description: 'Redacts secret values from .env* files in file read results',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/redact-secrets/icon.png',
    capabilities: ['security'],
  };

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>> {
    if (event.toolName !== 'power---file_read') {
      return undefined;
    }

    const projectDir = context.getProjectDir();
    const secretValues = loadEnvFiles(projectDir);

    if (secretValues.size === 0) {
      return undefined;
    }

    const redactedOutput = redactObject(event.output, secretValues);

    return {
      output: redactedOutput,
    };
  }
}
