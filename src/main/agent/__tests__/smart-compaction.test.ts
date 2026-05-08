import { describe, it, expect } from 'vitest';

import {
  smartCompactMessages,
  removeErroredTools,
  collapseFileEdits,
  removeStaleFileReads,
  removeObsoleteSearches,
  compactSemanticSearches,
  deduplicateBash,
  redactFetchOutputs,
} from '../smart-compaction';

import type { ContextMessage, ContextAssistantMessage, ContextToolMessage, ToolResultPart } from '@common/types/context';

// --- Message factory helpers ---

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;
let tcCounter = 0;
const nextTcId = () => `tc-${++tcCounter}`;

const userMsg = (text: string): ContextMessage => ({
  id: nextId(),
  role: 'user',
  content: text,
});

const assistantTextMsg = (text: string): ContextMessage => ({
  id: nextId(),
  role: 'assistant',
  content: [{ type: 'text', text }],
});

const assistantToolCallMsg = (toolCallId: string, toolName: string, input: unknown): ContextMessage => ({
  id: nextId(),
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId, toolName, input }],
});

const assistantTextAndToolCallMsg = (text: string, toolCallId: string, toolName: string, input: unknown): ContextMessage => ({
  id: nextId(),
  role: 'assistant',
  content: [
    { type: 'text', text },
    { type: 'tool-call', toolCallId, toolName, input },
  ],
});

const toolResultMsg = (parts: { toolCallId: string; toolName: string; output: { type: string; value: string } }[]): ContextMessage => ({
  id: nextId(),
  role: 'tool',
  content: parts.map((p) => ({ type: 'tool-result', toolCallId: p.toolCallId, toolName: p.toolName, output: p.output as any })),
});

const fileReadTool = (filePath: string) => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---file_read', { filePath }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_read', output: { type: 'text', value: `content of ${filePath}` } }]),
  };
};

const fileEditTool = (filePath: string, resultText = 'File edited successfully') => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---file_edit', { filePath, searchTerm: 'old', replacementText: 'new' }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_edit', output: { type: 'text', value: resultText } }]),
  };
};

const globTool = (pattern: string, resultText = 'file1.ts\nfile2.ts') => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---glob', { pattern }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---glob', output: { type: 'text', value: resultText } }]),
  };
};

const grepTool = (searchTerm: string, resultText = 'found at line 5') => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---grep', { filePattern: '*.ts', searchTerm }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---grep', output: { type: 'text', value: resultText } }]),
  };
};

const semanticSearchTool = (query: string, lines: number) => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---semantic_search', { query }),
    result: toolResultMsg([
      {
        toolCallId: tcId,
        toolName: 'power---semantic_search',
        output: { type: 'text', value: Array.from({ length: lines }, (_, i) => `result line ${i + 1} for ${query}`).join('\n') },
      },
    ]),
  };
};

const bashTool = (command: string, stdout: string, stderr = '') => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---bash', { command }),
    result: toolResultMsg([
      {
        toolCallId: tcId,
        toolName: 'power---bash',
        output: { type: 'text', value: JSON.stringify({ stdout, stderr }) },
      },
    ]),
  };
};

const fetchTool = (url: string, content: string) => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---fetch', { url }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---fetch', output: { type: 'text', value: content } }]),
  };
};

const nonPowerTool = (toolName: string, resultText = 'done') => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, `other-server---${toolName}`, {}),
    result: toolResultMsg([{ toolCallId: tcId, toolName: `other-server---${toolName}`, output: { type: 'text', value: resultText } }]),
  };
};

// --- Invariant checkers ---

const collectToolCallIds = (msgs: ContextMessage[]) => {
  const calls = new Set<string>();
  const results = new Set<string>();
  for (const msg of msgs) {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'tool-call') {
          calls.add(part.toolCallId);
        }
      }
    }
    if (msg.role === 'tool') {
      for (const part of msg.content) {
        if (part.type === 'tool-result') {
          results.add(part.toolCallId);
        }
      }
    }
  }
  return { calls, results };
};

const expectNoOrphans = (msgs: ContextMessage[]) => {
  const { calls, results } = collectToolCallIds(msgs);
  expect(calls).toEqual(results);
};

