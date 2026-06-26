import { describe, it, expect } from 'vitest';

import {
  smartCompactMessages,
  CompactionLevel,
  removeErroredTools,
  collapseFileEdits,
  removeStaleFileReads,
  removeObsoleteSearches,
  compactSemanticSearches,
  compactFileReads,
  compactBashOutputs,
  redactFetchOutputs,
  truncateNonPowerToolResults,
  removeVerboseToolCalls,
  removeReasoningFromAssistant,
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

const toolResultMsg = (parts: { toolCallId: string; toolName: string; output: { type: string; value: unknown } }[]): ContextMessage => ({
  id: nextId(),
  role: 'tool',
  content: parts.map((p) => ({ type: 'tool-result', toolCallId: p.toolCallId, toolName: p.toolName, output: p.output as any })),
});

const fileReadTool = (filePath: string, content?: string) => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---file_read', { filePath }),
    result: toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_read', output: { type: 'text', value: content ?? `content of ${filePath}` } }]),
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

const bashTool = (command: string, stdout: string, stderr = '', exitCode = 0) => {
  const tcId = nextTcId();
  return {
    tcId,
    assistant: assistantToolCallMsg(tcId, 'power---bash', { command }),
    result: toolResultMsg([
      {
        toolCallId: tcId,
        toolName: 'power---bash',
        output: { type: 'json', value: { stdout, stderr, exitCode } },
      },
    ]),
  };
};

const bashToolTextOutput = (command: string, stdout: string, stderr = '') => {
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

const assistantReasoningMsg = (reasoningText: string, text?: string): ContextMessage => {
  const content: Array<{ type: string; text: string }> = [{ type: 'reasoning', text: reasoningText }];
  if (text) {
    content.push({ type: 'text', text });
  }
  return {
    id: nextId(),
    role: 'assistant',
    content: content as any,
  };
};

const assistantReasoningAndToolCallMsg = (reasoningText: string, toolCallId: string, toolName: string, input: unknown): ContextMessage => ({
  id: nextId(),
  role: 'assistant',
  content: [
    { type: 'reasoning', text: reasoningText },
    { type: 'tool-call', toolCallId, toolName, input },
  ] as any,
});

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
  if (part.output.type === 'text' || part.output.type === 'error-text') {
    return part.output.value;
  }
  return JSON.stringify(part.output.value);
};

const resetCounters = () => {
  idCounter = 0;
  tcCounter = 0;
};

const padMessages = (count: number): ContextMessage[] => {
  return Array.from({ length: count }, (_, i) => userMsg(`padding-${i}`));
};

// No protected zone — useful for testing compaction logic in isolation
const NO_PROTECTION = 0;

// --- Tests ---

describe('smartCompactMessages', () => {
  it('returns empty array unchanged', async () => {
    expect(await smartCompactMessages([])).toEqual([]);
  });

  it('returns messages unchanged when no tools are present', async () => {
    resetCounters();
    const msgs = [userMsg('hello'), assistantTextMsg('hi'), userMsg('bye'), assistantTextMsg('bye!')];
    const result = await smartCompactMessages(msgs);
    expect(result).toHaveLength(4);
    expectInvariants(result);
  });

  it('preserves protected zone messages', async () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('protected')];
    const result = await smartCompactMessages(msgs, 4);
    expect(result).toHaveLength(4);
    expectInvariants(result);
  });
});

