import path from 'path';
import { promises as fs } from 'fs';

import { Extension, ExtensionMetadata } from '@common/extensions';

import logger from '@/logger';

export interface LoadedExtension {
  id: string;
  instance: Extension;
  metadata: ExtensionMetadata;
  filePath: string;
  initialized: boolean;
  projectDir?: string;
  readmeContent?: string;
}

export class ExtensionRegistry {
  private extensions = new Map<string, LoadedExtension>();

  private deriveExtensionId(filePath: string): string {
    const parsedPath = path.parse(filePath);
    const filename = parsedPath.name;

    // If the file is index.ts or index.js, use the parent folder name
    if (filename === 'index') {
      return path.basename(parsedPath.dir);
    }

    // Otherwise, use the filename without extension
    return filename;
  }

  async register(extension: Extension, metadata: ExtensionMetadata, filePath: string, projectDir?: string) {
    const id = this.deriveExtensionId(filePath);
    logger.debug(`[Extensions] Registering extension: ${metadata.name} (id: ${id})`);

    // Try to load README.md for folder-based extensions
    let readmeContent: string | undefined;
    const parsedPath = path.parse(filePath);
    if (parsedPath.name === 'index') {
      const readmePath = path.join(parsedPath.dir, 'README.md');
      try {
        const content = await fs.readFile(readmePath, 'utf-8');
        if (content.trim()) {
          readmeContent = content;
          logger.debug(`[Extensions] Loaded README.md for extension: ${metadata.name}`);
        }
      } catch {
        // README.md doesn't exist or can't be read, that's fine
      }
    }

    this.extensions.set(filePath, {
      id,
      instance: extension,
      metadata,
      filePath,
      initialized: false,
      projectDir,
      readmeContent,
    });
  }

  setInitialized(filePath: string, initialized: boolean): void {
    const extension = this.extensions.get(filePath);
    if (extension) {
      logger.debug(`[Extensions] Set initialized: ${filePath} to ${initialized}`);
      extension.initialized = initialized;
    } else {
      logger.warn(`[Extensions] Failed to set initialized: ${filePath} to ${initialized}, extension not found`);
    }
  }

  getExtensions(projectDir?: string): LoadedExtension[] {
    if (projectDir) {
      return Array.from(this.extensions.values()).filter((ext) => ext.projectDir === projectDir || !ext.projectDir);
    }
    return Array.from(this.extensions.values());
  }

  getExtension(filePath: string): LoadedExtension | undefined {
    return this.extensions.get(filePath);
  }

  unregister(filePath: string): boolean {
    logger.debug(`[Extensions] Unregistering extension: ${filePath}`);
    return this.extensions.delete(filePath);
  }

  clear() {
    this.extensions.clear();
  }
}
