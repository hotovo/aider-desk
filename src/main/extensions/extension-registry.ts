import { Extension, ExtensionMetadata, ToolDefinition } from '@common/extensions/types';

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

export class ExtensionRegistry {
  private extensions = new Map<string, LoadedExtension>();
  private tools = new Map<string, RegisteredTool>();

  register(extension: Extension, metadata: ExtensionMetadata, filePath: string, projectDir?: string) {
    this.extensions.set(metadata.name, { instance: extension, metadata, filePath, initialized: false, projectDir });
  }

  setInitialized(name: string, initialized: boolean): void {
    const extension = this.extensions.get(name);
    if (extension) {
      extension.initialized = initialized;
    }
  }

  getExtensions(projectDir?: string): LoadedExtension[] {
    if (projectDir) {
      return Array.from(this.extensions.values()).filter((ext) => ext.projectDir === projectDir || !ext.projectDir);
    }
    return Array.from(this.extensions.values()).filter((ext) => !ext.projectDir);
  }

  getExtension(name: string): LoadedExtension | undefined {
    return this.extensions.get(name);
  }

  unregister(name: string): boolean {
    for (const [toolKey, registered] of this.tools) {
      if (registered.extensionName === name) {
        this.tools.delete(toolKey);
      }
    }
    return this.extensions.delete(name);
  }

  clear() {
    this.extensions.clear();
    this.tools.clear();
  }

  registerTool(extensionName: string, tool: ToolDefinition): void {
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
    this.tools.clear();
  }
}
