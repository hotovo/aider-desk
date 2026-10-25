import { ReactNode } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ToolMessage } from '@common/types';

import { MessageBlock } from '../MessageBlock';
import { CompactToolMessage } from '../CompactToolMessage';

import { render } from '@/__tests__/render';
import { ApiContext } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/common/Accordion', () => ({
  Accordion: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
    <div>
      <header>{title}</header>
      {children}
    </div>
  ),
}));

vi.mock('@/components/common/CodeBlock', () => ({
  CodeBlock: ({ children, oldValue, newValue }: { children?: ReactNode; oldValue?: string; newValue?: string }) => (
    <pre>
      {oldValue}
      {newValue}
      {children}
    </pre>
  ),
}));

vi.mock('@/components/common/IconButton', () => ({
  IconButton: ({ icon, onClick, tooltip }: { icon: ReactNode; onClick?: () => void; tooltip?: string }) => (
    <button aria-label={tooltip} onClick={onClick}>
      {icon}
    </button>
  ),
}));

const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});
afterAll(() => {
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  }
});

const envelope = {
  truncated: true,
  note: 'Content truncated due to size.',
  originalLength: 300_000,
  preview: 'PARTIAL_RESULT',
};

const createMessage = (serverName: string, toolName: string, result: unknown = envelope, args: ToolMessage['args'] = {}): ToolMessage => ({
  id: 'truncated-tool',
  type: 'tool',
  serverName,
  toolName,
  args,
  content: JSON.stringify(result),
});

const renderMessage = (message: ToolMessage) => {
  const api = createMockApi();
  render(
    <ApiContext.Provider value={api}>
      <MessageBlock baseDir="/project" taskId="task" message={message} allFiles={[]} renderMarkdown={false} hideMessageBar />
    </ApiContext.Provider>,
  );
  return api;
};

const toolCases = [
  ['power', 'fetch'],
  ['power', 'bash'],
  ['power', 'file_read'],
  ['power', 'file_write'],
  ['power', 'file_edit'],
  ['power', 'glob'],
  ['power', 'grep'],
  ['power', 'semantic_search'],
  ['tasks', 'create_task'],
  ['tasks', 'delete_task'],
  ['tasks', 'get_task'],
  ['tasks', 'get_task_message'],
  ['tasks', 'list_tasks'],
  ['tasks', 'run_prompt'],
  ['tasks', 'search_task'],
  ['tasks', 'search_parent_task'],
  ['memory', 'store_memory'],
  ['memory', 'retrieve_memory'],
  ['memory', 'delete_memory'],
  ['memory', 'update_memory'],
  ['memory', 'list_memories'],
  ['skills', 'activate_skill'],
  ['subagents', 'run_task'],
  ['custom-server', 'custom-tool'],
];

