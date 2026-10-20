import { describe, expect, it } from 'vitest';

import { toMcpResult } from '../output';

describe('tool output conversion', () => {
  it('preserves text and JSON', () => {
    expect(toMcpResult({ type: 'text', value: 'hello' })).toEqual({
      content: [{ type: 'text', text: 'hello' }],
    });
    expect(toMcpResult({ type: 'json', value: { ok: true } })).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
    });
  });

  it('preserves errors and denials', () => {
    expect(toMcpResult({ type: 'error-text', value: 'failed' }).isError).toBe(true);
    expect(toMcpResult({ type: 'error-json', value: { error: true } }).isError).toBe(true);
    expect(toMcpResult({ type: 'execution-denied', reason: 'no' })).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'no' }],
    });
  });

  it('preserves images and inline text in content output', () => {
    expect(
      toMcpResult({
        type: 'content',
        value: [
          { type: 'text', text: 'picture' },
          {
            type: 'file',
            mediaType: 'image/png',
            data: { type: 'data', data: new Uint8Array([1, 2]) },
          },
          {
            type: 'file',
            mediaType: 'text/plain',
            data: { type: 'text', text: 'file text' },
          },
        ],
      }),
    ).toEqual({
      content: [
        { type: 'text', text: 'picture' },
        { type: 'image', mimeType: 'image/png', data: 'AQI=' },
        { type: 'text', text: 'file text' },
      ],
    });
  });

  it('converts ArrayBuffer images and file links', () => {
    const result = toMcpResult({
      type: 'content',
      value: [
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: new Uint8Array([1]).buffer },
        },
        {
          type: 'file',
          mediaType: 'text/plain',
          filename: 'example',
          data: { type: 'url', url: new URL('https://example.com/file') },
        },
      ],
    });
    expect(result.content).toEqual([
      { type: 'image', mimeType: 'image/png', data: 'AQ==' },
      {
        type: 'resource_link',
        uri: 'https://example.com/file',
        name: 'example',
        mimeType: 'text/plain',
      },
    ]);
  });
});
