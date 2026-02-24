/**
 * Tests for Tool Registration via getTools()
 * Verifies tool validation, collection, and registry methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';

import type { Extension, ExtensionMetadata, ToolDefinition } from '@common/extensions';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../extension-loader', () => ({
  ExtensionLoader: class {
    loadExtension = vi.fn();
  },
}));

vi.mock('../extension-validator', () => ({
  ExtensionValidator: class {
    validateExtension = vi.fn().mockResolvedValue({ isValid: true, errors: [] });
  },
}));

vi.mock('../extension-watcher', () => ({
  ExtensionWatcher: vi.fn(),
}));

const createMockExtension = (overrides: Partial<Extension> = {}): Extension => ({
  onLoad: vi.fn(),
  onUnload: vi.fn(),
  ...overrides,
});

const createMockMetadata = (overrides: Partial<ExtensionMetadata> = {}): ExtensionMetadata => ({
  name: 'test-extension',
  version: '1.0.0',
  description: 'Test extension',
  author: 'Test Author',
  ...overrides,
});

const createMockDeps = () => ({
  store: {} as any,
  agentProfileManager: {
    getAllProfiles: vi.fn().mockReturnValue([]),
  } as any,
  modelManager: {
    getAllModels: vi.fn().mockResolvedValue([]),
  } as any,
  projectManager: {
    getProjects: vi.fn().mockReturnValue([]),
  } as any,
});

const createValidTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'valid-tool',
  description: 'A valid tool for testing',
  inputSchema: z.object({
    input: z.string(),
  }),
  async execute(args, _signal, _context) {
    return { content: [{ type: 'text', text: args.input }] };
  },
  ...overrides,
});

describe('Tool Registration', () => {
  let manager: ExtensionManager;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = createMockDeps();
    manager = new ExtensionManager(mockDeps.store, mockDeps.agentProfileManager, mockDeps.modelManager, mockDeps.projectManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolDefinition', () => {
    it('should validate kebab-case tool name', () => {
      const validNames = ['run-linter', 'my-custom-tool', 'generate-report', 'a', 'tool123', 'my-tool-v2'];

      for (const name of validNames) {
        const tool = createValidTool({ name });
        const result = manager.validateToolDefinition(tool);
        expect(result.isValid, `Expected '${name}' to be valid`).toBe(true);
      }
    });

    it('should reject non-kebab-case tool names', () => {
      const invalidNames = ['RunLinter', 'run_linter', 'runLinter', '1-tool', '-tool', 'tool-', 'my--tool', ''];

      for (const name of invalidNames) {
        const tool = createValidTool({ name });
        const result = manager.validateToolDefinition(tool);
        expect(result.isValid, `Expected '${name}' to be invalid`).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate non-empty description', () => {
      const validTool = createValidTool({ description: 'A valid description' });
      const result = manager.validateToolDefinition(validTool);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty description', () => {
      const tool = createValidTool({ description: '' });
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('description'))).toBe(true);
    });

    it('should reject whitespace-only description', () => {
      const tool = createValidTool({ description: '   ' });
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('description'))).toBe(true);
    });

    it('should validate Zod schema parameters', () => {
      const tool = createValidTool({
        inputSchema: z.object({
          input: z.string(),
          count: z.number().optional(),
        }),
      });
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(true);
    });

    it('should reject non-Zod schema inputSchema', () => {
      const tool = {
        ...createValidTool(),
        inputSchema: { type: 'object' },
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Zod schema'))).toBe(true);
    });

    it('should reject null inputSchema', () => {
      const tool = {
        ...createValidTool(),
        inputSchema: null,
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Zod schema'))).toBe(true);
    });

    it('should validate execute function', () => {
      const tool = createValidTool({
        async execute(args, _signal, _context) {
          return { content: [{ type: 'text', text: args.input }] };
        },
      });
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(true);
    });

    it('should reject non-function execute', () => {
      const tool = {
        ...createValidTool(),
        execute: 'not-a-function',
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('function'))).toBe(true);
    });

    it('should reject missing execute', () => {
      const tool = {
        ...createValidTool(),
        execute: undefined,
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('function'))).toBe(true);
    });

    it('should return all validation errors at once', () => {
      const tool = {
        name: 'InvalidName',
        description: '',
        parameters: null,
        execute: 'not-a-function',
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(4);
    });

    it('should wrap validation in try-catch for error isolation', () => {
      const tool = {
        get name() {
          throw new Error('Name getter error');
        },
        description: 'Test',
        inputSchema: z.object({}),
        execute: vi.fn(),
      } as unknown as ToolDefinition;
      const result = manager.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Validation error'))).toBe(true);
    });
  });

  describe('collectTools', () => {
    it('should return empty array for extension without getTools', () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toEqual([]);
    });

    it('should return empty array for extension returning empty', () => {
      const extension = createMockExtension({
        getTools: () => [],
      });
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toEqual([]);
    });

    it('should collect valid tools from extension', () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const tool2 = createValidTool({ name: 'tool-two' });
      const extension = createMockExtension({
        getTools: () => [tool1, tool2],
      });
      const metadata = createMockMetadata({ name: 'my-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].extensionName).toBe('my-extension');
      expect(tools[0].tool.name).toBe('tool-one');
      expect(tools[1].extensionName).toBe('my-extension');
      expect(tools[1].tool.name).toBe('tool-two');
    });

    it('should log errors for invalid tools but continue', async () => {
      const logger = await import('@/logger');
      const validTool = createValidTool({ name: 'valid-tool' });
      const invalidTool = {
        name: 'InvalidToolName',
        description: 'Test',
        inputSchema: z.object({}),
        execute: vi.fn(),
      } as unknown as ToolDefinition;
      const extension = createMockExtension({
        getTools: () => [invalidTool, validTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].tool.name).toBe('valid-tool');
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining("Invalid tool 'InvalidToolName'"));
    });

    it('should handle extension getTools throwing error', async () => {
      const logger = await import('@/logger');
      const extension = createMockExtension({
        getTools: () => {
          throw new Error('getTools error');
        },
      });
      const metadata = createMockMetadata({ name: 'error-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toEqual([]);
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to collect tools'), expect.any(Error));
    });

    it('should handle extension getTools returning non-array', async () => {
      const logger = await import('@/logger');
      const extension = createMockExtension({
        getTools: (() => 'not-an-array') as unknown as () => ToolDefinition[],
      });
      const metadata = createMockMetadata({ name: 'bad-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.collectTools();

      expect(tools).toEqual([]);
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining('did not return an array'));
    });

    it('should allow dynamic tool registration based on runtime conditions', () => {
      let shouldRegisterTools = true;
      const tool1 = createValidTool({ name: 'dynamic-tool' });
      const extension = createMockExtension({
        getTools: () => (shouldRegisterTools ? [tool1] : []),
      });
      const metadata = createMockMetadata({ name: 'dynamic-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');

      registry.clearTools();
      shouldRegisterTools = true;
      let tools = manager.collectTools();
      expect(tools).toHaveLength(1);

      registry.clearTools();
      shouldRegisterTools = false;
      tools = manager.collectTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('ExtensionRegistry tool methods', () => {
    let registry: ExtensionRegistry;

    beforeEach(() => {
      registry = new ExtensionRegistry();
    });

    it('should register and retrieve tools', () => {
      const tool = createValidTool({ name: 'test-tool' });
      registry.registerTool('my-extension', tool);
      const tools = registry.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].extensionName).toBe('my-extension');
      expect(tools[0].tool.name).toBe('test-tool');
    });

    it('should filter tools by extension name', () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const tool2 = createValidTool({ name: 'tool-two' });
      const tool3 = createValidTool({ name: 'tool-three' });

      registry.registerTool('extension-a', tool1);
      registry.registerTool('extension-b', tool2);
      registry.registerTool('extension-a', tool3);

      const toolsA = registry.getToolsByExtension('extension-a');
      expect(toolsA).toHaveLength(2);
      expect(toolsA.map((t) => t.tool.name)).toEqual(['tool-one', 'tool-three']);

      const toolsB = registry.getToolsByExtension('extension-b');
      expect(toolsB).toHaveLength(1);
      expect(toolsB[0].tool.name).toBe('tool-two');
    });

    it('should return empty array for non-existent extension', () => {
      const tools = registry.getToolsByExtension('non-existent');
      expect(tools).toEqual([]);
    });

    it('should clear all tools', () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const tool2 = createValidTool({ name: 'tool-two' });

      registry.registerTool('extension-a', tool1);
      registry.registerTool('extension-b', tool2);
      expect(registry.getTools()).toHaveLength(2);

      registry.clearTools();
      expect(registry.getTools()).toHaveLength(0);
    });

    it('should clear tools when extension is unregistered', () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const extension = createMockExtension();
      const metadata = createMockMetadata({ name: 'extension-a' });

      registry.register(extension, metadata, '/test/extension.ts');
      registry.registerTool('extension-a', tool1);
      expect(registry.getTools()).toHaveLength(1);

      registry.unregister('extension-a');
      expect(registry.getTools()).toHaveLength(0);
    });

    it('should allow multiple tools with same name from different extensions', () => {
      const tool1 = createValidTool({ name: 'shared-tool' });
      const tool2 = createValidTool({ name: 'shared-tool' });

      registry.registerTool('extension-a', tool1);
      registry.registerTool('extension-b', tool2);

      const tools = registry.getTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].extensionName).toBe('extension-a');
      expect(tools[1].extensionName).toBe('extension-b');
    });
  });

  describe('ExtensionManager getTools methods', () => {
    it('should get all tools via getTools()', () => {
      const tool = createValidTool({ name: 'test-tool' });
      const extension = createMockExtension({
        getTools: () => [tool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extension, metadata, '/test/extension.ts');
      manager.collectTools();

      const tools = manager.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].tool.name).toBe('test-tool');
    });

    it('should get tools by extension via getToolsByExtension()', () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const tool2 = createValidTool({ name: 'tool-two' });
      const extensionA = createMockExtension({
        getTools: () => [tool1],
      });
      const extensionB = createMockExtension({
        getTools: () => [tool2],
      });
      const metadataA = createMockMetadata({ name: 'extension-a' });
      const metadataB = createMockMetadata({ name: 'extension-b' });
      const registry = (manager as any).registry as ExtensionRegistry;

      registry.register(extensionA, metadataA, '/test/extension-a.ts');
      registry.register(extensionB, metadataB, '/test/extension-b.ts');
      manager.collectTools();

      const toolsA = manager.getToolsByExtension('extension-a');
      expect(toolsA).toHaveLength(1);
      expect(toolsA[0].tool.name).toBe('tool-one');

      const toolsB = manager.getToolsByExtension('extension-b');
      expect(toolsB).toHaveLength(1);
      expect(toolsB[0].tool.name).toBe('tool-two');
    });
  });
});