describe('CompactionLevel Four - removeVerboseToolCalls', () => {
  it('does nothing at level 3', () => {
    resetCounters();
    const longInput = { query: 'x'.repeat(200) };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'power---semantic_search', longInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---semantic_search', output: { type: 'text', value: 'results' } }]),
      userMsg('next'),
    ];
    const result = removeVerboseToolCalls(msgs, NO_PROTECTION, CompactionLevel.Three);
    expect(result).toHaveLength(4);
  });

  it('removes tool calls with input exceeding 150 chars and their results', () => {
    resetCounters();
    const longInput = { query: 'x'.repeat(200) };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'power---semantic_search', longInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---semantic_search', output: { type: 'text', value: 'results' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = removeVerboseToolCalls(msgs, 10, CompactionLevel.Four);
    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(0);
    const assistant = result.find((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toBeUndefined();
  });

  it('keeps tool calls with short inputs', () => {
    resetCounters();
    const shortInput = { query: 'short' };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'power---grep', shortInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---grep', output: { type: 'text', value: 'found' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = removeVerboseToolCalls(msgs, 10, CompactionLevel.Four);
    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(1);
    const assistant = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
  });

  it('removes assistant message if it becomes empty after tool call removal', () => {
    resetCounters();
    const longInput = { filePath: 'x'.repeat(200) };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'power---file_read', longInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = removeVerboseToolCalls(msgs, 10, CompactionLevel.Four);
    expect(result.find((m) => m.role === 'assistant')).toBeUndefined();
    expect(result.find((m) => m.role === 'tool')).toBeUndefined();
  });

  it('keeps assistant message text when tool call is removed but text remains', () => {
    resetCounters();
    const longInput = { filePath: 'x'.repeat(200) };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantTextAndToolCallMsg('Let me read this file', tcId, 'power---file_read', longInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = removeVerboseToolCalls(msgs, 10, CompactionLevel.Four);
    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(0);
    const assistant = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
    expect(Array.isArray(assistant[0].content)).toBe(true);
    const textParts = (assistant[0].content as any[]).filter((p) => p.type === 'text');
    expect(textParts).toHaveLength(1);
    expect(textParts[0].text).toBe('Let me read this file');
  });

  it('respects the 50-message protection window', () => {
    resetCounters();
    const longInput = { query: 'x'.repeat(200) };
    const msgs: ContextMessage[] = [userMsg('start')];
    for (let i = 0; i < 55; i++) {
      msgs.push({ id: 'u' + i, role: 'user', content: `msg ${i}` });
    }
    const tcId = nextTcId();
    msgs.push(assistantToolCallMsg(tcId, 'power---semantic_search', longInput));
    msgs.push(toolResultMsg([{ toolCallId: tcId, toolName: 'power---semantic_search', output: { type: 'text', value: 'results' } }]));

    const result = removeVerboseToolCalls(msgs, 10, CompactionLevel.Four);
    expect(result).toHaveLength(msgs.length);
    const toolMsgs = result.filter((m) => m.role === 'tool');
    expect(toolMsgs).toHaveLength(1);
  });
});

describe('CompactionLevel Five - removeReasoningFromAssistant', () => {
  it('does nothing at level 4', () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('go'), assistantReasoningMsg('thinking about it'), userMsg('next')];
    const result = removeReasoningFromAssistant(msgs, NO_PROTECTION, CompactionLevel.Four);
    expect(result).toHaveLength(3);
  });

  it('removes reasoning parts from assistant messages', () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('go'), assistantReasoningMsg('thinking about it', 'Here is my answer'), userMsg('transition'), ...padMessages(50)];
    const result = removeReasoningFromAssistant(msgs, 10, CompactionLevel.Five);
    const assistant = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
    const parts = assistant[0].content as any[];
    expect(parts.filter((p) => p.type === 'reasoning')).toHaveLength(0);
    expect(parts.filter((p) => p.type === 'text')).toHaveLength(1);
    expect(parts[0].text).toBe('Here is my answer');
  });

  it('removes assistant message if it only contained reasoning', () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('go'), assistantReasoningMsg('just thinking'), userMsg('transition'), ...padMessages(50)];
    const result = removeReasoningFromAssistant(msgs, 10, CompactionLevel.Five);
    expect(result.find((m) => m.role === 'assistant' && m.id === msgs[1].id)).toBeUndefined();
  });

  it('keeps tool calls when removing reasoning', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantReasoningAndToolCallMsg('reasoning here', tcId, 'power---grep', { searchTerm: 'foo' }),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---grep', output: { type: 'text', value: 'found' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = removeReasoningFromAssistant(msgs, 10, CompactionLevel.Five);
    const assistant = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toHaveLength(1);
    const parts = assistant[0].content as any[];
    expect(parts.filter((p) => p.type === 'reasoning')).toHaveLength(0);
    expect(parts.filter((p) => p.type === 'tool-call')).toHaveLength(1);
  });

  it('respects the 50-message protection window', () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('start')];
    for (let i = 0; i < 55; i++) {
      msgs.push({ id: 'u' + i, role: 'user', content: `msg ${i}` });
    }
    msgs.push(assistantReasoningMsg('thinking deeply'));
    msgs.push(userMsg('next'));

    const result = removeReasoningFromAssistant(msgs, 10, CompactionLevel.Five);
    expect(result).toHaveLength(msgs.length);
    const assistant = result.find((m): m is ContextAssistantMessage => m.role === 'assistant');
    expect(assistant).toBeDefined();
    const parts = assistant!.content as any[];
    expect(parts.some((p) => p.type === 'reasoning')).toBe(true);
  });
});

