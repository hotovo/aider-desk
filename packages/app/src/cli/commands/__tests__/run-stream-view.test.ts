// Workaround for Intl.Segmenter availability in the test environment. Some
// CI/test runners load @types/node globals that skip Intl full data; ensure
// the implementation used by pi-tui's wrapTextWithAnsi behaves deterministically.
//
// If Intl.Segmenter is unavailable we fall back to a word/simple wrapping
// behavior so we assert on shape (line counts) rather than exact widths.

import { describe, it, expect } from 'vitest';

import {
  RunStreamModel,
  formatToolArgs,
  shouldFollowAfterNav,
  getSpinnerFrame,
  renderReasoningPreview,
  renderToolPreview,
  renderReasoningFull,
  renderToolFull,
  renderAnswerLines,
  type ReasoningBlock,
  type ToolBlock,
  type AnswerBlock,
} from '../run-stream-view';

// Helper: strip ANSI escape codes from a string for assertion readability.
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

const stripAll = (lines: string[]): string[] => lines.map(stripAnsi);

describe('formatToolArgs', () => {
  it('returns empty string for undefined / null / primitive args', () => {
    expect(formatToolArgs(undefined)).toBe('');
    expect(formatToolArgs(null)).toBe('');
    expect(formatToolArgs('foo')).toBe('');
    expect(formatToolArgs(42)).toBe('');
  });

  it('returns empty string for empty object', () => {
    expect(formatToolArgs({})).toBe('');
  });

  it('returns parenthesized key=value summary for simple args', () => {
    expect(formatToolArgs({ path: '/a/b.ts' })).toBe('(path=/a/b.ts)');
  });

  it('joins multiple entries with comma', () => {
    expect(formatToolArgs({ a: '1', b: '2' })).toBe('(a=1, b=2)');
  });

  it('JSON-encodes non-string values', () => {
    expect(formatToolArgs({ n: 5, b: true, o: { x: 1 } })).toBe(
      '(n=5, b=true, o={"x":1})',
    );
  });

  it('truncates long string values to 60 characters with ellipsis', () => {
    const long = 'x'.repeat(100);
    const out = formatToolArgs({ k: long });
    // (k= + 57 chars + ...)
    expect(out).toBe(`(k=${'x'.repeat(57)}...)`);
  });
});

describe('shouldFollowAfterNav', () => {
  it('returns true when cursor lands on the last slot', () => {
    expect(shouldFollowAfterNav(2, 3)).toBe(true);
  });

  it('returns false when cursor moves off the last slot', () => {
    expect(shouldFollowAfterNav(0, 3)).toBe(false);
    expect(shouldFollowAfterNav(1, 3)).toBe(false);
  });

  it('returns true when there is only one selectable block and cursor is at 0', () => {
    expect(shouldFollowAfterNav(0, 1)).toBe(true);
  });

  it('returns false when there are zero selectable blocks', () => {
    expect(shouldFollowAfterNav(0, 0)).toBe(false);
  });

  it('returns false when slot exceeds indices length (defensive)', () => {
    expect(shouldFollowAfterNav(5, 3)).toBe(false);
  });
});

describe('getSpinnerFrame', () => {
  it('returns the first frame at elapsed=0', () => {
    expect(getSpinnerFrame(0)).toBe('⠋');
  });

  it('cycles through frames based on elapsed milliseconds', () => {
    expect(getSpinnerFrame(0)).toBe('⠋');
    expect(getSpinnerFrame(80)).toBe('⠙');
    expect(getSpinnerFrame(160)).toBe('⠹');
    expect(getSpinnerFrame(240)).toBe('⠸');
  });

  it('wraps around after all frames', () => {
    expect(getSpinnerFrame(800)).toBe('⠋');
    expect(getSpinnerFrame(880)).toBe('⠙');
  });
});

