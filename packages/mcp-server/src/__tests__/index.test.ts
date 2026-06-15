import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

import { server } from '../index';

vi.mock('axios');

const mockedAxios = vi.mocked(axios);

function getTool(name: string) {
  // @ts-expect-error - accessing private/protected property for verification
  return server._registeredTools[name];
}

describe('AiderDesk MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be initialized with correct metadata', () => {
    // @ts-expect-error - accessing private/protected property for verification
    const serverInfo = server.server._serverInfo;
    expect(serverInfo.name).toBe('aider-desk-mcp-server');
    expect(serverInfo.version).toBe('0.2.0');
  });

  it('should have all 11 tools registered', () => {
    // @ts-expect-error - accessing private/protected property for verification
    const registeredTools = server._registeredTools;
    const toolNames = Object.keys(registeredTools);

    expect(toolNames).toContain('list_tasks');
    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('get_task');
    expect(toolNames).toContain('add_context_file');
    expect(toolNames).toContain('drop_context_file');
    expect(toolNames).toContain('get_context_files');
    expect(toolNames).toContain('get_addable_files');
    expect(toolNames).toContain('get_updated_files');
    expect(toolNames).toContain('get_context_messages');
    expect(toolNames).toContain('run_prompt');
    expect(toolNames).toContain('clear_context');
  });

  // --- Task management ---

  it('list_tasks should call GET /project/tasks with pagination and sorting', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        { id: '1', name: 'Old', updatedAt: '2025-01-01T00:00:00Z' },
        { id: '2', name: 'New', updatedAt: '2025-06-01T00:00:00Z' },
      ],
    });

    const result = await getTool('list_tasks').handler({ offset: 0, limit: 1 });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/project/tasks'),
      expect.objectContaining({ params: { projectDir: '.' } }),
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(2);
    expect(parsed.tasks[0].name).toBe('New');
    expect(parsed.tasks).toHaveLength(1);
  });

  it('create_task should POST to /project/tasks/new', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 'abc', name: 'My Task' } });

    const result = await getTool('create_task').handler({ name: 'My Task' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/project/tasks/new'),
      expect.objectContaining({ projectDir: '.', name: 'My Task', activate: true }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 'abc', name: 'My Task' });
  });

  it('get_task should return task summary with message count', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        messages: [{ role: 'user' }, { role: 'assistant' }],
        files: [{ path: 'src/index.ts', readOnly: false }],
        todoItems: [{ text: 'todo' }],
        workingMode: 'local',
        question: null,
      },
    });

    const result = await getTool('get_task').handler({ taskId: 'task-1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/project/tasks/load'),
      expect.objectContaining({ projectDir: '.', id: 'task-1' }),
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.messages).toBe(2);
    expect(parsed.contextFiles).toHaveLength(1);
    expect(parsed.todoItems).toBe(1);
  });

  // --- Context file tools (now with taskId) ---

  it('add_context_file should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { message: 'File added to context' } });

    const result = await getTool('add_context_file').handler({ taskId: 'task-1', path: 'test.txt', readOnly: false });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/add-context-file'),
      expect.objectContaining({ taskId: 'task-1', path: 'test.txt', readOnly: false, projectDir: '.' }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual({ message: 'File added to context' });
  });

  it('drop_context_file should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { message: 'File dropped from context' } });

    const result = await getTool('drop_context_file').handler({ taskId: 'task-1', path: 'test.txt' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/drop-context-file'),
      expect.objectContaining({ taskId: 'task-1', path: 'test.txt', projectDir: '.' }),
    );
  });

  it('get_context_files should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: [{ path: 'test.txt', readOnly: false }] });

    const result = await getTool('get_context_files').handler({ taskId: 'task-1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/get-context-files'),
      expect.objectContaining({ taskId: 'task-1', projectDir: '.' }),
    );
  });

  it('get_addable_files should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: ['other.txt'] });

    const result = await getTool('get_addable_files').handler({ taskId: 'task-1', searchRegex: '.*' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/get-addable-files'),
      expect.objectContaining({ taskId: 'task-1', searchRegex: '.*', projectDir: '.' }),
    );
  });

  it('get_updated_files should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: [{ path: 'modified.ts' }] });

    const result = await getTool('get_updated_files').handler({ taskId: 'task-1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/get-updated-files'),
      expect.objectContaining({ taskId: 'task-1', projectDir: '.' }),
    );
  });

  // --- Context messages ---

  it('get_context_messages should paginate with positive offset', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `msg-${i}` }));
    mockedAxios.post.mockResolvedValueOnce({ data: { messages } });

    const result = await getTool('get_context_messages').handler({ taskId: 'task-1', offset: 2, limit: 3 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(10);
    expect(parsed.offset).toBe(2);
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0].index).toBe(2);
    expect(parsed.messages[0].content).toBe('msg-2');
  });

  it('get_context_messages should support negative offset from end', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `msg-${i}` }));
    mockedAxios.post.mockResolvedValueOnce({ data: { messages } });

    const result = await getTool('get_context_messages').handler({ taskId: 'task-1', offset: -3 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total).toBe(10);
    expect(parsed.offset).toBe(7);
    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages[0].index).toBe(7);
    expect(parsed.messages[2].content).toBe('msg-9');
  });

  // --- Prompt tools ---

  it('run_prompt should include taskId and accept string mode', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { output: 'done' } });

    const result = await getTool('run_prompt').handler({ taskId: 'task-1', prompt: 'hello', mode: 'agent' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/run-prompt'),
      expect.objectContaining({ taskId: 'task-1', prompt: 'hello', mode: 'agent', projectDir: '.' }),
    );
  });

  it('clear_context should include taskId in request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { message: 'Context cleared' } });

    const result = await getTool('clear_context').handler({ taskId: 'task-1' });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/project/clear-context'),
      expect.objectContaining({ taskId: 'task-1', projectDir: '.' }),
    );
  });

  // --- Error handling ---

  it('should handle API errors gracefully', async () => {
    mockedAxios.post.mockRejectedValueOnce({ message: 'API Error' });

    const result = await getTool('run_prompt').handler({ taskId: 'task-1', prompt: 'hello', mode: 'ask' });

    expect(result.content[0].text).toBe('API Error');
  });

  it('should stringify error response data', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { error: 'Not found' } },
      message: 'Request failed',
    });

    const result = await getTool('run_prompt').handler({ taskId: 'task-1', prompt: 'hello', mode: 'ask' });

    expect(result.content[0].text).toBe(JSON.stringify({ error: 'Not found' }));
  });
});
