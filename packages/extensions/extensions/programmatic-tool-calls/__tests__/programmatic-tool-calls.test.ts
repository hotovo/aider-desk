import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { ToolsetCreatedEvent, ToolsetToolEntry } from '../../../extensions.d.ts';

vi.mock('@nyariv/sandboxjs', () => ({
  default: class Sandbox {
    compileAsync() {
      return { run: () => undefined };
    }
  },
}));

const { default: ProgrammaticToolCallsExtension } = await import('../index');

const PTC_TOOL_NAME = 'programmatic_tool_calls';

const createEvent = (mode: string, tools: Record<string, ToolsetToolEntry>): ToolsetCreatedEvent =>
  ({
    mode,
    agentProfile: { name: 'test-profile' },
    providerProfile: { name: 'test-provider' },
    model: 'test-model',
    tools,
  }) as unknown as ToolsetCreatedEvent;

describe('ProgrammaticToolCallsExtension', () => {
  const extension = new ProgrammaticToolCallsExtension();

  describe('getModes', () => {
    it('provides the ptc mode', () => {
      const modes = extension.getModes!({} as never);

      expect(modes).toHaveLength(1);
      expect(modes[0].name).toBe('ptc');
      expect(modes[0].label).toBe('PTC');
    });
  });

  describe('onToolsetCreated', () => {
    it('keeps only the ptc tool and appends the tools catalog to its description in ptc mode', async () => {
      const event = createEvent('ptc', {
        'power---file-read': {
          description: 'Reads a file',
          inputSchema: z.object({ filePath: z.string().describe('The path to the file') }),
        },
        'mcp__server__tool': { description: 'MCP tool' },
        [PTC_TOOL_NAME]: { description: 'Executes code in a sandbox', inputSchema: z.object({ code: z.string() }) },
      });

      const result = await extension.onToolsetCreated!(event, {} as never);
      const ptcTool = result!.tools![PTC_TOOL_NAME]!;

      expect(Object.keys(result!.tools!)).toEqual([PTC_TOOL_NAME]);
      expect(ptcTool.description).toContain('Executes code in a sandbox');
      expect(ptcTool.description).toContain('Available tools');
      expect(ptcTool.description).toContain('power_file_read');
      expect(ptcTool.description).toContain('"filePath"');
      expect(ptcTool.description).toContain('The path to the file');
      expect(ptcTool.description).toContain('mcp__server__tool');
      expect(ptcTool.description).not.toContain(`"${PTC_TOOL_NAME}"`);
    });

    it('truncates long tool descriptions in the catalog', async () => {
      const longDescription = 'x'.repeat(300);
      const event = createEvent('ptc', {
        'some-tool': { description: longDescription },
        [PTC_TOOL_NAME]: { description: 'Executes code in a sandbox' },
      });

      const result = await extension.onToolsetCreated!(event, {} as never);
      const ptcTool = result!.tools![PTC_TOOL_NAME]!;

      expect(ptcTool.description).not.toContain(longDescription);
      expect(ptcTool.description).toContain('x'.repeat(199) + '…');
    });

    it('returns no modifications in non-ptc modes', async () => {
      const event = createEvent('agent', {
        'power---file-read': { description: 'Reads a file' },
        [PTC_TOOL_NAME]: { description: 'Executes code in a sandbox' },
      });

      const result = await extension.onToolsetCreated!(event, {} as never);

      expect(result).toBeUndefined();
    });

    it('returns no modifications when the ptc tool is not in the toolset', async () => {
      const event = createEvent('ptc', {
        'power---file-read': { description: 'Reads a file' },
      });

      const result = await extension.onToolsetCreated!(event, {} as never);

      expect(result).toBeUndefined();
    });
  });
});