describe('RunStreamModel', () => {
  it('starts empty', () => {
    const m = new RunStreamModel();
    expect(m.getBlocks()).toEqual([]);
    expect(m.getSelectableIndices()).toEqual([]);
  });

  describe('appendReasoning', () => {
    it('creates a new streaming reasoning block on first chunk', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'thinking about...');
      const blocks = m.getBlocks();
      expect(blocks).toHaveLength(1);
      const b = blocks[0] as ReasoningBlock;
      expect(b.type).toBe('reasoning');
      expect(b.id).toBe('m1');
      expect(b.text).toBe('thinking about...');
      expect(b.streaming).toBe(true);
    });

    it('appends to the same block on subsequent chunks (same messageId)', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'one ');
      m.appendReasoning('m1', 'two');
      const b = m.getBlocks()[0] as ReasoningBlock;
      expect(b.text).toBe('one two');
    });

    it('creates a separate block for different messageIds', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'a');
      m.appendReasoning('m2', 'b');
      expect(m.getBlocks()).toHaveLength(2);
      expect((m.getBlocks()[0] as ReasoningBlock).text).toBe('a');
      expect((m.getBlocks()[1] as ReasoningBlock).text).toBe('b');
    });

    it('ignores empty text', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', '');
      expect(m.getBlocks()).toHaveLength(0);
    });
  });

  describe('freezeReasoning', () => {
    it('marks an existing reasoning block as non-streaming', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'x');
      m.freezeReasoning('m1');
      expect((m.getBlocks()[0] as ReasoningBlock).streaming).toBe(false);
    });

    it('no-ops for unknown messageId', () => {
      const m = new RunStreamModel();
      expect(() => m.freezeReasoning('nope')).not.toThrow();
      expect(m.getBlocks()).toHaveLength(0);
    });
  });

  describe('appendAnswer', () => {
    it('freezes the reasoning block for the messageId when first answer chunk arrives', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'thinking');
      expect((m.getBlocks()[0] as ReasoningBlock).streaming).toBe(true);
      m.appendAnswer('m1', 'answer');
      expect((m.getBlocks()[0] as ReasoningBlock).streaming).toBe(false);
      expect(m.getBlocks()).toHaveLength(2);
      const ab = m.getBlocks()[1] as AnswerBlock;
      expect(ab.type).toBe('answer');
      expect(ab.text).toBe('answer');
      expect(ab.finished).toBe(false);
    });

    it('appends to answer text without creating a second block', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'a');
      m.appendAnswer('m1', 'b');
      expect(m.getBlocks()).toHaveLength(1);
      expect((m.getBlocks()[0] as AnswerBlock).text).toBe('ab');
    });

    it('still creates an answer block if no reasoning arrived first', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'answer-text');
      expect(m.getBlocks()).toHaveLength(1);
      expect((m.getBlocks()[0] as AnswerBlock).text).toBe('answer-text');
    });

    it('ignores empty chunk', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', '');
      expect(m.getBlocks()).toHaveLength(0);
    });
  });

  describe('startTool / endTool', () => {
    it('creates an unfinished tool block', () => {
      const m = new RunStreamModel();
      m.startTool('t1', 'read_file', { path: '/a.ts' });
      expect(m.getBlocks()).toHaveLength(1);
      const b = m.getBlocks()[0] as ToolBlock;
      expect(b.type).toBe('tool');
      expect(b.toolName).toBe('read_file');
      expect(b.argsSummary).toBe('(path=/a.ts)');
      expect(b.finished).toBe(false);
      expect(b.error).toBe(false);
      expect(b.output).toBe('');
    });

    it('ignores duplicate startTool for same id', () => {
      const m = new RunStreamModel();
      m.startTool('t1', 'read_file');
      m.startTool('t1', 'other_name');
      expect(m.getBlocks()).toHaveLength(1);
      expect((m.getBlocks()[0] as ToolBlock).toolName).toBe('read_file');
    });

    it('endTool finalizes the block with output and error flag', () => {
      const m = new RunStreamModel();
      m.startTool('t1', 'run_cmd');
      m.endTool('t1', 'command output', true);
      const b = m.getBlocks()[0] as ToolBlock;
      expect(b.finished).toBe(true);
      expect(b.error).toBe(true);
      expect(b.output).toBe('command output');
    });

    it('endTool on unknown id is a no-op', () => {
      const m = new RunStreamModel();
      expect(() => m.endTool('nope', 'x', false)).not.toThrow();
      expect(m.getBlocks()).toHaveLength(0);
    });

    it('defaults output to empty string when omitted', () => {
      const m = new RunStreamModel();
      m.startTool('t1', 'run_cmd');
      m.endTool('t1');
      expect((m.getBlocks()[0] as ToolBlock).output).toBe('');
    });
  });

  describe('completeResponse', () => {
    it('marks the answer block as finished', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'partial');
      m.completeResponse('m1');
      expect((m.getBlocks()[0] as AnswerBlock).finished).toBe(true);
    });

    it('replaces streamed partial text with full content when it is a prefix', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'par');
      m.completeResponse('m1', 'partial full text');
      expect((m.getBlocks()[0] as AnswerBlock).text).toBe('partial full text');
    });

    it('keeps streamed text if full content is not a prefix (server mismatch)', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'par');
      m.completeResponse('m1', 'different');
      expect((m.getBlocks()[0] as AnswerBlock).text).toBe('par');
    });

    it('creates a finished answer block when completeResponse is the first event', () => {
      const m = new RunStreamModel();
      m.completeResponse('m1', 'only full content');
      const b = m.getBlocks()[0] as AnswerBlock;
      expect(b).toBeDefined();
      expect(b.text).toBe('only full content');
      expect(b.finished).toBe(true);
    });

    it('freezes the reasoning block for that messageId', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'thinking');
      m.appendAnswer('m1', 'answer');
      m.completeResponse('m1');
      expect((m.getBlocks()[0] as ReasoningBlock).streaming).toBe(false);
    });
  });

  describe('getBlocks', () => {
    it('preserves chronological insertion order across mixed block types', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'r1');
      m.appendAnswer('m1', 'a1');
      m.startTool('t1', 'tool1');
      m.endTool('t1', 'out');
      m.appendReasoning('m2', 'r2');
      m.appendAnswer('m2', 'a2');
      const types = m.getBlocks().map((b) => b.type);
      expect(types).toEqual(['reasoning', 'answer', 'tool', 'reasoning', 'answer']);
    });
  });

  describe('getSelectableIndices', () => {
    it('only includes reasoning and tool blocks', () => {
      const m = new RunStreamModel();
      m.appendReasoning('m1', 'r1');
      m.appendAnswer('m1', 'a1');
      m.startTool('t1', 'tool1');
      m.endTool('t1', 'out');
      m.appendAnswer('m1b', 'a2');
      expect(m.getSelectableIndices()).toEqual([0, 2]);
    });

    it('returns empty when no reasoning or tool blocks exist', () => {
      const m = new RunStreamModel();
      m.appendAnswer('m1', 'a1');
      expect(m.getSelectableIndices()).toEqual([]);
    });
  });
});

