import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

import { server } from '../aider-desk-mcp-server';

vi.mock('axios');

describe('AiderDesk MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be initialized with correct metadata', () => {
    // @ts-expect-error - accessing private/protected property for verification
    const serverInfo = server.server._serverInfo;
    expect(serverInfo.name).toBe('aider-desk-mcp-server');
    expect(serverInfo.version).toBe('0.1.0');
  });

  it('should have all expected tools registered', () => {
    // @ts-expect-error - accessing private/protected property for verification
    const registeredTools = server._registeredTools;
    const toolNames = Object.keys(registeredTools);

    expect(toolNames).toContain('add_context_file');
    expect(toolNames).toContain('drop_context_file');
    expect(toolNames).toContain('get_context_files');
    expect(toolNames).toContain('get_addable_files');
    expect(toolNames).toContain('run_prompt');
    expect(toolNames).toContain('clear_context');
  });

  it('should call AiderDesk API when add_context_file is executed', async () => {
    const mockResponse = { data: { success: true } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['add_context_file'];
    const result = await tool.handler({ path: 'test.txt', readOnly: false });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/add-context-file'),
      expect.objectContaining({ path: 'test.txt', readOnly: false, projectDir: '.' }),
    );
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should call AiderDesk API when drop_context_file is executed', async () => {
    const mockResponse = { data: { success: true } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['drop_context_file'];
    const result = await tool.handler({ path: 'test.txt' });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/drop-context-file'), expect.objectContaining({ path: 'test.txt', projectDir: '.' }));
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should call AiderDesk API when get_context_files is executed', async () => {
    const mockResponse = { data: { files: ['test.txt'] } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['get_context_files'];
    const result = await tool.handler({});

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/get-context-files'), expect.objectContaining({ projectDir: '.' }));
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should call AiderDesk API when get_addable_files is executed', async () => {
    const mockResponse = { data: { files: ['other.txt'] } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['get_addable_files'];
    const result = await tool.handler({ searchRegex: '.*' });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/get-addable-files'), expect.objectContaining({ searchRegex: '.*', projectDir: '.' }));
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should call AiderDesk API when run_prompt is executed', async () => {
    const mockResponse = { data: { output: 'done' } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['run_prompt'];
    const result = await tool.handler({ prompt: 'hello', mode: 'ask' });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/run-prompt'), expect.objectContaining({ prompt: 'hello', mode: 'ask', projectDir: '.' }));
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should call AiderDesk API when clear_context is executed', async () => {
    const mockResponse = { data: { success: true } };
    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    // @ts-expect-error - accessing private/protected property for verification
    const tool = server._registeredTools['clear_context'];
    const result = await tool.handler({});

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/project/clear-context'), expect.objectContaining({ projectDir: '.' }));
    expect(result.content[0].text).toBe(JSON.stringify(mockResponse.data));
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'API Error';
    vi.mocked(axios.post).mockRejectedValueOnce({ message: errorMessage });

    // @ts-expect-error - accessing private/protected property for verification
    const runPromptTool = server._registeredTools['run_prompt'];

    const result = await runPromptTool.handler({ prompt: 'hello', mode: 'ask' });

    expect(result.content[0].text).toBe(errorMessage);
  });
});
