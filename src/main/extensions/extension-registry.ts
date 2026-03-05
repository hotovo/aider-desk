import path from 'path';

import { Extension, ExtensionMetadata } from '@common/extensions';

import logger from '@/logger';

export interface LoadedExtension {
  id: string;
  instance: Extension;
  metadata: ExtensionMetadata;
  filePath: string;
  initialized: boolean;
  projectDir?: string;
}

export class ExtensionRegistry {
  private extensions = new Map<string, LoadedExtension>();

  private deriveExtensionId(filePath: string): string {
    const parsedPath = path.parse(filePath);
    const filename = parsedPath.name;

    // If the file is index.ts or index.js, use the parent folder name
    if (filename === 'index') {
      const parentDir = path.basename(parsedPath.dir);
      return parentDir;
    }

    // Otherwise, use the filename without extension
    return filename;
  }

  register(extension: Extension, metadata: ExtensionMetadata, filePath: string, projectDir?: string) {
    const id = this.deriveExtensionId(filePath);
    logger.info(`[Extensions] Registering extension: ${metadata.name} (id: ${id})`);
    this.extensions.set(metadata.name, { id, instance: extension, metadata, filePath, initialized: false, projectDir });
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
    return this.extensions.delete(name);
  }

  clear() {
    this.extensions.clear();
  }
}