describe('CompactionLevel 4 & 5 - smartCompactMessages pipeline', () => {
  it('level 4 removes verbose tool calls in pipeline', async () => {
    resetCounters();
    const longInput = { filePath: 'x'.repeat(200) };
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('read'),
      assistantToolCallMsg(tcId, 'power---file_read', longInput),
      toolResultMsg([{ toolCallId: tcId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } }]),
      userMsg('next'),
      ...padMessages(50),
    ];
    const result = await smartCompactMessages(msgs, 10, CompactionLevel.Four);
    expect(result.find((m) => m.role === 'tool')).toBeUndefined();
    const assistants = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    const verboseAssistant = assistants.find((m) => m.id === msgs[1].id);
    expect(verboseAssistant).toBeUndefined();
    expectInvariants(result);
  });

  it('level 5 removes reasoning in pipeline', async () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('go'), assistantReasoningMsg('thinking about it', 'Here is my answer'), userMsg('transition'), ...padMessages(50)];
    const result = await smartCompactMessages(msgs, 10, CompactionLevel.Five);
    const assistants = result.filter((m): m is ContextAssistantMessage => m.role === 'assistant');
    const reasoningAssistant = assistants.find((m) => m.id === msgs[1].id);
    expect(reasoningAssistant).toBeDefined();
    const parts = reasoningAssistant!.content as any[];
    expect(parts.filter((p) => p.type === 'reasoning')).toHaveLength(0);
    expect(parts.filter((p) => p.type === 'text')).toHaveLength(1);
    expectInvariants(result);
  });

  it('level 5 removes assistant message with only reasoning in pipeline', async () => {
    resetCounters();
    const msgs: ContextMessage[] = [userMsg('go'), assistantReasoningMsg('just thinking'), userMsg('transition'), ...padMessages(50)];
    const result = await smartCompactMessages(msgs, 10, CompactionLevel.Five);
    expect(result.find((m) => m.role === 'assistant' && m.id === msgs[1].id)).toBeUndefined();
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

describe('compactFileReads', () => {
  it('truncates file read output longer than 50 lines', () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---file_read');
    const outputValue = getTextOutput(part);
    expect(outputValue).toContain('<truncated due to compaction, read the file again if full content is needed>');
    const outputLines = outputValue.split('\n');
    expect(outputLines.length).toBe(51);
    expect(outputLines[0]).toBe('line 1');
    expect(outputLines[49]).toBe('line 50');
    expectInvariants(result);
  });

  it('does not truncate file read output of exactly 50 lines', () => {
    resetCounters();
    const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', content);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---file_read');
    expect(getTextOutput(part)).not.toContain('<truncated');
    expect(getTextOutput(part).split('\n').length).toBe(50);
    expectInvariants(result);
  });

  it('does not truncate file read output shorter than 50 lines', () => {
    resetCounters();
    const content = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', content);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---file_read');
    expect(getTextOutput(part)).toBe(content);
    expectInvariants(result);
  });

  it('does not truncate file reads in protected zone', () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result];
    const result = compactFileReads(msgs, 3);
    const part = getToolResultPart(result, 'power---file_read');
    expect(getTextOutput(part)).toBe(longContent);
    expectInvariants(result);
  });

  it('skips non-text output types', () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('read'),
      assistantToolCallMsg(tcId, 'power---file_read', { filePath: 'src/foo.ts' }),
      {
        id: nextId(),
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: tcId,
            toolName: 'power---file_read',
            output: { type: 'json' as const, value: { lines: Array.from({ length: 100 }, (_, i) => `line ${i + 1}`) } },
          },
        ],
      },
      userMsg('next'),
    ];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const toolMsg = result.find((m): m is ContextToolMessage => m.role === 'tool')!;
    const part = toolMsg.content[0] as ToolResultPart;
    expect(part.output.type).toBe('json');
    expectInvariants(result);
  });

  it('truncates multiple file reads independently', () => {
    resetCounters();
    const longContent = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n');
    const read1 = fileReadTool('src/a.ts', longContent);
    const shortContent = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const read2 = fileReadTool('src/b.ts', shortContent);
    const msgs: ContextMessage[] = [userMsg('read a'), read1.assistant, read1.result, userMsg('read b'), read2.assistant, read2.result];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const readAPart = getToolResultPart(result, 'power---file_read');
    expect(getTextOutput(readAPart)).toContain('<truncated');
    // read2 is short, should not be truncated
    const toolMsgs = result.filter(
      (m): m is ContextToolMessage => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---file_read'),
    );
    const readBPart = toolMsgs[1].content[0] as ToolResultPart;
    expect(getTextOutput(readBPart)).not.toContain('<truncated');
    expectInvariants(result);
  });

  it('does not modify non-file-read tools', () => {
    resetCounters();
    const edit = fileEditTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('edit'), edit.assistant, edit.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---file_edit');
    expect(getTextOutput(part)).toBe('File edited successfully');
    expectInvariants(result);
  });
});

