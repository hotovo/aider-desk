import { Extension, ExtensionMetadata, ToolDefinition, CommandDefinition } from '@common/extensions';

import logger from '@/logger';

export interface LoadedExtension {
  instance: Extension;
  metadata: ExtensionMetadata;
  filePath: string;
  initialized: boolean;
  projectDir?: string;
}

export interface RegisteredTool {
  extensionName: string;
  tool: ToolDefinition;
}

export interface RegisteredCommand {
  extensionName: string;
  command: CommandDefinition;
}

export class ExtensionRegistry {
  private extensions = new Map<string, LoadedExtension>();
  private tools = new Map<string, RegisteredTool>();
  private commands = new Map<string, RegisteredCommand>();

  register(extension: Extension, metadata: ExtensionMetadata, filePath: string, projectDir?: string) {
    logger.info(`[Extensions] Registering extension: ${metadata.name}`);
    this.extensions.set(metadata.name, { instance: extension, metadata, filePath, initialized: false, projectDir });
  }

  setInitialized(name: string, initialized: boolean): void {
    const extension = this.extensions.get(name);
    if (extension) {
      logger.info(`[Extensions] Set initialized: ${name} to ${initialized}`);
      extension.initialized = initialized;
    } else {
      logger.warn(`[Extensions] Failed to set initialized: ${name} to ${initialized}, extension not found`);
    }
  }

  getExtensions(projectDir?: string): LoadedExtension[] {
    if (projectDir) {
      return Array.from(this.extensions.values()).filter((ext) => ext.projectDir === projectDir || !ext.projectDir);
    }
    return Array.from(this.extensions.values());
  }

  getExtension(name: string): LoadedExtension | undefined {
    return this.extensions.get(name);
  }

  unregister(name: string): boolean {
    logger.info(`[Extensions] Unregistering extension: ${name}`);
    for (const [toolKey, registered] of this.tools) {
      if (registered.extensionName === name) {
        this.tools.delete(toolKey);
      }
    }
    for (const [commandKey, registered] of this.commands) {
      if (registered.extensionName === name) {
        this.commands.delete(commandKey);
      }
    }
    return this.extensions.delete(name);
  }

  clear() {
    this.extensions.clear();
    this.tools.clear();
    this.commands.clear();
  }

  registerTool(extensionName: string, tool: ToolDefinition): void {
    logger.info(`[Extensions] Registered tool '${tool.name}' from extension '${extensionName}'`);
    const toolKey = `${extensionName}:${tool.name}`;
    this.tools.set(toolKey, { extensionName, tool });
  }

  getTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  getToolsByExtension(extensionName: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter((registered) => registered.extensionName === extensionName);
  }

  clearTools(): void {
    logger.info('[Extensions] Cleared all tools');
    this.tools.clear();
  }

  registerCommand(extensionName: string, command: CommandDefinition): void {
    logger.info(`[Extensions] Registered command '${command.name}' from extension '${extensionName}'`);
    const commandKey = `${extensionName}:${command.name}`;
    this.commands.set(commandKey, { extensionName, command });
  }

  getCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  getCommandsByExtension(extensionName: string): RegisteredCommand[] {
    return Array.from(this.commands.values()).filter((registered) => registered.extensionName === extensionName);
  }

  getCommandByName(name: string): RegisteredCommand | undefined {
    for (const registered of this.commands.values()) {
      if (registered.command.name === name) {
        return registered;
      }
    }
    return undefined;
  }

  clearCommands(): void {
    logger.info('[Extensions] Cleared all commands');
    this.commands.clear();
  }
}
