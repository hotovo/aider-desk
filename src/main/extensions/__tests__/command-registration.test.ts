import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';

import type { Extension, CommandDefinition } from '@common/extensions';
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

const createMockProject = (baseDir = '/project/dir'): Project =>
  ({
    baseDir,
  }) as Project;

const createMockDeps = () => ({
  store: {
    getSettings: vi.fn().mockReturnValue({
      extensions: {
        disabled: [],
      },
    }),
  } as any,
  modelManager: {} as any,
  eventManager: {} as any,
});

describe('Extension Command Registration', () => {
  let registry: ExtensionRegistry;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    mockDeps = createMockDeps();
  });

  describe('CommandDefinition Validation', () => {
    it('should accept valid command definition', () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);

      const command: CommandDefinition = {
        name: 'test-command',
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      };

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject command with invalid name format', () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);

      const command: CommandDefinition = {
        name: 'TestCommand', // PascalCase not allowed
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      };

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Command name 'TestCommand' must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, or underscores (e.g., 'generate-tests', 'my---command', 'command_name')",
      );
    });

    it('should reject command with empty description', () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);

      const command: CommandDefinition = {
        name: 'test-command',
        description: '',
        execute: async () => {
          // Command logic
        },
      };

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Command description must be a non-empty string');
    });

    it('should reject command without execute function', () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);

      const command = {
        name: 'test-command',
        description: 'A test command',
      } as CommandDefinition;

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Command execute must be a function');
    });

    it('should accept command with arguments array', () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);

      const command: CommandDefinition = {
        name: 'test-command',
        description: 'A test command',
        arguments: [
          { description: 'First argument', required: true },
          { description: 'Second argument', required: false },
        ],
        execute: async () => {
          // Command logic
        },
      };

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getCommands (dynamic)', () => {
    it('should collect commands from extension', () => {
      const extension: Extension = {
        getCommands: () => [
          {
            name: 'command-one',
            description: 'First command',
            execute: async () => {
              // Command logic
            },
          },
          {
            name: 'command-two',
            description: 'Second command',
            arguments: [{ description: 'Input file', required: true }],
            execute: async () => {
              // Command logic
            },
          },
        ],
      };

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      const commands = manager.getCommands(createMockProject());

      expect(commands).toHaveLength(2);
      expect(commands[0].command.name).toBe('command-one');
      expect(commands[1].command.name).toBe('command-two');
      expect(commands[1].command.arguments).toHaveLength(1);
    });

    it('should skip extension without getCommands method', () => {
      const extension: Extension = {
        // No getCommands method
      };

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      const commands = manager.getCommands(createMockProject());
      expect(commands).toHaveLength(0);
    });

    it('should skip invalid commands', () => {
      const extension: Extension = {
        getCommands: () => [
          {
            name: 'InvalidName', // Not kebab-case
            description: 'Invalid command',
            execute: async () => {
              // Command logic
            },
          },
          {
            name: 'valid-command',
            description: 'Valid command',
            execute: async () => {
              // Command logic
            },
          },
        ],
      };

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      const commands = manager.getCommands(createMockProject());

      // Only valid command should be collected
      expect(commands).toHaveLength(1);
      expect(commands[0].command.name).toBe('valid-command');
    });

    it('should filter commands by project directory', () => {
      const globalExtension: Extension = {
        getCommands: () => [
          {
            name: 'global-command',
            description: 'Global command',
            execute: async () => {},
          },
        ],
      };

      const projectExtension: Extension = {
        getCommands: () => [
          {
            name: 'project-command',
            description: 'Project command',
            execute: async () => {},
          },
        ],
      };

      registry.register(globalExtension, { name: 'global-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/global/ext.ts');
      registry.register(projectExtension, { name: 'project-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/project/ext.ts', '/project/dir');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      const commandsForProject = manager.getCommands(createMockProject('/project/dir'));
      expect(commandsForProject).toHaveLength(2);
      expect(commandsForProject.map((c) => c.command.name)).toContain('global-command');
      expect(commandsForProject.map((c) => c.command.name)).toContain('project-command');

      const commandsForOtherProject = manager.getCommands(createMockProject('/other/project'));
      expect(commandsForOtherProject).toHaveLength(1);
      expect(commandsForOtherProject[0].command.name).toBe('global-command');
    });
  });

  describe('Command Execution', () => {
    it('should execute command with correct arguments', async () => {
      const mockExecute = vi.fn(async () => {
        // Command logic
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

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      await manager.executeCommand('test-command', ['arg1', 'arg2'], createMockProject());

      expect(mockExecute).toHaveBeenCalledWith(['arg1', 'arg2'], expect.any(Object));
    });

    it('should throw error for non-existent command', async () => {
      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      await expect(manager.executeCommand('non-existent', [], createMockProject())).rejects.toThrow("Extension command 'non-existent' not found");
    });

    it('should handle command execution errors', async () => {
      const mockExecute = vi.fn(async () => {
        throw new Error('Command execution failed');
      });

      const extension: Extension = {
        getCommands: () => [
          {
            name: 'failing-command',
            description: 'A failing command',
            execute: mockExecute,
          },
        ],
      };

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');

      const manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager);
      (manager as any).registry = registry;

      await expect(manager.executeCommand('failing-command', [], createMockProject())).rejects.toThrow("Extension command 'failing-command' failed");
    });
  });
});