describe('compactBashOutputs', () => {
  it('keeps only the latest occurrence of duplicate commands', () => {
    resetCounters();
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm test', 'all passed again');
    const msgs: ContextMessage[] = [userMsg('run'), bash1.assistant, bash1.result, userMsg('run again'), bash2.assistant, bash2.result];
    const result = compactBashOutputs(msgs, NO_PROTECTION);
    const bashResults = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---bash'));
    expect(bashResults).toHaveLength(1);
    expectInvariants(result);
  });

  it('keeps unique commands', () => {
    resetCounters();
    const bash1 = bashTool('npm test', 'all passed');
    const bash2 = bashTool('npm build', 'built');
    const msgs: ContextMessage[] = [userMsg('test'), bash1.assistant, bash1.result, userMsg('build'), bash2.assistant, bash2.result];
    const result = compactBashOutputs(msgs, NO_PROTECTION);
    expect(result).toHaveLength(6);
    expectInvariants(result);
  });

  it('redacts long stdout in remaining bash results', () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toContain('redacted');
    expectInvariants(result);
  });

  it('redacts long stderr in remaining bash results', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok', 'e'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stderr).toContain('redacted');
    expectInvariants(result);
  });

  it('does not redact short output', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok', 'warn');
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION);
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
    const result = compactBashOutputs(msgs, 6);
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

describe('truncateNonPowerToolResults', () => {
  it('truncates large non-power-tool text output', async () => {
    resetCounters();
    const tcId = nextTcId();
    const longOutput = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'text', value: longOutput } }]),
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'mcp---my_tool');
    const outputValue = getTextOutput(part);
    expect(outputValue).toContain('truncated due to compaction');
    expect(outputValue).not.toContain('Full content saved to');
    expect(outputValue.split('\n').length).toBeLessThan(200);
    expectInvariants(result);
  });

  it('does not truncate small non-power-tool output', async () => {
    resetCounters();
    const tool = nonPowerTool('my_tool', 'small output');
    const msgs: ContextMessage[] = [userMsg('go'), tool.assistant, tool.result, userMsg('next')];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'other-server---my_tool');
    expect(getTextOutput(part)).toBe('small output');
    expectInvariants(result);
  });

  it('does not truncate power tool output', async () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'power---file_read');
    expect(getTextOutput(part)).toBe('content of src/foo.ts');
    expectInvariants(result);
  });

  it('does not truncate non-power-tool output in protected zone', async () => {
    resetCounters();
    const tcId = nextTcId();
    const longOutput = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'text', value: longOutput } }]),
    ];
    const result = await truncateNonPowerToolResults(msgs, 3);
    const part = getToolResultPart(result, 'mcp---my_tool');
    expect(getTextOutput(part)).toBe(longOutput);
    expectInvariants(result);
  });

  it('handles error-text output type', async () => {
    resetCounters();
    const tcId = nextTcId();
    const longError = Array.from({ length: 200 }, (_, i) => `error line ${i + 1}`).join('\n');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'error-text', value: longError } }]),
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION);
    const part = getToolResultPart(result, 'mcp---my_tool');
    const outputValue = getTextOutput(part);
    expect(outputValue).toContain('truncated');
    expectInvariants(result);
  });

  it('skips json output type', async () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      {
        id: nextId(),
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: tcId,
            toolName: 'mcp---my_tool',
            output: { type: 'json' as const, value: { big: 'data' } },
          },
        ],
      },
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION);
    const toolMsg = result.find((m): m is ContextToolMessage => m.role === 'tool')!;
    const part = toolMsg.content[0] as ToolResultPart;
    expect(part.output.type).toBe('json');
    expectInvariants(result);
  });
});

