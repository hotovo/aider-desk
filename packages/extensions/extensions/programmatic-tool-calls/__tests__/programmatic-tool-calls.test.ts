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

const { default: ProgrammaticToolCallsExtension, scoreToolRecords } = await import('../index');

const PTC_TOOL_NAME = 'programmatic_tool_calls';

const createEvent = (mode: string, tools: Record<string, ToolsetToolEntry>): ToolsetToolRecordlessEvent =>
  ({
    mode,
    agentProfile: { name: 'test-profile' },
    providerProfile: { name: 'test-provider' },
    model: 'test-model',
    tools,
  }) as unknown as ToolsetCreatedEvent;
type ToolsetToolRecordlessEvent = ToolsetCreatedEvent;

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
    it('keeps only the ptc tool and appends the signature catalog to its description in ptc mode', async () => {
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
      expect(ptcTool.description).toContain('## Available tools');
      expect(ptcTool.description).toContain('2 tools');
      expect(ptcTool.description).toContain('power_file_read');
      expect(ptcTool.description).toContain('/** The path to the file */');
      expect(ptcTool.description).toContain('filePath: string');
      expect(ptcTool.description).toContain('mcp__server__tool');
      expect(ptcTool.description).toContain('COMPLETE list');
    });

    it('truncates long tool descriptions in signatures and marks the catalog partial when the budget is exceeded', async () => {
      const longDescription = 'y'.repeat(300);
      const tools: Record<string, ToolsetToolEntry> = {
        [PTC_TOOL_NAME]: { description: 'Executes code in a sandbox' },
      };
      for (let i = 0; i < 300; i++) {
        tools[`tool-${i}`] = {
          description: longDescription,
          inputSchema: z.object({ field: z.number().describe('a'.repeat(120)) }),
        };
      }
      const event = createEvent('ptc', tools);

      const result = await extension.onToolsetCreated!(event, {} as never);
      const ptcTool = result!.tools![PTC_TOOL_NAME]!;

      expect(ptcTool.description).not.toContain(longDescription);
      expect(ptcTool.description).toMatch(/SIGNATURES PARTIAL/);
      expect(ptcTool.description).toContain('searchTools');
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

  describe('scoreToolRecords', () => {
    const records = [
      { rawName: 'power-file-read', path: 'tools.power_file_read', pathRender: 'tools.power_file_read', description: 'Reads and returns the content of a specified file.', schema: { type: 'object', properties: { filePath: { type: 'string', description: 'path to the file' } }, required: ['filePath'] } },
      { rawName: 'power-glob', path: 'tools.power_glob', pathRender: 'tools.power_glob', description: 'Finds files matching a glob pattern.', schema: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
      { rawName: 'other-tool', path: 'tools.other_tool', pathRender: 'tools.other_tool', description: 'Unrelated tool.', schema: undefined },
    ];

    it('scores path segment matches above description matches', () => {
      const { matches } = scoreToolRecords(records, 'file read');
      expect(matches[0].record.path).toBe('tools.power_file_read');
    });

    it('matches plural query terms via singular variants', () => {
      const globRecords = [{ rawName: 'issues-list', path: 'tools.issues_list', pathRender: 'tools.issues_list', description: 'Lists an issue.', schema: undefined }];
      const { matches } = scoreToolRecords(globRecords, 'issues');
      expect(matches).toHaveLength(1);
    });

    it('matches by schema property names', () => {
      const { matches } = scoreToolRecords(records, 'filepath');
      expect(matches[0].record.path).toBe('tools.power_file_read');
    });

    it('browses all tools alphabetically with an empty query', () => {
      const { matches, total } = scoreToolRecords(records, '');
      expect(total).toBe(3);
      expect(matches.map((m) => m.record.path)).toEqual(['tools.other_tool', 'tools.power_file_read', 'tools.power_glob']);
    });

    it('filters by namespace and paginates with limit and offset', () => {
      const nsRecords = [
        { rawName: 'a-x', path: 'tools.a.x', pathRender: "tools['a.x']", description: '', schema: undefined },
        { rawName: 'b-y', path: 'tools.b.y', pathRender: "tools['b.y']", description: '', schema: undefined },
      ];
      const { matches, total } = scoreToolRecords(nsRecords, '', 'a', 10, 0);
      expect(total).toBe(1);
      expect(matches[0].record.path).toBe('tools.a.x');
    });
  });
});
