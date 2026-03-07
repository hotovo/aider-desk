/**
 * Type integration test for renderer process
 * Verifies that extension types work correctly in the renderer (browser) process
 */

import { describe, it, expect } from 'vitest';

import type { ExtensionMetadata, ToolResult } from '../../../common/extensions';

// Test ExtensionMetadata type in renderer
const metadata: ExtensionMetadata = {
  name: 'Renderer Test Extension',
  version: '1.0.0',
  description: 'A test extension for renderer type checking',
  author: 'Renderer Test',
};

// Test ToolResult type
const successResult: ToolResult = {
  content: [{ type: 'text', text: 'Success!' }],
  details: { executionTime: 100 },
};

const errorResult: ToolResult = {
  content: [{ type: 'text', text: 'Error occurred' }],
  isError: true,
  details: { errorCode: 'ERR_001' },
};

const imageResult: ToolResult = {
  content: [
    { type: 'text', text: 'Generated image:' },
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'base64data' } },
  ],
};

// Test rendering ToolResult content
const renderToolResult = function (result: ToolResult): string {
  const parts: string[] = [];

  for (const item of result.content) {
    if (item.type === 'text') {
      parts.push(item.text);
    } else if (item.type === 'image') {
      parts.push('[Image]');
    }
  }

  if (result.isError) {
    return `❌ ${parts.join('\n')}`;
  }

  return parts.join('\n');
};

// Export for use in component tests
export { metadata, successResult, errorResult, imageResult, renderToolResult };

describe('Extension Types Integration (Renderer Process)', () => {
  it('should have correct ExtensionMetadata type', () => {
    expect(metadata.name).toBe('Renderer Test Extension');
    expect(metadata.version).toBe('1.0.0');
  });

  it('should have correct ToolResult types', () => {
    expect(successResult.isError).toBeUndefined();
    expect(errorResult.isError).toBe(true);
    expect(imageResult.content).toHaveLength(2);
  });

  it('should render tool results correctly', () => {
    const successText = renderToolResult(successResult);
    expect(successText).toContain('Success!');

    const errorText = renderToolResult(errorResult);
    expect(errorText).toContain('❌');

    const imageText = renderToolResult(imageResult);
    expect(imageText).toContain('[Image]');
  });
});