describe('full pipeline invariants', () => {
  it('maintains invariants on complex mixed scenario', async () => {
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

    const result = await smartCompactMessages(msgs, 10);
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

describe('CompactionLevel - compactFileReads', () => {
  it('level 1 truncates to 50 lines', () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION, CompactionLevel.One);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---file_read')).split('\n');
    expect(outputLines.length).toBe(51);
    expect(outputLines[50]).toContain('truncated due to compaction');
    expectInvariants(result);
  });

  it('level 2 truncates to 20 lines', () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION, CompactionLevel.Two);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---file_read')).split('\n');
    expect(outputLines.length).toBe(21);
    expect(outputLines[20]).toContain('truncated due to compaction');
    expectInvariants(result);
  });

  it('level 2 does not truncate 20-line file reads', () => {
    resetCounters();
    const content = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', content);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION, CompactionLevel.Two);
    expect(getTextOutput(getToolResultPart(result, 'power---file_read'))).not.toContain('truncated');
    expectInvariants(result);
  });

  it('level 3 fully redacts file reads', () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION, CompactionLevel.Three);
    const output = getTextOutput(getToolResultPart(result, 'power---file_read'));
    expect(output).toContain('result redacted due to compaction');
    expect(output).not.toContain('line 1');
    expectInvariants(result);
  });

  it('level 3 redacts even short file reads', () => {
    resetCounters();
    const read = fileReadTool('src/foo.ts', 'short content');
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = compactFileReads(msgs, NO_PROTECTION, CompactionLevel.Three);
    const output = getTextOutput(getToolResultPart(result, 'power---file_read'));
    expect(output).toContain('result redacted due to compaction');
    expect(output).not.toContain('short content');
    expectInvariants(result);
  });
});

describe('CompactionLevel - removeObsoleteSearches', () => {
  it('level 1 only removes searches before file modifications', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const edit = fileEditTool('src/a.ts');
    const search2 = grepTool('TODO');
    const msgs: ContextMessage[] = [userMsg('go'), search.assistant, search.result, edit.assistant, edit.result, search2.assistant, search2.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION, CompactionLevel.One);
    // search before edit is removed, search2 after edit is kept
    const remaining = result.filter(
      (m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && (p.toolName === 'power---glob' || p.toolName === 'power---grep')),
    );
    expect(remaining).toHaveLength(1);
    expectInvariants(result);
  });

  it('level 1 keeps searches when no file modifications exist', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const msgs: ContextMessage[] = [userMsg('go'), search.assistant, search.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION, CompactionLevel.One);
    expect(result).toHaveLength(3);
    expectInvariants(result);
  });

  it('level 3 removes all searches even without file modifications', () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const msgs: ContextMessage[] = [userMsg('go'), search.assistant, search.result];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION, CompactionLevel.Three);
    const remaining = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---glob'));
    expect(remaining).toHaveLength(0);
    expectInvariants(result);
  });

  it('level 3 removes all glob and grep results', () => {
    resetCounters();
    const search1 = globTool('**/*.ts');
    const search2 = grepTool('TODO');
    const edit = fileEditTool('src/a.ts');
    const search3 = globTool('**/*.test.ts');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      search1.assistant,
      search1.result,
      search2.assistant,
      search2.result,
      edit.assistant,
      edit.result,
      search3.assistant,
      search3.result,
    ];
    const result = removeObsoleteSearches(msgs, NO_PROTECTION, CompactionLevel.Three);
    const remaining = result.filter(
      (m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && (p.toolName === 'power---glob' || p.toolName === 'power---grep')),
    );
    expect(remaining).toHaveLength(0);
    expectInvariants(result);
  });
});

