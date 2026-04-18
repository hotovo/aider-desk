/**
 * Tests for Tool Registration via getTools()
 * Verifies tool validation and dynamic collection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';

import type { Extension, ExtensionMetadata, ToolDefinition } from '@common/extensions';
import type { AgentProfile } from '@common/types';
import type { Task } from '@/task';
import type { Project } from '@/project';

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
  store: {
    getSettings: vi.fn().mockReturnValue({
      extensions: {
        disabled: [],
      },
    }),
  } as any,
  modelManager: {
    getAllModels: vi.fn().mockResolvedValue([]),
  } as any,
  eventManager: {
    sendSettingsUpdated: vi.fn(),
  } as any,
  telemetryManager: {} as any,
  memoryManager: {} as any,
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

const createMockTask = (projectBaseDir = '/project/dir'): Task => {
  const project = {
    baseDir: projectBaseDir,
  } as Project;

  return {
    project,
    getProjectDir: () => projectBaseDir,
  } as Task;
};

const createMockAgentProfile = (): AgentProfile =>
  ({
    id: 'test-profile',
    name: 'Test Profile',
  }) as AgentProfile;

describe('Tool Registration', () => {
  let manager: ExtensionManager;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = createMockDeps();
    manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager, mockDeps.telemetryManager, mockDeps.memoryManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToolDefinition', () => {
    it('should validate tool name format', () => {
      const validNames = ['run-linter', 'my-custom-tool', 'generate-report', 'a', 'tool123', 'my-tool-v2', 'tool_name', 'my---tool', 'tool-'];

      for (const name of validNames) {
        const tool = createValidTool({ name });
        const result = manager.validateToolDefinition(tool);
        expect(result.isValid, `Expected '${name}' to be valid`).toBe(true);
      }
    });

    it('should reject invalid tool names', () => {
      const invalidNames = ['RunLinter', 'runLinter', '1-tool', '-tool', ''];

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

  describe('getTools (dynamic)', () => {
    it('should return empty array for extension without getTools', () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

      expect(tools).toEqual([]);
    });

    it('should return empty array for extension returning empty', () => {
      const extension = createMockExtension({
        getTools: () => [],
      });
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

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
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

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
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

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
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

      expect(tools).toEqual([]);
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to get tools'), expect.any(Error));
    });

    it('should handle extension getTools returning non-array', async () => {
      const logger = await import('@/logger');
      const extension = createMockExtension({
        getTools: (() => 'not-an-array') as unknown as () => ToolDefinition[],
      });
      const metadata = createMockMetadata({ name: 'bad-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');
      const tools = manager.getTools(task, 'agent', createMockAgentProfile());

      expect(tools).toEqual([]);
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining('did not return an array'));
    });

    it('should filter tools by project directory', () => {
      const tool1 = createValidTool({ name: 'global-tool' });
      const tool2 = createValidTool({ name: 'project-tool' });

      const globalExtension = createMockExtension({
        getTools: () => [tool1],
      });
      const projectExtension = createMockExtension({
        getTools: () => [tool2],
      });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(globalExtension, createMockMetadata({ name: 'global-ext' }), '/global/ext.ts');
      registry.register(projectExtension, createMockMetadata({ name: 'project-ext' }), '/project/ext.ts', '/project/dir');

      const taskForProject = createMockTask('/project/dir');
      const toolsForProject = manager.getTools(taskForProject, 'agent', createMockAgentProfile());
      expect(toolsForProject).toHaveLength(2);
      expect(toolsForProject.map((t) => t.tool.name)).toContain('global-tool');
      expect(toolsForProject.map((t) => t.tool.name)).toContain('project-tool');

      const taskForOtherProject = createMockTask('/other/project');
      const toolsForOtherProject = manager.getTools(taskForOtherProject, 'agent', createMockAgentProfile());
      expect(toolsForOtherProject).toHaveLength(1);
      expect(toolsForOtherProject[0].tool.name).toBe('global-tool');
    });

    it('should allow dynamic tool registration based on runtime conditions', () => {
      let shouldRegisterTools = true;
      const tool1 = createValidTool({ name: 'dynamic-tool' });
      const extension = createMockExtension({
        getTools: () => (shouldRegisterTools ? [tool1] : []),
      });
      const metadata = createMockMetadata({ name: 'dynamic-extension' });
      const registry = (manager as any).registry as ExtensionRegistry;
      const task = createMockTask();

      registry.register(extension, metadata, '/test/extension.ts');

      shouldRegisterTools = true;
      let tools = manager.getTools(task, 'agent', createMockAgentProfile());
      expect(tools).toHaveLength(1);

      shouldRegisterTools = false;
      tools = manager.getTools(task, 'agent', createMockAgentProfile());
      expect(tools).toHaveLength(0);
    });
  });
});
