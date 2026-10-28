import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantGroupMessage, ToolMessage, UsageReportData } from '@common/types';
import { ComponentProps } from 'react';

import { AssistantMessageBlock } from '../AssistantMessageBlock';
import { MessageBar } from '../MessageBar';
import { MessageBlockWrapper } from '../MessageBlockWrapper';

vi.mock('../MessageBar', () => ({ MessageBar: vi.fn(() => null) }));
vi.mock('../MessageBlockWrapper', () => ({ MessageBlockWrapper: vi.fn(() => null) }));
vi.mock('@/hooks/useParsedContent', () => ({ useParsedContent: () => null }));

const usage: UsageReportData = { model: 'test-model', sentTokens: 10, receivedTokens: 20, messageCost: 0.1 };
const tools: ToolMessage[] = [
  { id: 'tool-1', type: 'tool', serverName: 'test', toolName: 'read', args: {}, content: 'First result', usageReport: usage },
  { id: 'tool-2', type: 'tool', serverName: 'test', toolName: 'write', args: {}, content: 'Second result', usageReport: { ...usage, sentTokens: 30 } },
];
const message: AssistantGroupMessage = { id: 'tool-1', type: 'assistant-group', content: '', toolMessages: tools };

const renderGroup = (overrides: Partial<ComponentProps<typeof AssistantMessageBlock>> = {}) => {
  render(<AssistantMessageBlock baseDir="/project" taskId="task" message={message} allFiles={[]} renderMarkdown {...overrides} />);
  return vi.mocked(MessageBar).mock.calls.at(-1)![0];
};

describe('AssistantMessageBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tool-only groups with one bar, combined copy content and aggregated usage', () => {
    const bar = renderGroup();

    expect(MessageBar).toHaveBeenCalledTimes(1);
    expect(MessageBlockWrapper).toHaveBeenCalledTimes(2);
    expect(vi.mocked(MessageBlockWrapper).mock.calls.map((call) => call[0].message)).toEqual(tools);
    expect(vi.mocked(MessageBlockWrapper).mock.calls.every((call) => call[0].hideMessageBar)).toBe(true);
    expect(bar.content).toBe('First result\n\nSecond result');
    expect(bar.usageReport).toMatchObject({ model: 'test-model', sentTokens: 30, receivedTokens: 20, messageCost: 0.2 });
  });

  it('deletes only the real tool messages', () => {
    const remove = vi.fn();
    renderGroup({ remove }).remove?.();
    expect(remove.mock.calls).toEqual([[tools[0]], [tools[1]]]);
  });

  it('forks from the first tool and deletes up to the last tool', () => {
    const onFork = vi.fn();
    const onRemoveUpTo = vi.fn();
    const bar = renderGroup({ onFork, onRemoveUpTo });
    bar.onFork?.();
    bar.onRemoveUpTo?.();
    expect(onFork).toHaveBeenCalledExactlyOnceWith(tools[0]);
    expect(onRemoveUpTo).toHaveBeenCalledExactlyOnceWith(tools[1]);
  });

  it('preserves response-based copy, delete and fork behavior', () => {
    const responseMessage = { id: 'response', type: 'response' as const, content: 'Answer', reasoning: 'Thinking', usageReport: usage };
    const remove = vi.fn();
    const onFork = vi.fn();
    const bar = renderGroup({ message: { ...message, responseMessage }, remove, onFork });
    bar.remove?.();
    bar.onFork?.();
    expect(remove.mock.calls).toEqual([[responseMessage], [tools[0]], [tools[1]]]);
    expect(onFork).toHaveBeenCalledExactlyOnceWith(responseMessage);
    expect(bar.content).toBe('Thinking\n\nAnswer\n\nFirst result\n\nSecond result');
    expect(bar.usageReport?.messageCost).toBeCloseTo(0.3);
  });
});
