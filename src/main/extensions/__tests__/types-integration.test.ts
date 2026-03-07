/**
 * Type integration test for main process
 * Verifies that extension types work correctly in the main (Node.js) process
 */

import { describe, it, expect } from 'vitest';
import { ToolApprovalEvent } from '@common/extensions';
import { z } from 'zod';

import type { Extension, ExtensionContext, ExtensionMetadata, ToolDefinition, TaskCreatedEvent, PromptStartedEvent } from '@common/extensions';

// Test ExtensionMetadata type
const metadata: ExtensionMetadata = {
  name: 'Test Extension',
  version: '1.0.0',
  description: 'A test extension',
  author: 'Test Author',
  capabilities: ['tools'],
};

// Test ToolDefinition type with Zod
const testTool: ToolDefinition = {
  name: 'test-tool',
  description: 'A test tool for type checking',
  inputSchema: z.object({
    input: z.string().describe('Input text'),
    count: z.number().optional().describe('Repeat count'),
  }),
  async execute(args, _signal, context) {
    // args.input should be typed as string
    // args.count should be typed as number | undefined
    // context should have all ExtensionContext methods
    const taskContext = context.getTaskContext();
    context.log(`Executing with input: ${args.input}`, 'info');

    return {
      content: [{ type: 'text', text: `${args.input} (task: ${taskContext?.data.name ?? 'none'})` }],
    };
  },
};

// Test Extension interface
const testExtension: Extension = {
  async onLoad(context: ExtensionContext) {
    // context should have all methods
    const taskContext = context.getTaskContext();
    const projectDir = context.getProjectDir();
    void context.getSetting('theme');
    await context.updateSettings({ theme: 'dark' });

    context.log(`Extension loaded in ${projectDir}`, 'info');
    context.log(`Current task: ${taskContext?.data.name ?? 'none'}`, 'debug');
  },

  async onUnload() {
    // Cleanup
  },

  getTools() {
    return [testTool];
  },

  async onTaskCreated(event: TaskCreatedEvent, context: ExtensionContext) {
    context.log(`Task created: ${event.task.name}`, 'info');
    // Can return void
  },

  async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext) {
    context.log(`Prompt started: ${event.prompt}`, 'debug');
    // Can return partial event to modify
    return { prompt: event.prompt.toUpperCase() };
  },

  async onToolApproval(event: ToolApprovalEvent, context: ExtensionContext) {
    context.log(`Tool approval: ${event.toolName}`, 'debug');
    // Can block tool execution
    if (event.toolName === 'dangerous-tool') {
      return { blocked: true };
    }
    return undefined;
  },
};

// Test ExtensionConstructor type
const TestExtensionConstructor: new () => Extension = class {
  static metadata: ExtensionMetadata = metadata;

  async onLoad(context: ExtensionContext) {
    context.log('Loaded', 'info');
  }

  getTools(_context: ExtensionContext) {
    return [testTool];
  }
} as unknown as new () => Extension;

// Type guard tests - these should compile without errors
const isExtension = function (obj: unknown): obj is Extension {
  return typeof obj === 'object' && obj !== null && 'onLoad' in obj;
};

const isToolDefinition = function (obj: unknown): obj is ToolDefinition {
  return typeof obj === 'object' && obj !== null && 'name' in obj && 'execute' in obj;
};

// Export for use in other tests
export { testExtension, testTool, metadata, isExtension, isToolDefinition, TestExtensionConstructor };

describe('Extension Types Integration (Main Process)', () => {
  it('should have correct ExtensionMetadata type', () => {
    expect(metadata.name).toBe('Test Extension');
    expect(metadata.version).toBe('1.0.0');
    expect(metadata.capabilities).toContain('tools');
  });

  it('should have correct ToolDefinition type', () => {
    expect(testTool.name).toBe('test-tool');
    expect(testTool.description).toBe('A test tool for type checking');
    expect(testTool.inputSchema).toBeDefined();
    expect(typeof testTool.execute).toBe('function');
  });

  it('should have correct Extension interface implementation', () => {
    expect(typeof testExtension.onLoad).toBe('function');
    expect(typeof testExtension.getTools).toBe('function');
  });

  it('should have correct type guards', () => {
    expect(isExtension(testExtension)).toBe(true);
    expect(isExtension({})).toBe(false);
    expect(isToolDefinition(testTool)).toBe(true);
    expect(isToolDefinition({})).toBe(false);
  });
});
