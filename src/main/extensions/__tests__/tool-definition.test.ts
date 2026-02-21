/**
 * Tests for ToolDefinition and ToolResult interfaces
 * Verifies type inference and structure work correctly with Zod schemas
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import type { ToolDefinition, ToolResult, ExtensionContext } from '@common/extensions';

describe('ToolDefinition', () => {
  it('should infer types from Zod schema', () => {
    const tool: ToolDefinition = {
      name: 'test-tool',
      description: 'A test tool',
      parameters: z.object({
        input: z.string(),
        count: z.number().optional(),
      }),
      async execute(args, _signal, _context) {
        return { content: [{ type: 'text', text: args.input }] };
      },
    };

    expect(tool.name).toBe('test-tool');
    expect(tool.description).toBe('A test tool');
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('should support optional label and render functions', () => {
    const tool: ToolDefinition = {
      name: 'search',
      label: 'Search Files',
      description: 'Search for files',
      parameters: z.object({ pattern: z.string() }),
      async execute(args) {
        return { content: [{ type: 'text', text: args.pattern }] };
      },
      renderCall(args) {
        return `Search: ${args.pattern}`;
      },
      renderResult(result) {
        return result.isError ? 'Error' : 'Success';
      },
    };

    expect(tool.label).toBe('Search Files');
    expect(tool.renderCall).toBeDefined();
    expect(tool.renderResult).toBeDefined();
    expect(tool.renderCall?.({ pattern: 'test' })).toBe('Search: test');
    expect(tool.renderResult?.({ content: [{ type: 'text', text: 'ok' }] }, false)).toBe('Success');
    expect(tool.renderResult?.({ content: [{ type: 'text', text: 'err' }], isError: true }, false)).toBe('Error');
  });

  it('should execute with type-safe args from Zod inference', async () => {
    const tool: ToolDefinition = {
      name: 'echo',
      description: 'Echo the input',
      parameters: z.object({
        message: z.string(),
        repeat: z.number().default(1),
      }),
      async execute(args, _signal, _context) {
        return {
          content: [{ type: 'text', text: Array(args.repeat).fill(args.message).join(' ') }],
        };
      },
    };

    const result = await tool.execute({ message: 'hello', repeat: 3 }, new AbortController().signal, {} as ExtensionContext);
    expect(result.content[0]).toEqual({ type: 'text', text: 'hello hello hello' });
  });

  it('should support complex nested Zod schemas', () => {
    const tool: ToolDefinition = {
      name: 'complex-tool',
      description: 'Tool with complex schema',
      parameters: z.object({
        config: z.object({
          enabled: z.boolean(),
          options: z.array(z.string()),
        }),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
      async execute(args, _signal, _context) {
        return {
          content: [
            {
              type: 'text',
              text: `enabled: ${args.config.enabled}, options: ${args.config.options.join(',')}`,
            },
          ],
        };
      },
    };

    expect(tool.name).toBe('complex-tool');
    expect(tool.parameters).toBeDefined();
  });
});

describe('ToolResult', () => {
  it('should support text content', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Hello world' }],
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    if (result.content[0].type === 'text') {
      expect(result.content[0].text).toBe('Hello world');
    }
  });

  it('should support image content', () => {
    const result: ToolResult = {
      content: [{ type: 'image', source: { url: 'https://example.com/image.png' } }],
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('image');
    if (result.content[0].type === 'image') {
      expect(result.content[0].source).toEqual({ url: 'https://example.com/image.png' });
    }
  });

  it('should support mixed content types', () => {
    const result: ToolResult = {
      content: [
        { type: 'text', text: 'Here is an image:' },
        { type: 'image', source: { url: 'https://example.com/chart.png' } },
        { type: 'text', text: 'End of report' },
      ],
    };

    expect(result.content).toHaveLength(3);
    expect(result.content[0].type).toBe('text');
    expect(result.content[1].type).toBe('image');
    expect(result.content[2].type).toBe('text');
  });

  it('should support details field for metadata', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Operation completed' }],
      details: {
        duration: 150,
        filesProcessed: 5,
        successRate: 0.95,
      },
    };

    expect(result.details).toBeDefined();
    expect(result.details?.duration).toBe(150);
    expect(result.details?.filesProcessed).toBe(5);
    expect(result.details?.successRate).toBe(0.95);
  });

  it('should support isError field for error marking', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Error occurred' }],
      isError: true,
    };

    expect(result.isError).toBe(true);
  });

  it('should support details and isError together', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Error occurred' }],
      details: { code: 'ERR_001', reason: 'Invalid input' },
      isError: true,
    };

    expect(result.isError).toBe(true);
    expect(result.details).toEqual({ code: 'ERR_001', reason: 'Invalid input' });
  });

  it('should allow empty content array', () => {
    const result: ToolResult = {
      content: [],
    };

    expect(result.content).toHaveLength(0);
  });
});
