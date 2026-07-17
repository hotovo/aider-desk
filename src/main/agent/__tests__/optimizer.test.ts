import { describe, it, expect, vi } from 'vitest';

vi.mock('@/logger');
import { convertImageToolResults } from '../optimizer';

import type { ModelMessage, ToolResultPart } from 'ai';

// --- Helpers ---

const BASE64_IMG_1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const BASE64_IMG_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAC';
const TOOL_CALL_ID = 'call_test123';
const TOOL_NAME = 'chrome-devtools---take_screenshot';

const makeToolMessage = (output: ToolResultPart['output']): ModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      output,
    },
  ],
});

const makeTextOutput = (value: string): ToolResultPart['output'] => ({ type: 'text', value });
const makeJsonOutput = (value: unknown): ToolResultPart['output'] => ({ type: 'json', value: value as never });
const makeContentOutput = (value: unknown): ToolResultPart['output'] => ({ type: 'content', value: value as never });

const makeImageItem = (data: string, mimeType = 'image/png') => ({
  type: 'image',
  data,
  mimeType,
});

const makeTextItem = (text: string) => ({ type: 'text', text });

type FilePartLike = { type: 'file'; data: { type: 'data'; data: string }; mediaType: string };

// When images are extracted, result should be 2 messages:
// [0] = tool message with text output, [1] = user message with file parts
const getToolOutput = (result: ModelMessage[]): ToolResultPart['output'] => {
  expect(result).toHaveLength(2);
  const toolMsg = result[0];
  const part = (toolMsg.content as unknown[]).find((p) => (p as { type: string }).type === 'tool-result') as ToolResultPart;
  return part.output;
};

const getUserFileParts = (result: ModelMessage[]): FilePartLike[] => {
  expect(result).toHaveLength(2);
  const userMsg = result[1];
  expect(userMsg.role).toBe('user');
  return (userMsg.content as unknown[]).filter((p) => (p as { type: string }).type === 'file') as FilePartLike[];
};

// --- Tests ---

describe('convertImageToolResults', () => {
  it('should pass through non-tool messages unchanged', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
    ];

    const result = convertImageToolResults(messages);

    expect(result).toEqual(messages);
  });

  it('should pass through tool results with no image content', () => {
    const msg = makeToolMessage(makeJsonOutput({ content: [makeTextItem('Just text')] }));

    const result = convertImageToolResults([msg]);

    expect(result).toEqual([msg]);
  });

  it('should handle single image-only content (json output)', () => {
    const msg = makeToolMessage(makeJsonOutput({ content: [makeImageItem(BASE64_IMG_1, 'image/png')] }));

    const result = convertImageToolResults([msg]);

    const output = getToolOutput(result);
    expect(output).toEqual({ type: 'text', value: 'Image rendered.' });

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/png' }]);
  });

  it('should handle single image-only content (text output with JSON string)', () => {
    const msg = makeToolMessage(makeTextOutput(JSON.stringify({ content: [makeImageItem(BASE64_IMG_1, 'image/jpeg')] })));

    const result = convertImageToolResults([msg]);

    const output = getToolOutput(result);
    expect(output).toEqual({ type: 'text', value: 'Image rendered.' });

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/jpeg' }]);
  });

  it('should handle text + image content (the broken case)', () => {
    const msg = makeToolMessage(
      makeJsonOutput({
        content: [makeTextItem('Took a screenshot of the full current page.'), makeImageItem(BASE64_IMG_1)],
      }),
    );

    const result = convertImageToolResults([msg]);

    const output = getToolOutput(result);
    expect(output).toEqual({ type: 'text', value: 'Took a screenshot of the full current page.' });

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/png' }]);
  });

  it('should handle multiple text parts + multiple image parts', () => {
    const msg = makeToolMessage(
      makeJsonOutput({
        content: [
          makeTextItem('Screenshot taken.'),
          makeImageItem(BASE64_IMG_1, 'image/png'),
          makeImageItem(BASE64_IMG_2, 'image/jpeg'),
          makeTextItem('See images above.'),
        ],
      }),
    );

    const result = convertImageToolResults([msg]);

    const output = getToolOutput(result);
    expect(output).toEqual({ type: 'text', value: 'Screenshot taken.\n\nSee images above.' });

    const files = getUserFileParts(result);
    expect(files).toEqual([
      { type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/png' },
      { type: 'file', data: { type: 'data', data: BASE64_IMG_2 }, mediaType: 'image/jpeg' },
    ]);
  });

  it('should default to image/png when mimeType is missing', () => {
    const msg = makeToolMessage(makeJsonOutput({ content: [{ type: 'image', data: BASE64_IMG_1 }] }));

    const result = convertImageToolResults([msg]);

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/png' }]);
  });

  it('should handle media type content items', () => {
    const msg = makeToolMessage(makeJsonOutput({ content: [{ type: 'media', data: BASE64_IMG_1, mimeType: 'image/webp' }] }));

    const result = convertImageToolResults([msg]);

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/webp' }]);
  });

  it('should handle image with `image` field instead of `data`', () => {
    const msg = makeToolMessage(makeJsonOutput({ content: [{ type: 'image', image: BASE64_IMG_1, mimeType: 'image/png' }] }));

    const result = convertImageToolResults([msg]);

    const files = getUserFileParts(result);
    expect(files).toEqual([{ type: 'file', data: { type: 'data', data: BASE64_IMG_1 }, mediaType: 'image/png' }]);
  });

  it('should pass through tool results that are not valid JSON (text output)', () => {
    const msg = makeToolMessage(makeTextOutput('This is just plain text, not JSON'));

    const result = convertImageToolResults([msg]);

    expect(result).toEqual([msg]);
  });

  it('should pass through tool results with non-array content', () => {
    const msg = makeToolMessage(makeJsonOutput({ foo: 'bar' }));

    const result = convertImageToolResults([msg]);

    expect(result).toEqual([msg]);
  });

  it('should pass through content-type outputs unchanged', () => {
    const msg = makeToolMessage(
      makeContentOutput([
        makeTextItem('Took a screenshot.'),
        {
          type: 'file',
          data: { type: 'data', data: BASE64_IMG_1 },
          mediaType: 'image/png',
        },
      ]),
    );

    const result = convertImageToolResults([msg]);

    expect(result).toEqual([msg]);
  });
});
