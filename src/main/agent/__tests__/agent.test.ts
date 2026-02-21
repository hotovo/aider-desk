/**
 * Tests for Agent class - specifically getContextFilesAsToolCallMessages method
 */

// Mock dependencies
vi.mock('@/logger');
vi.mock('istextorbinary', () => ({
  isBinary: vi.fn(),
}));
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));
vi.mock('fs/promises');
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

// Type declarations for mocked modules without type declarations
declare global {
  // file-type has types but we mock it
  const fileTypeFromBuffer: (buffer: Buffer) => Promise<{ ext: string; mime: string } | undefined>;
}

// Import dependencies
import * as fs from 'fs/promises';
import path from 'path';

// @ts-expect-error istextorbinary is not typed properly
import { isBinary } from 'istextorbinary';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolApprovalState } from '@common/types';
import { POWER_TOOL_FILE_READ, POWER_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuidv4 } from 'uuid';

import type { ContextFile } from '@common/types';

// Re-export types that are needed
import { AIDER_DESK_PROJECT_RULES_DIR } from '@/constants';
import { createMockAgentProfile, createMockTask } from '@/__tests__/mocks';

// We need to import Agent after mocks are set up
const AgentModule = await import('../agent');
const { Agent: AgentClass } = AgentModule;

// Add Agent type since we're using it
type Agent = InstanceType<typeof AgentClass>;