const expectNoConsecutiveAssistant = (msgs: ContextMessage[]) => {
  for (let i = 0; i < msgs.length - 1; i++) {
    if (msgs[i].role === 'assistant' && msgs[i + 1].role === 'assistant') {
      const isFileEditedMsg = (m: ContextMessage) =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.length === 1 &&
        m.content[0].type === 'text' &&
        typeof m.content[0].text === 'string' &&
        m.content[0].text.includes('<file-edited');

      if (!isFileEditedMsg(msgs[i]) && !isFileEditedMsg(msgs[i + 1])) {
        throw new Error(`Consecutive assistant messages at [${i}] and [${i + 1}] without <file-edited>`);
      }
    }
  }
};

const expectInvariants = (msgs: ContextMessage[]) => {
  expectNoOrphans(msgs);
  expectNoConsecutiveAssistant(msgs);
};

const getToolResultPart = (msgs: ContextMessage[], toolName: string): ToolResultPart => {
  const toolMsg = msgs.find((m): m is ContextToolMessage => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === toolName))!;
  return toolMsg.content[0] as ToolResultPart;
};

const getTextOutput = (part: ToolResultPart): string => {
  return (part.output as { type: 'text'; value: string }).value;
};

const resetCounters = () => {
  idCounter = 0;
  tcCounter = 0;
};

// No protected zone — useful for testing compaction logic in isolation
const NO_PROTECTION = 0;

// --- Tests ---

describe('smartCompactMessages', () => {
  it('returns empty array unchanged', () => {
    expect(smartCompactMessages([])).toEqual([]);
  });

  it('returns messages unchanged when no tools are present', () => {
    resetCounters();
    const msgs = [userMsg('hello'), assistantTextMsg('hi'), userMsg('bye'), assistantTextMsg('bye!')];
    const result = smartCompactMessages(msgs);
    expect(result).toHaveLength(4);
    expectInvariants(result);
  });

  it('preserves protected zone messages', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('protected')];
    const result = smartCompactMessages(msgs, 4);
    expect(result).toHaveLength(4);
    expectInvariants(result);
  });
});

describe('removeErroredTools', () => {
  it('removes tool calls with error output', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('do it'),
      assistantToolCallMsg(tcId, 'power---file_edit', { filePath: 'src/foo.ts' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_edit', output: { type: 'text', value: 'error: file not found' } }]),
      userMsg('next'),
    ];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('user');
    expectInvariants(result);
  });

  it('removes tool calls with denied-by-user output', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('do it'),
      assistantToolCallMsg(tcId, 'power---bash', { command: 'rm -rf /' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---bash', output: { type: 'text', value: 'Denied by user' } }]),
    ];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(1);
    expectInvariants(result);
  });

  it('removes no-op tool calls', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('edit'),
      assistantToolCallMsg(tcId, 'power---file_edit', { filePath: 'src/foo.ts' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_edit', output: { type: 'text', value: 'Already updated - no changes were needed' } }]),
    ];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(1);
    expectInvariants(result);
  });

  it('keeps successful tool calls', () => {
    resetCounters();
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('edit'), edit.assistant, edit.result];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('does not remove errors in protected zone', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('do it'),
      assistantToolCallMsg(tcId, 'power---file_edit', { filePath: 'src/foo.ts' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_edit', output: { type: 'text', value: 'error: something' } }]),
    ];
    const result = removeErroredTools(msgs, 3);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('does not remove errors from non-power tools', () => {
    resetCounters();
    const tool = nonPowerTool('my_tool', 'error: bad');
    const msgs: ContextMessage[] = [userMsg('go'), tool.assistant, tool.result];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('removes only errored tool call from assistant with mixed tool calls', () => {
    resetCounters();
    const errTcId = nextTcId();
    const okTcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      {
        id: nextId(),
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: errTcId, toolName: 'power---file_edit', input: { filePath: 'a.ts' } },
          { type: 'tool-call', toolCallId: okTcId, toolName: 'power---file_read', input: { filePath: 'b.ts' } },
        ],
      },
      toolResultMsg([
        { toolCallId: errTcId, toolName: 'power---file_edit', output: { type: 'text', value: 'error: nope' } },
        { toolCallId: okTcId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } },
      ]),
    ];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(3);
    const assistant = result[1] as ContextAssistantMessage;
    expect(assistant.content).toHaveLength(1);
    expect(assistant.content[0]).toHaveProperty('toolCallId', okTcId);
    expectInvariants(result);
  });

  it('removes assistant message entirely when its last tool-call is removed even if text remains', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantTextAndToolCallMsg('Let me edit the file', tcId, 'power---file_edit', { filePath: 'src/foo.ts' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_edit', output: { type: 'text', value: 'error: denied by user' } }]),
    ];
    const result = removeErroredTools(msgs, NO_PROTECTION);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expectInvariants(result);
  });
});

describe('collapseFileEdits', () => {
  it('collapses multiple edits to the same file into a synthetic message', () => {
    resetCounters();
    const edit1 = fileEditTool('src/foo.ts');
    const edit2 = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('edit 1'), edit1.assistant, edit1.result, userMsg('edit 2'), edit2.assistant, edit2.result, userMsg('done')];
    const result = collapseFileEdits(msgs, NO_PROTECTION);
    const synthMessages = result.filter(
      (m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p) => p.type === 'text' && p.text.includes('<file-edited')),
    );
    expect(synthMessages).toHaveLength(1);
    expectInvariants(result);
  });

  it('creates separate synthetic messages for different files', () => {
    resetCounters();
    const editA = fileEditTool('src/a.ts');
    const editB = fileEditTool('src/b.ts');
    const editC = fileEditTool('src/a.ts');
    const msgs: ContextMessage[] = [
      userMsg('edit a'),
      editA.assistant,
      editA.result,
      userMsg('edit b'),
      editB.assistant,
      editB.result,
      userMsg('edit a again'),
      editC.assistant,
      editC.result,
    ];
    const result = collapseFileEdits(msgs, NO_PROTECTION);
    const synthMessages = result.filter(
      (m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p) => p.type === 'text' && p.text.includes('<file-edited')),
    );
    // a.ts edits are grouped into one, b.ts is another
    expect(synthMessages).toHaveLength(2);
    expectInvariants(result);
  });

  it('does not collapse edits in protected zone', () => {
    resetCounters();
    const edit1 = fileEditTool('src/foo.ts');
    const edit2 = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('edit 1'), edit1.assistant, edit1.result, userMsg('edit 2'), edit2.assistant, edit2.result];
    const result = collapseFileEdits(msgs, 6);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });

  it('creates synthetic message for single edit too', () => {
    resetCounters();
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('edit'), edit.assistant, edit.result, userMsg('next')];
    const result = collapseFileEdits(msgs, NO_PROTECTION);
    const synthMessages = result.filter(
      (m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p) => p.type === 'text' && p.text.includes('<file-edited')),
    );
    expect(synthMessages).toHaveLength(1);
    expectInvariants(result);
  });
});