describe('CompactionLevel - compactSemanticSearches', () => {
  it('level 1 truncates kept search to 50 lines', () => {
    resetCounters();
    const search1 = semanticSearchTool('query1', 60);
    const search2 = semanticSearchTool('query2', 60);
    const msgs: ContextMessage[] = [userMsg('go'), search1.assistant, search1.result, userMsg('go2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION, CompactionLevel.One);
    // Only last search kept, truncated to 50 lines
    const kept = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---semantic_search'));
    expect(kept).toHaveLength(1);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---semantic_search')).split('\n');
    expect(outputLines.length).toBe(51);
    expect(outputLines[50]).toContain('truncated due to compaction');
    expectInvariants(result);
  });

  it('level 2 truncates kept search to 20 lines', () => {
    resetCounters();
    const search1 = semanticSearchTool('query1', 60);
    const search2 = semanticSearchTool('query2', 60);
    const msgs: ContextMessage[] = [userMsg('go'), search1.assistant, search1.result, userMsg('go2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION, CompactionLevel.Two);
    const kept = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---semantic_search'));
    expect(kept).toHaveLength(1);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---semantic_search')).split('\n');
    expect(outputLines.length).toBe(21);
    expect(outputLines[20]).toContain('truncated due to compaction');
    expectInvariants(result);
  });

  it('level 3 removes all semantic searches', () => {
    resetCounters();
    const search1 = semanticSearchTool('query1', 5);
    const search2 = semanticSearchTool('query2', 5);
    const msgs: ContextMessage[] = [userMsg('go'), search1.assistant, search1.result, userMsg('go2'), search2.assistant, search2.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION, CompactionLevel.Three);
    const remaining = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---semantic_search'));
    expect(remaining).toHaveLength(0);
    expectInvariants(result);
  });

  it('level 3 removes even a single semantic search', () => {
    resetCounters();
    const search = semanticSearchTool('query1', 5);
    const msgs: ContextMessage[] = [userMsg('go'), search.assistant, search.result];
    const result = compactSemanticSearches(msgs, NO_PROTECTION, CompactionLevel.Three);
    const remaining = result.filter((m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && p.toolName === 'power---semantic_search'));
    expect(remaining).toHaveLength(0);
    expectInvariants(result);
  });
});

describe('CompactionLevel - compactBashOutputs', () => {
  it('level 1 redacts output longer than 30 chars', () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.One);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toContain('redacted');
    expectInvariants(result);
  });

  it('level 1 keeps short bash output intact', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok');
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.One);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toBe('ok');
    expectInvariants(result);
  });

  it('level 2 redacts all bash output', () => {
    resetCounters();
    const bash = bashTool('npm test', 'ok');
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.Two);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toContain('redacted');
    expectInvariants(result);
  });

  it('level 3 fully redacts bash results', () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.Three);
    const output = getTextOutput(getToolResultPart(result, 'power---bash'));
    expect(output).toBe('<result redacted due to compaction, run again if needed>');
    expectInvariants(result);
  });

  it('preserves exitCode when redacting json bash output', () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100), '', 1);
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.One);
    const part = getToolResultPart(result, 'power---bash');
    const value = (part.output as { type: 'json'; value: Record<string, unknown> }).value;
    expect(value.exitCode).toBe(1);
    expect(value.stdout).toContain('redacted');
    expectInvariants(result);
  });

  it('handles text type bash output for backwards compatibility', () => {
    resetCounters();
    const bash = bashToolTextOutput('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = compactBashOutputs(msgs, NO_PROTECTION, CompactionLevel.One);
    const parsed = JSON.parse(getTextOutput(getToolResultPart(result, 'power---bash')));
    expect(parsed.stdout).toContain('redacted');
    expectInvariants(result);
  });
});

