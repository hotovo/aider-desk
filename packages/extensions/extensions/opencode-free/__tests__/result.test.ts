import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { nativeResultText, nativeShellResult, normalizeProviderResult } from '../result';

describe('OpenCode tool result normalization', () => {
  it('decodes MCP text blocks containing a Power glob result', () => {
    const original = { files: ['README.md', 'index.ts'] };
    const wrapped = [{ type: 'text', text: JSON.stringify(original) }];
    const result = normalizeProviderResult({ type: 'json', value: wrapped });
    expect(result).toEqual(original);
    expect(renderToStaticMarkup(createElement('div', {}, (result as typeof original).files))).toContain('README.md');
    expect(() => renderToStaticMarkup(createElement('div', {}, wrapped as unknown as string[]))).toThrow('Objects are not valid as a React child');
  });

  it('decodes MCP text blocks containing arrays of paths', () => {
    expect(normalizeProviderResult({ content: [{ type: 'text', text: '["README.md"]' }] })).toEqual(['README.md']);
  });

  it('preserves plain text when it is not JSON', () => {
    expect(
      normalizeProviderResult([
        { type: 'text', text: 'Found ' },
        { type: 'text', text: 'no files' },
      ]),
    ).toBe('Found no files');
  });

  it('preserves ordinary JSON objects and mixed media results', () => {
    const result = { content: [{ type: 'image', data: 'image', mimeType: 'image/png' }] };
    expect(normalizeProviderResult(result)).toBe(result);
    expect(normalizeProviderResult({ files: ['file'] })).toEqual({ files: ['file'] });
  });

  it('does not parse JSON-looking native file contents', () => {
    const text = '{"type":"text","value":"actual file contents"}';
    expect(nativeResultText({ type: 'json', value: [{ type: 'text', text }] })).toBe(text);
  });

  it('normalizes native shell success and failure into Power bash output', () => {
    expect(nativeShellResult({ type: 'json', value: [{ type: 'text', text: '/workspace' }] })).toEqual({ stdout: '/workspace', stderr: '', exitCode: 0 });
    expect(nativeShellResult({ content: [{ type: 'text', text: 'Command failed' }] }, true)).toEqual({ stdout: '', stderr: 'Command failed', exitCode: 1 });
  });

  it('normalizes empty results without exposing objects to text renderers', () => {
    expect(nativeResultText(undefined)).toBe('');
    expect(normalizeProviderResult([])).toBe('');
  });
});