describe('renderReasoningPreview', () => {
  const makeBlock = (text: string, streaming = false): ReasoningBlock => ({
    type: 'reasoning',
    id: 'm1',
    text,
    streaming,
  });

  it('returns empty array when text is empty', () => {
    expect(renderReasoningPreview(makeBlock(''), 80)).toEqual([]);
  });

  it('returns all lines when fewer than the preview limit', () => {
    const text = Array.from({ length: 3 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = stripAll(renderReasoningPreview(makeBlock(text), 80));
    expect(out).toHaveLength(3);
    expect(out[0]).toContain('line 1');
    expect(out[2]).toContain('line 3');
  });

  it('returns the last 5 lines when text has more than 5 lines', () => {
    const text = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = stripAll(renderReasoningPreview(makeBlock(text), 80));
    expect(out).toHaveLength(5);
    // Tail of reasoning text shown
    expect(out[0]).toContain('line 6');
    expect(out[4]).toContain('line 10');
  });

  it('respects custom maxLines', () => {
    const text = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = stripAll(renderReasoningPreview(makeBlock(text), 80, 3));
    expect(out).toHaveLength(3);
    expect(out[0]).toContain('line 8');
    expect(out[2]).toContain('line 10');
  });
});

describe('renderToolPreview', () => {
  const makeBlock = (output: string, error = false, finished = true): ToolBlock => ({
    type: 'tool',
    id: 't1',
    toolName: 'run_cmd',
    argsSummary: '',
    output,
    error,
    finished,
  });

  it('returns empty array when there is no output', () => {
    expect(renderToolPreview(makeBlock(''), 80)).toEqual([]);
    expect(renderToolPreview(makeBlock(undefined as unknown as string), 80)).toEqual([]);
  });

  it('shows all lines when output has fewer than 5 lines', () => {
    const out = stripAll(renderToolPreview(makeBlock('a\nb\nc'), 80));
    expect(out).toHaveLength(3);
    expect(out[0]).toContain('a');
    expect(out[2]).toContain('c');
  });

  it('shows first 5 lines and the "+N more" hint when output has more than 5 lines', () => {
    const text = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = stripAll(renderToolPreview(makeBlock(text), 80));
    expect(out).toHaveLength(6); // 5 preview + 1 hint
    expect(out[0]).toContain('line 1');
    expect(out[4]).toContain('line 5');
    expect(out[5]).toContain('+7 more');
  });
});

describe('renderReasoningFull', () => {
  it('returns empty-state placeholder for empty text', () => {
    const out = stripAll(
      renderReasoningFull(
        { type: 'reasoning', id: 'm', text: '', streaming: false },
        80,
      ),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('empty');
  });

  it('line-numbers each wrapped line starting at 1', () => {
    const text = 'first line\nsecond line';
    const out = stripAll(
      renderReasoningFull(
        { type: 'reasoning', id: 'm', text, streaming: false },
        80,
      ),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^[\s]*1\s+first line$/);
    expect(out[1]).toMatch(/^[\s]*2\s+second line$/);
  });
});

describe('renderToolFull', () => {
  it('returns empty-state placeholder when there is no output', () => {
    const out = stripAll(
      renderToolFull(
        {
          type: 'tool',
          id: 't',
          toolName: 'tool',
          argsSummary: '',
          output: '',
          error: false,
          finished: true,
        },
        80,
      ),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('no output');
  });

  it('line-numbers each line of the tool output', () => {
    const out = stripAll(
      renderToolFull(
        {
          type: 'tool',
          id: 't',
          toolName: 'tool',
          argsSummary: '',
          output: 'out-a\nout-b',
          error: false,
          finished: true,
        },
        80,
      ),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/^[\s]*1\s+out-a$/);
    expect(out[1]).toMatch(/^[\s]*2\s+out-b$/);
  });
});

describe('renderAnswerLines', () => {
  it('returns empty array for empty text', () => {
    const out = renderAnswerLines(
      { type: 'answer', id: 'm', text: '', finished: false },
      80,
    );
    expect(out).toEqual([]);
  });

  it('wraps long lines to fit width', () => {
    const text = 'word '.repeat(40).trim();
    const out = renderAnswerLines(
      { type: 'answer', id: 'm', text, finished: false },
      20,
    );
    expect(out.length).toBeGreaterThan(1);
    for (const line of out) {
      // Each rendered line should fit within the wrap width (no ANSI here)
      expect(stripAnsi(line).length).toBeLessThanOrEqual(20);
    }
  });
});
