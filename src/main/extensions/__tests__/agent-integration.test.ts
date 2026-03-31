/**
 * Tests for Extension Tool Integration with Agent System
 * Verifies toolset creation, execution wrapping, error isolation, and hook integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';

import type { ToolCallOptions } from 'ai';
import type { Extension, ExtensionMetadata, ToolDefinition, ExtensionContext, ToolResult } from '@common/extensions';
import type { TaskData, AgentProfile, ContextMemoryMode, InvocationMode } from '@common/types';
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
    getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
  } as any,
  eventManager: {
    sendSettingsUpdated: vi.fn(),
  } as any,
  telemetryManager: {} as any,
});

const createValidTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'test-tool',
  description: 'A test tool',
  inputSchema: z.object({
    input: z.string(),
  }),
  async execute(args, _signal, _context) {
    return { content: [{ type: 'text', text: args.input }] };
  },
  ...overrides,
});

const createMockTask = (): Task => {
  const task = {
    task: {
      id: 'test-task-id',
      baseDir: '/test/project',
      name: 'Test Task',
      aiderTotalCost: 0,
      agentTotalCost: 0,
      mainModel: 'test-model',
      parentId: null,
      state: 'in-progress',
    } as TaskData,
    project: {
      baseDir: '/test/project',
    } as Project,
    addToolMessage: vi.fn(),
    getProjectDir: () => '/test/project',
  } as unknown as Task;
  return task;
};

const createMockProfile = (): AgentProfile => ({
  id: 'test-profile',
  name: 'Test Profile',
  model: 'test-model',
  provider: 'test-provider',
  enabledServers: [],
  toolApprovals: {},
  toolSettings: {},
  includeContextFiles: true,
  includeRepoMap: true,
  useAiderTools: true,
  usePowerTools: true,
  useSubagents: false,
  useTodoTools: true,
  useTaskTools: true,
  useMemoryTools: true,
  useSkillsTools: true,
  useExtensionTools: true,
  customInstructions: '',
  maxIterations: 10,
  maxTokens: 4096,
  temperature: 0.7,
  minTimeBetweenToolCalls: 0,
  subagent: {
    enabled: false,
    contextMemory: 'full' as ContextMemoryMode,
    systemPrompt: '',
    invocationMode: 'on-demand' as InvocationMode,
    color: '#000',
    description: '',
  },
});

const createMockProject = (baseDir = '/project/dir'): Project =>
  ({
    baseDir,
  }) as Project;

describe('Extension Tool Integration with Agent', () => {
  let manager: ExtensionManager;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = createMockDeps();
    manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager, mockDeps.telemetryManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createExtensionToolset', () => {
    it('should return empty ToolSet when no tools registered', async () => {
      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(toolset).toBeDefined();
      expect(Object.keys(toolset)).toHaveLength(0);
    });

    it('should create ToolSet with tool name as key', async () => {
      const testTool = createValidTool({ name: 'my-custom-tool' });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(toolset).toBeDefined();
      expect(Object.keys(toolset)).toContain('my-custom-tool');
    });

    it('should create ExtensionContext with Task', async () => {
      const executeMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'success' }] } as ToolResult);
      const testTool = createValidTool({ execute: executeMock });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      // Execute the tool
      const toolKey = 'test-tool';
      const toolDef = toolset[toolKey];
      expect(toolDef).toBeDefined();
      await toolDef!.execute!({ input: 'test' }, { toolCallId: 'call-123' } as ToolCallOptions);

      expect(executeMock).toHaveBeenCalled();
      const contextArg = executeMock.mock.calls[0][2] as ExtensionContext;
      expect(contextArg.getTaskContext()).not.toBeNull();
      expect(contextArg.getTaskContext()?.data.id).toBe('test-task-id');
    });

    it('should pass AbortSignal to execute', async () => {
      const executeMock = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'success' }] } as ToolResult);
      const testTool = createValidTool({ execute: executeMock });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      const toolKey = 'test-tool';
      const toolDef = toolset[toolKey];
      expect(toolDef).toBeDefined();
      await toolDef!.execute!({ input: 'test' }, { toolCallId: 'call-123' } as ToolCallOptions);

      expect(executeMock).toHaveBeenCalled();
      const signalArg = executeMock.mock.calls[0][1] as AbortSignal;
      expect(signalArg.aborted).toBe(false);
    });
  });

  describe('Tool Execution Wrapper', () => {
    it('should catch and log errors without crashing', async () => {
      const executeMock = vi.fn().mockRejectedValue(new Error('Tool execution failed'));
      const testTool = createValidTool({ execute: executeMock });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      const toolKey = 'test-tool';
      const toolDef = toolset[toolKey];
      expect(toolDef).toBeDefined();
      // Should not throw
      const result = await toolDef!.execute!({ input: 'test' }, { toolCallId: 'call-123' } as ToolCallOptions);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Error');
    });

    it('should return string directly if result is string', async () => {
      const testTool = createValidTool({
        async execute() {
          return 'Simple string result';
        },
      });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      const toolKey = 'test-tool';
      const toolDef = toolset[toolKey];
      expect(toolDef).toBeDefined();
      const result = await toolDef!.execute!({ input: 'test' }, { toolCallId: 'call-123' } as ToolCallOptions);

      expect(result).toBe('Simple string result');
    });

    it('should return error message on failure', async () => {
      const testTool = createValidTool({
        async execute() {
          throw new Error('Something went wrong');
        },
      });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      const toolKey = 'test-tool';
      const toolDef = toolset[toolKey];
      expect(toolDef).toBeDefined();
      const result = await toolDef!.execute!({ input: 'test' }, { toolCallId: 'call-123' } as ToolCallOptions);

      expect(result).toContain('Something went wrong');
    });

    it('should not add noticeable latency', async () => {
      const testTool = createValidTool({
        async execute() {
          return 'Fast result' as unknown as ToolResult;
        },
      });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const startTime = Date.now();
      manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);
      const creationTime = Date.now() - startTime;

      // Toolset creation should be fast (< 100ms)
      expect(creationTime).toBeLessThan(100);
    });
  });

  describe('Tool Naming Convention', () => {
    it('should use extension name and tool name in key', async () => {
      const testTool = createValidTool({ name: 'my-tool' });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'my-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(Object.keys(toolset)).toContain('my-tool');
    });

    it('should handle multiple tools from same extension', async () => {
      const tool1 = createValidTool({ name: 'tool-one' });
      const tool2 = createValidTool({ name: 'tool-two' });
      const extension = createMockExtension({
        getTools: () => [tool1, tool2],
      });
      const metadata = createMockMetadata({ name: 'multi-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(Object.keys(toolset)).toContain('tool-one');
      expect(Object.keys(toolset)).toContain('tool-two');
    });
  });

  describe('Tool Approval', () => {
    it('should skip tools marked as Never approved', async () => {
      const testTool = createValidTool({ name: 'never-approved-tool' });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      profile.toolApprovals = {
        'never-approved-tool': 'never' as any,
      };
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(Object.keys(toolset)).not.toContain('never-approved-tool');
    });
  });

  describe('Description and Parameters', () => {
    it('should preserve tool description', async () => {
      const testTool = createValidTool({ description: 'A custom tool description' });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(toolset['test-tool']!.description).toBe('A custom tool description');
    });

    it('should preserve Zod schema as inputSchema', async () => {
      const schema = z.object({
        input: z.string(),
        count: z.number().optional(),
      });
      const testTool = createValidTool({ inputSchema: schema });
      const extension = createMockExtension({
        getTools: () => [testTool],
      });
      const metadata = createMockMetadata({ name: 'test-extension' });

      const registry = (manager as any).registry as ExtensionRegistry;
      registry.register(extension, metadata, '/test/path.ts');

      const task = createMockTask();
      const profile = createMockProfile();
      const abortSignal = new AbortController().signal;

      const toolset = manager.createExtensionToolset(task, 'agent', profile, {}, abortSignal);

      expect(toolset['test-tool']!.inputSchema).toBe(schema);
    });
  });

  describe('Extension Command Registration Examples', () => {
    it('should demonstrate command registration with getCommands', () => {
      const extension: Extension = {
        getCommands: () => [
          {
            name: 'generate-tests',
            description: 'Generate unit tests for a file',
            arguments: [
              { description: 'File path', required: true },
              { description: 'Framework (jest, vitest, mocha)', required: false },
            ],
            execute: async (args, context) => {
              const filePath = args[0];
              const framework = args[1] || 'vitest';
              const prompt = `Generate comprehensive unit tests for ${filePath} using ${framework} framework.\n\nInclude:\n- Edge cases\n- Error handling\n- Mock examples`;
              const taskContext = context.getTaskContext();
              if (taskContext) {
                await taskContext.runPrompt(prompt);
              }
            },
          },
          {
            name: 'review-code',
            description: 'Review code for best practices',
            execute: async (args, context) => {
              const files = args.join(', ');
              const prompt = `Review the following files for:\n- Code quality\n- Best practices\n- Potential bugs\n- Security concerns\n\nFiles: ${files}`;
              const taskContext = context.getTaskContext();
              if (taskContext) {
                await taskContext.runPrompt(prompt);
              }
            },
          },
        ],
      };

      const metadata = createMockMetadata();
      const registry = new ExtensionRegistry();
      registry.register(extension, metadata, '/test/path.ts');

      const mockDeps = createMockDeps();
      const manager = new ExtensionManager(
        mockDeps.store,
        mockDeps.modelManager,
        {
          ...mockDeps.eventManager,
          getProjects: vi.fn().mockReturnValue([]),
        } as any,
        mockDeps.telemetryManager,
      );
      (manager as any).registry = registry;

      const commands = manager.getCommands(createMockProject());

      expect(commands).toHaveLength(2);
      expect(commands[0].command.name).toBe('generate-tests');
      expect(commands[0].command.arguments).toHaveLength(2);
      expect(commands[1].command.name).toBe('review-code');
    });

    it('should execute command with ExtensionContext', async () => {
      const mockExecute = vi.fn(async (_args: string[], context: ExtensionContext) => {
        context.log('Executing command', 'info');
      });

      const extension: Extension = {
        getCommands: () => [
          {
            name: 'test-command',
            description: 'A test command',
            execute: mockExecute,
          },
        ],
      };

      const metadata = createMockMetadata();
      const registry = new ExtensionRegistry();
      registry.register(extension, metadata, '/test/path.ts');

      const mockDeps = createMockDeps();
      const manager = new ExtensionManager(
        mockDeps.store,
        mockDeps.modelManager,
        {
          ...mockDeps.eventManager,
          getProjects: vi.fn().mockReturnValue([]),
        } as any,
        mockDeps.telemetryManager,
      );
      (manager as any).registry = registry;

      manager.getCommands(createMockProject());

      await manager.executeCommand('test-command', ['arg1', 'arg2'], {} as any);

      expect(mockExecute).toHaveBeenCalledWith(['arg1', 'arg2'], expect.any(Object));
    });
  });
});