describe('removeStaleFileReads', () => {
  it('removes file read that was followed by an edit to the same file', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('edit'), edit.assistant, edit.result];
    const result = removeStaleFileReads(msgs, NO_PROTECTION);
    const hasRead = result.some((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---file_read'));
    expect(hasRead).toBe(false);
    expectInvariants(result);
  });

  it('removes stale read even when edit is represented as synthetic message', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const edit = fileEditTool('src/foo.ts');
    const msgs = [userMsg('read'), read.assistant, read.result, userMsg('edit'), edit.assistant, edit.result];
    const collapsed = collapseFileEdits(msgs, NO_PROTECTION);
    const result = removeStaleFileReads(collapsed, NO_PROTECTION);
    const hasRead = result.some((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---file_read'));
    expect(hasRead).toBe(false);
    expectInvariants(result);
  });

  it('keeps file read that was not followed by an edit', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('what next?')];
    const result = removeStaleFileReads(msgs, NO_PROTECTION);
    expect(result).toHaveLength(4);
    expectInvariants(result);
  });

  it('removes duplicate reads keeping only the latest', () => {
    resetCounters();
    const read1 = fileReadTool('src/foo.ts');
    const read2 = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read 1'), read1.assistant, read1.result, userMsg('read 2'), read2.assistant, read2.result];
    const result = removeStaleFileReads(msgs, NO_PROTECTION);
    const readResults = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---file_read'));
    expect(readResults).toHaveLength(1);
    expectInvariants(result);
  });

  it('removes stale read if the same file is read in the protected zone', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const protectedRead = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('read again'), protectedRead.assistant, protectedRead.result];
    // protectedMessageCount=2 means the last read pair is protected
    const result = removeStaleFileReads(msgs, 2);
    const readResults = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---file_read'));
    expect(readResults).toHaveLength(1);
    expectInvariants(result);
  });

  it('does not remove reads in protected zone', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result];
    const result = removeStaleFileReads(msgs, 3);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });
});

