import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolMessage } from '@common/types';

import { SubagentToolMessage } from '../SubagentToolMessage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { error?: string }) => (options?.error ? `${key}: ${options.error}` : key),
  }),
}));

vi.mock('@/components/message/MessageBar', () => ({
  MessageBar: ({ content }: { content: string }) => <pre data-testid="copy-content">{content}</pre>,
}));

vi.mock('@/components/message/CopyMessageButton', () => ({
  CopyMessageButton: () => null,
}));

const createMessage = (content: string): ToolMessage => ({
  id: 'subagent-tool',
  type: 'tool',
  serverName: 'subagents',
  toolName: 'run_task',
  args: { subagentId: 'cursor-subagent', prompt: 'Investigate the issue' },
  content,
});

describe('SubagentToolMessage', () => {
  it.each([false, true])('renders legacy plain-text errors without crashing (compact=%s)', (compact) => {
    const error = 'Error: [object Object]';
    render(<SubagentToolMessage message={createMessage(error)} compact={compact} />);

    expect(screen.getByText(`toolMessage.subagents.error: ${error}`)).toBeInTheDocument();
    if (!compact) {
      expect(JSON.parse(screen.getByTestId('copy-content').textContent ?? '').result).toBe(error);
    }
  });

  it('renders JSON-encoded errors and copies the decoded result', () => {
    const error = 'Error: Cursor task failed';
    render(<SubagentToolMessage message={createMessage(JSON.stringify(error))} />);

    expect(screen.getByText(`toolMessage.subagents.error: ${error}`)).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('copy-content').textContent ?? '').result).toBe(error);
  });

  it.each(['Plain-text result', '{"messages":'])('preserves non-JSON results without crashing: %s', (content) => {
    render(<SubagentToolMessage message={createMessage(content)} />);

    expect(screen.getByText('toolMessage.subagents.completed')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('copy-content').textContent ?? '').result).toBe(content);
  });

  it('keeps successful JSON results intact', () => {
    const result = { messages: [], promptContext: { id: 'prompt-context' } };
    render(<SubagentToolMessage message={createMessage(JSON.stringify(result))} />);

    expect(screen.getByText('toolMessage.subagents.completed')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('copy-content').textContent ?? '').result).toEqual(result);
  });

  it('keeps empty results in the running state', () => {
    render(<SubagentToolMessage message={createMessage('')} />);

    expect(screen.getByText('toolMessage.subagents.running')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('copy-content').textContent ?? '').result).toBe('');
  });
});
