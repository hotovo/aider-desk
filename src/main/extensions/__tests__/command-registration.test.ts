import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';

import type { Extension, CommandDefinition } from '@common/extensions';

describe('Extension Command Registration', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('CommandDefinition Validation', () => {
    it('should accept valid command definition', () => {
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);

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
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);

      const command: CommandDefinition = {
        name: 'TestCommand', // PascalCase not allowed
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      };

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Command name 'TestCommand' must be kebab-case (e.g., 'generate-tests', 'my-command')");
    });

    it('should reject command with empty description', () => {
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);

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
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);

      const command = {
        name: 'test-command',
        description: 'A test command',
      } as CommandDefinition;

      const result = manager.validateCommandDefinition(command);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Command execute must be a function');
    });

    it('should accept command with arguments array', () => {
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);

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

  describe('ExtensionRegistry Command Storage', () => {
    it('should register and retrieve commands', () => {
      const command: CommandDefinition = {
        name: 'test-command',
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      };

      registry.registerCommand('test-extension', command);

      const commands = registry.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].extensionName).toBe('test-extension');
      expect(commands[0].command.name).toBe('test-command');
    });

    it('should retrieve commands by extension name', () => {
      const command1: CommandDefinition = {
        name: 'command-one',
        description: 'First command',
        execute: async () => {
          // Command logic
        },
      };

      const command2: CommandDefinition = {
        name: 'command-two',
        description: 'Second command',
        execute: async () => {
          // Command logic
        },
      };

      registry.registerCommand('extension-a', command1);
      registry.registerCommand('extension-a', command2);
      registry.registerCommand('extension-b', command1);

      const extensionACommands = registry.getCommandsByExtension('extension-a');
      expect(extensionACommands).toHaveLength(2);
      expect(extensionACommands[0].extensionName).toBe('extension-a');
      expect(extensionACommands[1].extensionName).toBe('extension-a');
    });

    it('should retrieve command by name', () => {
      const command: CommandDefinition = {
        name: 'unique-command',
        description: 'A unique command',
        execute: async () => {
          // Command logic
        },
      };

      registry.registerCommand('test-extension', command);

      const found = registry.getCommandByName('unique-command');
      expect(found).toBeDefined();
      expect(found?.command.name).toBe('unique-command');
      expect(found?.extensionName).toBe('test-extension');
    });

    it('should return undefined for non-existent command', () => {
      const found = registry.getCommandByName('non-existent');
      expect(found).toBeUndefined();
    });

    it('should clear all commands', () => {
      const command: CommandDefinition = {
        name: 'test-command',
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      };

      registry.registerCommand('test-extension', command);
      expect(registry.getCommands()).toHaveLength(1);

      registry.clearCommands();
      expect(registry.getCommands()).toHaveLength(0);
    });

    it('should remove commands when unregistering extension', () => {
      const extension: Extension = {
        getCommands: () => [
          {
            name: 'test-command',
            description: 'A test command',
            execute: async () => {
              // Command logic
            },
          },
        ],
      };

      registry.register(extension, { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' }, '/path/to/ext.ts');
      registry.registerCommand('test-ext', {
        name: 'test-command',
        description: 'A test command',
        execute: async () => {
          // Command logic
        },
      });

      expect(registry.getCommands()).toHaveLength(1);

      registry.unregister('test-ext');
      expect(registry.getCommands()).toHaveLength(0);
    });
  });

  describe('Command Execution', () => {
    it('should execute command with correct arguments', async () => {
      const mockExecute = vi.fn(async () => {
        // Command logic
      });

      const command: CommandDefinition = {
        name: 'test-command',
        description: 'A test command',
        execute: mockExecute,
      };

      registry.registerCommand('test-extension', command);

      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      // Inject the registry (normally done internally)
      (manager as any).registry = registry;

      await manager.executeCommand('test-command', ['arg1', 'arg2'], {} as any);

      expect(mockExecute).toHaveBeenCalledWith(['arg1', 'arg2'], expect.any(Object));
    });

    it('should throw error for non-existent command', async () => {
      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      (manager as any).registry = registry;

      await expect(manager.executeCommand('non-existent', [], {} as any)).rejects.toThrow("Extension command 'non-existent' not found");
    });

    it('should handle command execution errors', async () => {
      const mockExecute = vi.fn(async () => {
        throw new Error('Command execution failed');
      });

      const command: CommandDefinition = {
        name: 'failing-command',
        description: 'A failing command',
        execute: mockExecute,
      };

      registry.registerCommand('test-extension', command);

      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      (manager as any).registry = registry;

      await expect(manager.executeCommand('failing-command', [], {} as any)).rejects.toThrow("Extension command 'failing-command' failed");
    });
  });

  describe('Extension getCommands Method', () => {
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

      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      (manager as any).registry = registry;

      const commands = manager.collectCommands();

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

      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      (manager as any).registry = registry;

      const commands = manager.collectCommands();
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

      const manager = new ExtensionManager({} as any, {} as any, {} as any, { getProjects: vi.fn().mockReturnValue([]) } as any);
      (manager as any).registry = registry;

      const commands = manager.collectCommands();

      // Only valid command should be collected
      expect(commands).toHaveLength(1);
      expect(commands[0].command.name).toBe('valid-command');
    });
  });
});