describe('removeObsoleteSearches', () => {
  it('removes glob that precedes a file modification', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('search'), search.assistant, search.result, userMsg('edit'), edit.assistant, edit.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION);
    const hasGlob = result.some((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---glob'));
    expect(hasGlob).toBe(false);
    expectInvariants(result);
  });

  it('removes grep that precedes a file modification', () => {
    resetCounters();
    const search = grepTool('pattern');
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('search'), search.assistant, search.result, userMsg('edit'), edit.assistant, edit.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION);
    const hasGrep = result.some((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---grep'));
    expect(hasGrep).toBe(false);
    expectInvariants(result);
  });

  it('keeps searches when there are no file modifications', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const msgs: ContextMessage[] = [userMsg('search'), search.assistant, search.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('keeps searches after the last file modification', () => {
    resetCounters();
    const edit = fileEditTool('src/foo.ts');
    const search = globTool('**/*.ts');
    const msgs: ContextMessage[] = [userMsg('edit'), edit.assistant, edit.result, userMsg('search'), search.assistant, search.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION);
    const hasGlob = result.some((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---glob'));
    expect(hasGlob).toBe(true);
    expectInvariants(result);
  });

  it('does not remove searches in protected zone', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('search'), search.assistant, search.result, userMsg('edit'), edit.assistant, edit.result];
    const result = removeObsoleteSearches(msgs, 6);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });
});

describe('compactSemanticSearches', () => {
  it('keeps only the latest semantic search', () => {
    resetCounters();
    const search1 = semanticSearchTool('query 1', 5);
    const search2 = semanticSearchTool('query 2', 5);
    const search3 = semanticSearchTool('query 3', 5);
    const msgs: ContextMessage[] = [
      userMsg('search 1'),
      search1.assistant,
      search1.result,
      userMsg('search 2'),
      search2.assistant,
      search2.result,
      userMsg('search 3'),
      search3.assistant,
      search3.result,
    ];
    const result = compactSemanticSearches(msgs, NO_PROTECTION);
    const searchResults = result.filter(
      (m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---semantic_search'),
    );
    expect(searchResults).toHaveLength(1);
    expectInvariants(result);
  });

  it('truncates output longer than 50 lines on kept search', () => {
    resetCounters();
    const search1 = semanticSearchTool('small query', 5);
    const search2 = semanticSearchTool('big query', 100);
    const msgs: ContextMessage[] = [userMsg('search 1'), search1.assistant, search1.result, userMsg('search 2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---semantic_search');
    const outputValue = getTextOutput(part);
    expect(outputValue).toContain('<truncated');
    expect(outputValue.split('\n').length).toBeLessThanOrEqual(52);
    expectInvariants(result);
  });

  it('does not truncate output of 50 lines or less', () => {
    resetCounters();
    const search1 = semanticSearchTool('query a', 5);
    const search2 = semanticSearchTool('query b', 50);
    const msgs: ContextMessage[] = [userMsg('search 1'), search1.assistant, search1.result, userMsg('search 2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---semantic_search');
    expect(getTextOutput(part)).not.toContain('<truncated');
    expectInvariants(result);
  });

  it('returns unchanged when only one search exists', () => {
    resetCounters();
    const search = semanticSearchTool('query', 5);
    const msgs: ContextMessage[] = [userMsg('search'), search.assistant, search.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('does not compact searches in protected zone', () => {
    resetCounters();
    const search1 = semanticSearchTool('query 1', 5);
    const search2 = semanticSearchTool('query 2', 5);
    const msgs: ContextMessage[] = [userMsg('search 1'), search1.assistant, search1.result, userMsg('search 2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, 6);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });
});

describe('deduplicateBash', () => {
  it('keeps only the latest occurrence of duplicate commands', () => {
    resetCounters();
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm test', 'all passed again');
    const msgs: ContextMessage[] = [userMsg('run'), bash1.assistant, bash1.result, userMsg('run again'), bash2.assistant, bash2.result];
    const result = deduplicateBash(msgs, NO_PROTECTION);
    const bashResults = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---bash'));
    expect(bashResults).toHaveLength(1);
    expectInvariants(result);
  });

  it('keeps unique commands', () => {
    resetCounters();
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm build', 'built');
    const msgs: ContextMessage[] = [userMsg('test'), bash1.assistant, bash1.result, userMsg('build'), bash2.assistant, bash2.result];
    const result = deduplicateBash(msgs, NO_PROTECTION);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });

  it('redacts long stdout in remaining bash results', () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = deduplicateBash(msgs, NO_PROTECTION);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toContain('redacted');
    expectInvariants(result);
  });

  it('redacts long stderr in remaining bash results', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok', 'e'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = deduplicateBash(msgs, NO_PROTECTION);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stderr).toContain('redacted');
    expectInvariants(result);
  });

  it('does not redact short output', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok', 'warn');
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = deduplicateBash(msgs, NO_PROTECTION);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toBe('ok');
    expect(parsed.stderr).toBe('warn');
    expectInvariants(result);
  });

  it('does not modify protected zone', () => {
    resetCounters();
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm test', 'all passed again');
    const msgs: ContextMessage[] = [userMsg('run'), bash1.assistant, bash1.result, userMsg('run again'), bash2.assistant, bash2.result];
    const result = deduplicateBash(msgs, 6);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });
});

describe('redactFetchOutputs', () => {
  it('redacts fetch output outside protected zone', () => {
    resetCounters();
    const fetch = fetchTool('https://example.com', 'some long page content here');
    const user = userMsg('next');
    const msgs: ContextMessage[] = [userMsg('fetch'), fetch.assistant, fetch.result, user];
    const result = redactFetchOutputs(msgs, NO_PROTECTION);
    expect(getTextOutput(getToolResultPart(result, 'power---fetch'))).toContain('redacted');
    expectInvariants(result);
  });

  it('does not redact empty fetch output', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('fetch'),
      assistantToolCallMsg(tcId, 'power---fetch', { url: 'https://example.com' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---fetch', output: { type: 'text', value: '' } }]),
      userMsg('next'),
    ];
    const result = redactFetchOutputs(msgs, NO_PROTECTION);
    expect(getTextOutput(getToolResultPart(result, 'power---fetch'))).toBe('');
    expectInvariants(result);
  });

  it('does not redact fetch in protected zone', () => {
    resetCounters();
    const fetch = fetchTool('https://example.com', 'some content');
    const msgs: ContextMessage[] = [userMsg('fetch'), fetch.assistant, fetch.result];
    const result = redactFetchOutputs(msgs, 3);
    expect(getTextOutput(getToolResultPart(result, 'power---fetch'))).toBe('some content');
    expectInvariants(result);
  });

  it('does not redact non-fetch tools', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = redactFetchOutputs(msgs, NO_PROTECTION);
    expect(getTextOutput(getToolResultPart(result, 'power---file_read'))).toContain('content of src/foo.ts');
    expectInvariants(result);
  });
});

describe('full pipeline invariants', () => {
  it('maintains invariants on complex mixed scenario', () => {
    resetCounters();
    const read1 = fileReadTool('src/a.ts');
    const edit1 = fileEditTool('src/a.ts');
    const search1 = globTool('**/*.ts');
    const edit2 = fileEditTool('src/a.ts');
    const read2 = fileReadTool('src/b.ts');
    const search2 = semanticSearchTool('find something', 5);
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm test', 'all passed again');
    const fetch1 = fetchTool('https://docs.example.com', 'documentation content here');
    const edit3 = fileEditTool('src/b.ts');
    const search3 = grepTool('TODO');
    const read3 = fileReadTool('src/c.ts');

    const msgs: ContextMessage[] = [
      userMsg('start'),
      read1.assistant,
      read1.result,
      edit1.assistant,
      edit1.result,
      search1.assistant,
      search1.result,
      edit2.assistant,
      edit2.result,
      read2.assistant,
      read2.result,
      search2.assistant,
      search2.result,
      bash1.assistant,
      bash1.result,
      bash2.assistant,
      bash2.result,
      fetch1.assistant,
      fetch1.result,
      edit3.assistant,
      edit3.result,
      search3.assistant,
      search3.result,
      read3.assistant,
      read3.result,
      userMsg('done'),
    ];

    const result = smartCompactMessages(msgs, 10);
    expectInvariants(result);

    // No duplicate bash commands
    const bashResults = result.filter(
      (m): m is ContextToolMessage => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---bash'),
    );
    const bashOutputs: string[] = [];
    for (const br of bashResults) {
      const part = br.content.find((p): p is ToolResultPart => p.type === 'tool-result' && p.toolName === 'power---bash');
      const parsed = JSON.parse(getTextOutput(part!));
      bashOutputs.push(parsed.stdout);
    }
    expect(new Set(bashOutputs).size).toBe(bashOutputs.length);
  });
});