describe('truncated tool messages', () => {
  it.each(toolCases)('renders a warning and safe preview for %s/%s', async (serverName, toolName) => {
    const message = createMessage(serverName, toolName);
    renderMessage(message);
    expect(screen.getByRole('status')).toHaveTextContent('toolMessage.truncatedResult.notice');
    expect(screen.getByText(envelope.preview)).toBeInTheDocument();
    expect(message.content).toBe(JSON.stringify(envelope));
    await waitFor(() => expect(screen.getByText(envelope.preview)).toBeInTheDocument());
  });

  it.each(['"An unfinished string', '["file.ts",', '{"stdout":"partial'])('does not parse incomplete preview JSON: %s', (preview) => {
    renderMessage(createMessage('power', 'fetch', { ...envelope, preview }, { url: 'https://example.com', format: 'raw' }));
    expect(screen.getByText(preview)).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('keeps the file edit inputs and filename', () => {
    renderMessage(
      createMessage('power', 'file_edit', envelope, { filePath: 'example.ts', searchTerm: 'OLD_INPUT', replacementText: 'NEW_INPUT', isRegex: true }),
    );
    expect(screen.getByText('example.ts')).toBeInTheDocument();
    expect(screen.getByText('OLD_INPUT')).toBeInTheDocument();
    expect(screen.getByText('NEW_INPUT')).toBeInTheDocument();
  });

  it('keeps file-write content and the filename', () => {
    renderMessage(createMessage('power', 'file_write', envelope, { filePath: 'written.ts', content: 'FILE_INPUT' }));
    expect(screen.getByText('written.ts')).toBeInTheDocument();
    expect(screen.getByText('FILE_INPUT')).toBeInTheDocument();
  });

  it('keeps file-read options', () => {
    renderMessage(createMessage('power', 'file_read', envelope, { filePath: 'read.ts', withLines: true, lineOffset: 10, lineLimit: 20 }));
    expect(screen.getByText('read.ts')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('keeps task creation settings without inventing a returned task ID', () => {
    renderMessage(
      createMessage('tasks', 'create_task', envelope, { prompt: 'TASK_PROMPT', name: 'TASK_NAME', agentProfileId: 'AGENT_INPUT', modelId: 'MODEL_INPUT' }),
    );
    expect(screen.getByText('TASK_NAME', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('AGENT_INPUT', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('MODEL_INPUT', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('toolMessage.tasks.taskId:')).not.toBeInTheDocument();
  });

  it('keeps task list pagination', () => {
    renderMessage(createMessage('tasks', 'list_tasks', envelope, { offset: 10, limit: 25 }));
    expect(screen.getByText(/offset=10, limit=25/)).toBeInTheDocument();
  });

  it('keeps bash command, description, working directory, and timeout', () => {
    renderMessage(createMessage('power', 'bash', envelope, { command: 'pwd', description: 'COMMAND_DESCRIPTION', cwd: '/workspace', timeout: 1500 }));
    expect(screen.getByText('pwd')).toBeInTheDocument();
    expect(screen.getByText('COMMAND_DESCRIPTION')).toBeInTheDocument();
    expect(screen.getByText('/workspace')).toBeInTheDocument();
    expect(screen.getByText('1500ms')).toBeInTheDocument();
  });

  it.each(['glob', 'grep', 'semantic_search'])('does not report no matches for truncated %s results', (toolName) => {
    renderMessage(createMessage('power', toolName, envelope, { pattern: '**/*.ts', filePattern: '*.ts', searchTerm: 'needle', query: 'needle' }));
    expect(screen.queryByText(`toolMessage.power.${toolName === 'semantic_search' ? 'semanticSearch' : toolName}.noMatches`)).not.toBeInTheDocument();
  });

  it('keeps memory query parameters', async () => {
    renderMessage(createMessage('memory', 'retrieve_memory', envelope, { query: 'QUERY_INPUT', limit: 5 }));
    expect(screen.getByText(/QUERY_INPUT/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(envelope.preview)).toBeInTheDocument());
  });

  it.each(toolCases)('shows serialization failures safely for %s/%s', async (serverName, toolName) => {
    renderMessage(createMessage(serverName, toolName, { truncated: true, note: 'Value could not be serialized to JSON.' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('toolMessage.truncatedResult.unavailable')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
  });

  it('copies the available preview', async () => {
    const api = renderMessage(createMessage('power', 'fetch'));
    fireEvent.click(screen.getByRole('button', { name: 'messages.copy' }));
    await waitFor(() => expect(api.writeToClipboard).toHaveBeenCalledWith(envelope.preview));
  });

  it('handles truncated results in compact tool groups while retaining the command', () => {
    render(
      <ApiContext.Provider value={createMockApi()}>
        <CompactToolMessage message={createMessage('power', 'bash', envelope, { command: 'pwd' })} isExpanded onToggle={vi.fn()} />
      </ApiContext.Provider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('toolMessage.truncatedResult.notice');
    expect(screen.getByText('pwd')).toBeInTheDocument();
    expect(screen.getByText(envelope.preview)).toBeInTheDocument();
  });

  it.each([
    ['power', 'fetch', 'ORDINARY_OUTPUT'],
    ['power', 'glob', ['ordinary.ts']],
    ['power', 'bash', { stdout: 'ORDINARY_OUTPUT', exitCode: 0 }],
  ])('keeps normal %s/%s results unchanged', (serverName, toolName, result) => {
    renderMessage(createMessage(serverName as string, toolName as string, result));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const expected = Array.isArray(result) ? 'ordinary.ts' : 'ORDINARY_OUTPUT';
    expect(screen.getByText((text, element) => text === expected || (element?.tagName === 'PRE' && element.textContent === expected))).toBeInTheDocument();
  });
});
