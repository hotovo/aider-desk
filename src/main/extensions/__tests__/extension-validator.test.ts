import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

import { ExtensionValidator } from '@/extensions';

describe('ExtensionValidator', () => {
  let validator: ExtensionValidator;
  const fixturesDir = path.join(__dirname, '..', '__fixtures__');
  const validExtensionPath = path.join(fixturesDir, 'valid-extension.ts');
  const invalidExtensionPath = path.join(fixturesDir, 'invalid-syntax.ts');

  beforeEach(() => {
    validator = new ExtensionValidator();
  });

  it('should validate a valid extension', async () => {
    const result = await validator.validateExtension(validExtensionPath);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  }, 10000);

  it('should report errors for an invalid extension', async () => {
    const result = await validator.validateExtension(invalidExtensionPath);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
