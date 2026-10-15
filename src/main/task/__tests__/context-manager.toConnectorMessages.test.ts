import { describe, expect, it, vi } from 'vitest';
import { SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { ContextManager } from '../context-manager';

import type { ContextMessage, JSONValue } from '@common/types';
import type { Task } from '@/task';

const toolName = `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`;
const task = { getProjectDir: vi.fn(() => '/test/project') } as unknown as Task;

const contextWithSubagentResult = (value: JSONValue): ContextMessage[] => [
  {
    id: 'assistant-1',
    role: 'assistant',
    content: [{ type: 'tool-call', toolCallId: 'call-1', toolName, input: { prompt: 'delegate this' } }],
  },
  {
    id: 'tool-1',
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'call-1', toolName, output: { type: 'json', value } }],
  },
];

describe('ContextManager.toConnectorMessages subagent results', () => {
  it.each([
    {
      value: {
        messages: [
          { role: 'assistant', content: 'intermediate' },
          { role: 'assistant', content: 'final' },
        ],
        promptContext: { id: 'ui' },
      },
    },
    {
      value: [
        { role: 'assistant', content: 'intermediate' },
        { role: 'assistant', content: 'final' },
      ],
    },
  ])('uses the final output from current and legacy payloads', ({ value }) => {
    const manager = new ContextManager(task, 'test-task', contextWithSubagentResult(value));
    expect(manager.toConnectorMessages()).toEqual([
      { role: 'user', content: 'delegate this' },
      { role: 'assistant', content: 'final' },
    ]);
  });

  it('handles an empty subagent history', () => {
    const manager = new ContextManager(task, 'test-task', contextWithSubagentResult({ messages: [] }));
    expect(manager.toConnectorMessages()).toEqual([{ role: 'user', content: 'delegate this' }]);
  });
});