describe('CompactionLevel - truncateNonPowerToolResults', () => {
  it('level 1 truncates with 20 lines limit', async () => {
    resetCounters();
    const tcId = nextTcId();
    const longOutput = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'text', value: longOutput } }]),
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION, CompactionLevel.One);
    const outputValue = getTextOutput(getToolResultPart(result, 'mcp---my_tool'));
    expect(outputValue).toContain('truncated due to compaction');
    expectInvariants(result);
  });

  it('level 2 truncates with stricter limits', async () => {
    resetCounters();
    const tcId = nextTcId();
    const longOutput = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'text', value: longOutput } }]),
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION, CompactionLevel.Two);
    const outputValue = getTextOutput(getToolResultPart(result, 'mcp---my_tool'));
    expect(outputValue).toContain('truncated due to compaction');
    expect(outputValue.split('\n').length).toBeLessThan(200);
    expectInvariants(result);
  });

  it('level 3 fully redacts non-power-tool output', async () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      toolResultMsg([{ toolCallId: tcId, toolName: 'mcp---my_tool', output: { type: 'text', value: 'some output here' } }]),
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION, CompactionLevel.Three);
    const outputValue = getTextOutput(getToolResultPart(result, 'mcp---my_tool'));
    expect(outputValue).toContain('Result redacted due to compaction');
    expect(outputValue).not.toContain('some output');
    expectInvariants(result);
  });

  it('level 3 redacts json non-power-tool output to text type', async () => {
    resetCounters();
    const tcId = nextTcId();
    const msgs: ContextMessage[] = [
      userMsg('go'),
      assistantToolCallMsg(tcId, 'mcp---my_tool', {}),
      {
        id: nextId(),
        role: 'tool',
        content: [
          {
            type: 'tool-result' as const,
            toolCallId: tcId,
            toolName: 'mcp---my_tool',
            output: { type: 'json' as const, value: { big: 'data', nested: { deep: true } } },
          },
        ],
      },
      userMsg('next'),
    ];
    const result = await truncateNonPowerToolResults(msgs, NO_PROTECTION, CompactionLevel.Three);
    const toolMsg = result.find((m): m is ContextToolMessage => m.role === 'tool')!;
    const part = toolMsg.content[0] as ToolResultPart;
    expect(part.output.type).toBe('text');
    expect((part.output as { type: 'text'; value: string }).value).toContain('Result redacted due to compaction');
    expectInvariants(result);
  });
});

describe('CompactionLevel - smartCompactMessages pipeline', () => {
  it('level 1 is the default', async () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = await smartCompactMessages(msgs, NO_PROTECTION);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---file_read')).split('\n');
    expect(outputLines.length).toBe(51);
    expectInvariants(result);
  });

  it('level 2 applies more aggressive truncation', async () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = await smartCompactMessages(msgs, NO_PROTECTION, CompactionLevel.Two);
    const outputLines = getTextOutput(getToolResultPart(result, 'power---file_read')).split('\n');
    expect(outputLines.length).toBe(21);
    expectInvariants(result);
  });

  it('level 3 fully redacts file reads in pipeline', async () => {
    resetCounters();
    const longContent = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const read = fileReadTool('src/foo.ts', longContent);
    const msgs: ContextMessage[] = [userMsg('read'), read.assistant, read.result, userMsg('next')];
    const result = await smartCompactMessages(msgs, NO_PROTECTION, CompactionLevel.Three);
    const output = getTextOutput(getToolResultPart(result, 'power---file_read'));
    expect(output).toContain('result redacted due to compaction');
    expect(output).not.toContain('line 1');
    expectInvariants(result);
  });

  it('level 3 removes all searches in pipeline', async () => {
    resetCounters();
    const search = globTool('**/*.ts');
    const edit = fileEditTool('src/a.ts');
    const msgs: ContextMessage[] = [userMsg('go'), search.assistant, search.result, edit.assistant, edit.result];
    const result = await smartCompactMessages(msgs, NO_PROTECTION, CompactionLevel.Three);
    const searches = result.filter(
      (m) => m.role === 'tool' && m.content.some((p) => p.type === 'tool-result' && (p.toolName === 'power---glob' || p.toolName === 'power---grep')),
    );
    expect(searches).toHaveLength(0);
    expectInvariants(result);
  });

  it('level 3 redacts bash output in pipeline', async () => {
    resetCounters();
    const bash = bashTool('npm test', 'a'.repeat(100));
    const msgs: ContextMessage[] = [userMsg('run'), bash.assistant, bash.result, userMsg('next')];
    const result = await smartCompactMessages(msgs, NO_PROTECTION, CompactionLevel.Three);
    const bashPart = getToolResultPart(result, 'power---bash');
    const output = getTextOutput(bashPart);
    expect(output).toContain('redacted');
    expectInvariants(result);
  });
});