const fileReadToolId = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`;

describe('Agent - getContextFilesAsToolCallMessages', () => {
  let agent: Agent;
  let mockTask: ReturnType<typeof createMockTask>;
  let mockProfile: ReturnType<typeof createMockAgentProfile>;
  let mockFsReadFile: ReturnType<typeof vi.mocked<typeof fs.readFile>>;
  let mockIsBinary: ReturnType<typeof vi.mocked<typeof isBinary>>;
  let mockFileTypeFromBuffer: ReturnType<typeof vi.mocked<typeof fileTypeFromBuffer>>;
  let mockUuidv4: ReturnType<typeof vi.mocked<typeof uuidv4>>;

  // Store original implementation
  let originalGetContextFilesMessages: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup basic mocks
    mockFsReadFile = vi.mocked(fs.readFile);
    mockIsBinary = vi.mocked(isBinary);
    mockFileTypeFromBuffer = vi.mocked(fileTypeFromBuffer);
    mockUuidv4 = vi.mocked(uuidv4);

    mockTask = createMockTask();
    mockProfile = createMockAgentProfile({
      useAiderTools: true,
    });

    // Setup uuid to return predictable IDs
    let uuidCounter = 1;
    mockUuidv4.mockImplementation(() => `uuid-${uuidCounter++}` as any);

    // Default mocks for file operations
    (mockIsBinary as any).mockReturnValue(false);
    mockFileTypeFromBuffer.mockResolvedValue(undefined);
    mockFsReadFile.mockResolvedValue(Buffer.from('file content') as any);

    // Create minimal mocks for Agent constructor dependencies
    const mockStore = {
      getSettings: vi.fn(() => ({})),
    };
    const mockAgentProfileManager = {};
    const mockMcpManager = {
      getConnectors: vi.fn(() => []),
    };
    const mockModelManager = {
      createLlm: vi.fn(),
      getProviderOptions: vi.fn(() => ({})),
      getProviderParameters: vi.fn(() => ({})),
      getCacheControl: vi.fn(() => ({})),
      getModelSettings: vi.fn(() => undefined),
      getProviderTools: vi.fn(() => Promise.resolve({})),
      isStreamingDisabled: vi.fn(() => false),
    };
    const mockTelemetryManager = {
      captureAgentRun: vi.fn(),
    };
    const mockMemoryManager = {};
    const mockPromptsManager = {};
    const mockExtensionManager = {
      isInitialized: vi.fn(() => false),
      createExtensionToolset: vi.fn(() => ({})),
    };

    agent = new AgentClass(
      mockStore as any,
      mockAgentProfileManager as any,
      mockMcpManager as any,
      mockModelManager as any,
      mockTelemetryManager as any,
      mockMemoryManager as any,
      mockPromptsManager as any,
      mockExtensionManager as any,
    );

    // Spy on the private method for testing
    // Note: This is accessing a private method, which is acceptable for unit testing
    // Store original implementation for fallback mode tests
    originalGetContextFilesMessages = agent['getContextFilesMessages'];
    agent['getContextFilesMessages'] = vi.fn();
  });

  afterEach(() => {
    // Restore original method
    if (originalGetContextFilesMessages) {
      agent['getContextFilesMessages'] = originalGetContextFilesMessages;
    }
  });

  describe('Mode Selection', () => {
    it('should call getContextFilesMessages (fallback) when power:file_read approval is Never', async () => {
      // Setup profile with Never approval for file_read
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Never,
      };

      // Restore original method to verify it gets called
      agent['getContextFilesMessages'] = originalGetContextFilesMessages;
      const getContextFilesMessagesSpy = vi.spyOn(agent as any, 'getContextFilesMessages');

      const contextFiles: ContextFile[] = [{ path: 'test.txt', readOnly: true }];

      await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(getContextFilesMessagesSpy).toHaveBeenCalledWith(mockTask, mockProfile, contextFiles);
    });

    it('should use tool call mode when power:file_read approval is not Never (Always)', async () => {
      // Setup profile with Always approval for file_read
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [{ path: 'test.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('test content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Each file gets its own assistant message (with text and tool-call) followed by a tool message
      expect(result).toHaveLength(2); // assistant message + tool result message
      expect(result[0].role).toBe('assistant');
      expect(Array.isArray(result[0].content)).toBe(true);
      expect((result[0].content as any)[0].type).toBe('text');
      expect((result[0].content as any)[1].type).toBe('tool-call');
      expect(result[1].role).toBe('tool');
      expect(Array.isArray(result[1].content)).toBe(true);
      expect((result[1].content as any)[0].type).toBe('tool-result');
    });

    it('should use tool call mode when power:file_read approval is not Never (Ask)', async () => {
      // Setup profile with Ask approval for file_read
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Ask,
      };

      const contextFiles: ContextFile[] = [{ path: 'test.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('test content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('assistant');
      expect(Array.isArray(result[0].content)).toBe(true);
      expect((result[0].content as any)[1].type).toBe('tool-call');
      expect(result[1].role).toBe('tool');
      expect((result[1].content as any)[0].type).toBe('tool-result');
    });

    it('should use tool call mode when file_read tool approval is undefined', async () => {
      // Setup profile with no approval set for file_read (undefined)
      mockProfile.toolApprovals = {};

      const contextFiles: ContextFile[] = [{ path: 'test.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('test content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('assistant');
    });
  });

  describe('Tool Call Mode - Read-Only Files', () => {
    it('should generate assistant message with tool calls for read-only files', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [
        { path: 'readonly1.txt', readOnly: true },
        { path: 'readonly2.txt', readOnly: true },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content 1')).mockResolvedValueOnce(Buffer.from('content 2'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Each file gets its own assistant+tool result pair: 2 files * 2 messages = 4 messages
      expect(result.length).toBe(4);

      // Find assistant messages
      const assistantMessages = result.filter((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');
      expect(assistantMessages).toHaveLength(2);

      // Verify the description mentions read-only for each
      for (const assistantMessage of assistantMessages) {
        const textContent = (assistantMessage.content as any)[0].text;
        expect(textContent).toContain('read-only');
        expect(textContent).toContain('reference material');
      }
    });

    it('should generate corresponding tool messages with tool results containing file content', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [{ path: 'readonly.txt', readOnly: true }];

      const expectedContent = 'test file content';
      // Implementation calls fs.readFile twice: once for binary detection, once in readFileContent
      mockFsReadFile.mockReset().mockResolvedValueOnce(Buffer.from(expectedContent)).mockResolvedValueOnce(Buffer.from(expectedContent));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have 2 messages: assistant + tool result
      expect(result).toHaveLength(2);

      // Find tool result message
      const toolResultMessage = result.find((msg: any) => msg.role === 'tool');
      expect(toolResultMessage).toBeDefined();

      // Verify tool result contains the file content
      if (!toolResultMessage) {
        return;
      }
      const toolResultPart = (toolResultMessage.content as any)[0];
      expect(toolResultPart.type).toBe('tool-result');
      expect(toolResultPart.toolName).toBe(fileReadToolId);
      expect(toolResultPart.output.type).toBe('text');
      // Content should have line numbers added by readFileContent(withLines: true)
      expect(toolResultPart.output.value).toContain('1|test file content');
    });

    it('should use appropriate description when useAiderTools is false', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
      mockProfile.useAiderTools = false;

      const contextFiles: ContextFile[] = [{ path: 'readonly.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content));
      expect(assistantMessage).toBeDefined();
      if (!assistantMessage) {
        return;
      }
      const textContent = (assistantMessage.content as any)[0].text;

      // Should mention read-only but not Aider
      expect(textContent).toContain('read-only');
      expect(textContent).not.toContain('Aider context');
    });
  });

  describe('Tool Call Mode - Editable Files', () => {
    it('should generate assistant message with tool calls for editable files', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [
        { path: 'editable1.ts', readOnly: false },
        { path: 'editable2.ts', readOnly: false },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('code 1')).mockResolvedValueOnce(Buffer.from('code 2'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Each file gets its own assistant+tool result pair: 2 files * 2 messages = 4 messages
      expect(result.length).toBe(4);

      // Find assistant messages
      const assistantMessages = result.filter((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');
      expect(assistantMessages).toHaveLength(2);

      // Verify the description mentions editable
      for (const assistantMessage of assistantMessages) {
        const textContent = (assistantMessage.content as any)[0].text;
        expect(textContent).toContain('can be edited');
      }
    });

    it('should generate corresponding tool messages with tool results for editable files', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [{ path: 'editable.ts', readOnly: false }];

      const expectedContent = 'export const test = 42;';
      // Implementation calls fs.readFile twice: once for binary detection, once in readFileContent
      mockFsReadFile.mockReset().mockResolvedValueOnce(Buffer.from(expectedContent)).mockResolvedValueOnce(Buffer.from(expectedContent));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have 2 messages: assistant + tool result
      expect(result).toHaveLength(2);

      // Find tool result message
      const toolResultMessage = result.find((msg: any) => msg.role === 'tool');
      expect(toolResultMessage).toBeDefined();

      // Verify tool result contains the file content
      if (!toolResultMessage) {
        return;
      }
      const toolResultPart = (toolResultMessage.content as any)[0];
      expect(toolResultPart.type).toBe('tool-result');
      expect(toolResultPart.output.type).toBe('text');
      // Content should have line numbers added by readFileContent(withLines: true)
      expect(toolResultPart.output.value).toContain('1|export const test = 42;');
    });

    it('should use appropriate description when useAiderTools is false for editable files', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
      mockProfile.useAiderTools = false;

      const contextFiles: ContextFile[] = [{ path: 'editable.ts', readOnly: false }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content));
      expect(assistantMessage).toBeDefined();
      if (!assistantMessage) {
        return;
      }
      const textContent = (assistantMessage.content as any)[0].text;

      // Should mention editable but not Aider
      expect(textContent).toContain('can be edited');
      expect(textContent).not.toContain('Aider context');
    });
  });

  describe('Tool Call Mode - Mixed Files', () => {
    it('should maintain correct ordering: read-only files first, then editable files', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [
        { path: 'editable.ts', readOnly: false },
        { path: 'readonly.txt', readOnly: true },
        { path: 'editable2.ts', readOnly: false },
      ];

      mockFsReadFile
        .mockResolvedValueOnce(Buffer.from('readonly'))
        .mockResolvedValueOnce(Buffer.from('editable 1'))
        .mockResolvedValueOnce(Buffer.from('editable 2'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Each file gets its own assistant+tool result pair: 3 files * 2 messages = 6 messages
      expect(result.length).toBe(6);

      // Find all assistant messages with text content
      const assistantMessages = result.filter((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');

      expect(assistantMessages.length).toBe(3);

      // First assistant message should be about read-only files
      const firstAssistantText = (assistantMessages[0].content as any)[0].text;
      expect(firstAssistantText).toContain('read-only');

      // Second and third assistant messages should be about editable files
      const secondAssistantText = (assistantMessages[1].content as any)[0].text;
      expect(secondAssistantText).toContain('can be edited');
      const thirdAssistantText = (assistantMessages[2].content as any)[0].text;
      expect(thirdAssistantText).toContain('can be edited');
    });

    it('should generate separate tool calls and results for each file group', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [
        { path: 'readonly.txt', readOnly: true },
        { path: 'editable.ts', readOnly: false },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('readonly content')).mockResolvedValueOnce(Buffer.from('editable content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // 2 files = 4 messages (2 assistant + 2 tool results)
      expect(result.length).toBe(4);

      // Count tool result messages (should be 2, one for each file)
      const toolResultMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolResultMessages.length).toBe(2);

      // Verify each has unique tool call ID
      const toolCallIds = toolResultMessages.map((msg: any) => (msg.content as any)[0].toolCallId);
      expect(toolCallIds[0]).not.toBe(toolCallIds[1]);
    });

    it('should use different descriptions for read-only and editable sections', async () => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };

      const contextFiles: ContextFile[] = [
        { path: 'readonly.txt', readOnly: true },
        { path: 'editable.ts', readOnly: false },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('readonly')).mockResolvedValueOnce(Buffer.from('editable'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const assistantMessages = result.filter((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');

      const descriptions = assistantMessages.map((msg: any) => (msg.content as any)[0].text);

      // Should have two different descriptions
      expect(descriptions.some((desc: string) => desc.includes('read-only'))).toBe(true);
      expect(descriptions.some((desc: string) => desc.includes('can be edited'))).toBe(true);
    });
  });

  describe('Image Handling', () => {
    beforeEach(() => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
    });

    it('should detect image files using isBinary and fileTypeFromBuffer', async () => {
      const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });

      const contextFiles: ContextFile[] = [{ path: 'image.png', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(imageBuffer);

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(mockIsBinary).toHaveBeenCalled();
      expect(mockFileTypeFromBuffer).toHaveBeenCalledWith(imageBuffer);

      // Should have image-related messages: assistant + user with image
      const assistantMessage = result.find(
        (msg: any) => msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes('Provide content of image file'),
      );
      expect(assistantMessage).toBeDefined();

      const imageUserMessage = result.find((msg: any) => msg.role === 'user' && Array.isArray(msg.content) && (msg.content as any)[0]?.type === 'image');
      expect(imageUserMessage).toBeDefined();
    });

    it('should return error in tool result for image files', async () => {
      const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });

      const contextFiles: ContextFile[] = [{ path: 'image.png', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(imageBuffer);

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Images don't generate tool-result messages anymore - they use assistant + user message pattern
      const toolResultMessage = result.find((msg: any) => msg.role === 'tool');
      expect(toolResultMessage).toBeUndefined();

      // Should have assistant message
      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && typeof msg.content === 'string');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toContain('Provide content of image file');

      // And user message with image
      const imageUserMessage = result.find((msg: any) => msg.role === 'user' && Array.isArray(msg.content) && (msg.content as any)[0]?.type === 'image');
      expect(imageUserMessage).toBeDefined();
    });

    it('should create separate user and assistant messages for image part', async () => {
      const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });

      const contextFiles: ContextFile[] = [{ path: 'image.png', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(imageBuffer);

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Find user message with image
      const imageUserMessage = result.filter((msg: any) => msg.role === 'user' && Array.isArray(msg.content) && msg.content[0]?.type === 'image');
      expect(imageUserMessage.length).toBe(1);
      expect((imageUserMessage[0].content as any)[0].image).toContain('data:image/png;base64,');

      // Find assistant message before the user message with image
      const imageAssistantMessage = result.find(
        (msg: any) => msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes('Provide content of image file'),
      );
      expect(imageAssistantMessage).toBeDefined();
    });

    it('should skip non-image binary files', async () => {
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'application/octet-stream', ext: 'bin' });

      const contextFiles: ContextFile[] = [{ path: 'binary.bin', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(binaryBuffer);

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have no messages since binary file was skipped
      expect(result.length).toBe(0);
    });

    it('should handle fileTypeFromBuffer errors gracefully', async () => {
      const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockRejectedValue(new Error('Detection failed'));

      const contextFiles: ContextFile[] = [{ path: 'unknown.bin', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(binaryBuffer);

      // Should not throw, just skip the file
      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(result.length).toBe(0);
    });
  });

  describe('File Content Reading', () => {
    beforeEach(() => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
    });

    it('should read file content correctly using fs.readFile', async () => {
      const expectedContent = 'Hello, World!';
      const contextFiles: ContextFile[] = [{ path: 'test.txt', readOnly: true }];

      // Implementation calls fs.readFile twice: once for binary detection, once in readFileContent
      mockFsReadFile.mockReset().mockResolvedValueOnce(Buffer.from(expectedContent)).mockResolvedValueOnce(Buffer.from(expectedContent));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(mockFsReadFile).toHaveBeenCalled();

      // Verify content is in the tool result with line numbers
      const toolResultMessage = result.find((msg: any) => msg.role === 'tool');
      expect(toolResultMessage).toBeDefined();
      if (!toolResultMessage) {
        return;
      }
      // Content should have line numbers added by readFileContent(withLines: true)
      expect((toolResultMessage.content as any)[0].output.value).toContain('1|Hello, World!');
    });

    it('should convert absolute paths to relative paths', async () => {
      const contextFiles: ContextFile[] = [{ path: '/test/project/file.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Find the assistant message with tool calls
      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');

      // Find the tool-call part
      if (!assistantMessage) {
        return;
      }
      const toolCall = (assistantMessage.content as any).find((part: any) => part.type === 'tool-call');
      expect(toolCall).toBeDefined();

      // Verify the input uses relative path (from /test/project/file.txt to file.txt)
      expect(toolCall.input.filePath).toBe('file.txt');
    });

    it('should keep relative paths as-is', async () => {
      const contextFiles: ContextFile[] = [{ path: 'relative/path/file.txt', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content) && (msg.content as any)[0].type === 'text');
      expect(assistantMessage).toBeDefined();
      if (!assistantMessage) {
        return;
      }
      const toolCall = (assistantMessage.content as any).find((part: any) => part.type === 'tool-call');

      expect(toolCall.input.filePath).toBe('relative/path/file.txt');
    });

    it('should skip binary files that are not images', async () => {
      mockIsBinary.mockReturnValue(true);
      mockFileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });

      const contextFiles: ContextFile[] = [{ path: 'document.pdf', readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('pdf content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have no messages since binary file was skipped
      expect(result.length).toBe(0);
    });

    it('should handle fs.readFile errors gracefully', async () => {
      mockFsReadFile.mockRejectedValueOnce(new Error('File not found'));

      const contextFiles: ContextFile[] = [{ path: 'missing.txt', readOnly: true }];

      // Should not throw, just skip the file
      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Since file read failed, no tool messages should be created
      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(0);
    });
  });

  describe('Rule Files Filtering', () => {
    beforeEach(() => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
    });

    it('should filter out files in AIDER_DESK_PROJECT_RULES_DIR', async () => {
      const ruleFilePath = path.join(AIDER_DESK_PROJECT_RULES_DIR, 'rule1.md');
      const contextFiles: ContextFile[] = [
        { path: ruleFilePath, readOnly: true },
        { path: 'regular-file.txt', readOnly: true },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('regular content')).mockResolvedValueOnce(Buffer.from('rule content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should only have tool messages for the regular file, not the rule file
      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(1);

      // Verify the tool call is for the regular file
      const assistantMessage = result.find((msg: any) => msg.role === 'assistant' && Array.isArray(msg.content));
      if (!assistantMessage) {
        return;
      }
      const toolCall = (assistantMessage.content as any).find((part: any) => part.type === 'tool-call');
      // toolCall.input is an object, not a JSON string
      const input = toolCall.input;
      expect(input.filePath).not.toContain('rule1.md');
    });

    it('should filter out files with AIDER_DESK_PROJECT_RULES_DIR as exact path', async () => {
      const contextFiles: ContextFile[] = [{ path: AIDER_DESK_PROJECT_RULES_DIR, readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have no tool messages since the file was filtered out
      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(0);
    });

    it('should handle rule files with different path separators', async () => {
      // Test with forward slash (Unix-style)
      const rulePathUnix = `${AIDER_DESK_PROJECT_RULES_DIR}/rule.md`;
      const contextFiles: ContextFile[] = [
        { path: rulePathUnix, readOnly: true },
        { path: 'normal.txt', readOnly: true },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('normal content')).mockResolvedValueOnce(Buffer.from('rule content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(1);
    });

    it('should not filter files outside AIDER_DESK_PROJECT_RULES_DIR', async () => {
      const similarPath = path.join(AIDER_DESK_PROJECT_RULES_DIR + '-backup', 'file.md');
      const contextFiles: ContextFile[] = [{ path: similarPath, readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should have tool message for the file
      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(1);
    });

    it('should normalize paths when filtering', async () => {
      // Path with '..' segments that resolves to the rules directory
      // Create a path like .aider-desk/rules/../aider-desk/rules/rule.md which normalizes to .aider-desk/rules/rule.md
      const rulePath = `${AIDER_DESK_PROJECT_RULES_DIR}${path.sep}..${path.sep}${path.basename(AIDER_DESK_PROJECT_RULES_DIR)}${path.sep}rule.md`;
      const contextFiles: ContextFile[] = [{ path: rulePath, readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // After normalization, this should be filtered out since it's in the rules directory
      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      expect(toolMessages.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockProfile.toolApprovals = {
        [fileReadToolId]: ToolApprovalState.Always,
      };
    });

    it('should return empty messages array when contextFiles is empty', async () => {
      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, []);

      expect(result).toEqual([]);
    });

    it('should return empty messages array when all files are filtered out', async () => {
      const contextFiles: ContextFile[] = [{ path: path.join(AIDER_DESK_PROJECT_RULES_DIR, 'rule.md'), readOnly: true }];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      expect(result).toEqual([]);
    });

    it('should return empty messages array when all file reads fail', async () => {
      const contextFiles: ContextFile[] = [
        { path: 'file1.txt', readOnly: true },
        { path: 'file2.txt', readOnly: true },
      ];

      // Reset any previous mock and set to reject
      mockFsReadFile.mockReset();
      mockFsReadFile.mockRejectedValue(new Error('Read error'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      // Should be empty since all reads failed (fileDataMap.size === 0)
      expect(result).toEqual([]);
    });

    it('should generate unique tool call IDs using uuid', async () => {
      const contextFiles: ContextFile[] = [
        { path: 'file1.txt', readOnly: true },
        { path: 'file2.txt', readOnly: false },
      ];

      mockFsReadFile.mockResolvedValueOnce(Buffer.from('content 1')).mockResolvedValueOnce(Buffer.from('content 2'));

      const result = await agent['getContextFilesAsToolCallMessages'](mockTask, mockProfile, contextFiles);

      const toolMessages = result.filter((msg: any) => msg.role === 'tool');
      const toolCallIds = toolMessages.map((msg: any) => msg.content[0].toolCallId);

      // Verify unique IDs were generated
      expect(new Set(toolCallIds).size).toBe(toolCallIds.length);
      expect(mockUuidv4).toHaveBeenCalled();
    });
  });
});
