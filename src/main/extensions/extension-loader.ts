import path from 'path';

import { createJiti } from 'jiti';
import { Extension, ExtensionMetadata } from '@common/extensions';

import logger from '@/logger';

// Define the interface for the loaded module
interface ExtensionModule {
  default: {
    new (): Extension;
    metadata?: ExtensionMetadata;
  };
}

export class ExtensionLoader {
  private jiti: ReturnType<typeof createJiti>;

  constructor() {
    // Initialize jiti relative to the current file or project root
    // Typically we want it to resolve relative to where we are loading from
    // Disable cache to always load fresh file content
    this.jiti = createJiti(import.meta.url || __filename, { fsCache: false, moduleCache: false });
  }

  private deriveExtensionName(filePath: string): string {
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

  async loadExtension(filePath: string): Promise<{ extension: Extension; metadata: ExtensionMetadata } | null> {
    try {
      // Use jiti to load the file
      // jiti handles TypeScript compilation on the fly
      const module = (await this.jiti.import(filePath)) as ExtensionModule;

      // Check if default export exists
      if (!module.default) {
        logger.error(`Extension file ${path.basename(filePath)} does not have a default export.`);
        return null;
      }

      const ExtensionClass = module.default;

      // Check if it's a class/constructor
      if (typeof ExtensionClass !== 'function') {
        logger.error(`Extension file ${path.basename(filePath)} default export is not a class.`);
        return null;
      }

      // Check for static metadata, or generate from filename
      let metadata = ExtensionClass.metadata;
      if (!metadata) {
        const generatedName = this.deriveExtensionName(filePath);
        metadata = {
          name: generatedName,
          version: '1.0.0',
        };
        logger.info(`Extension file ${path.basename(filePath)} is missing metadata. Generated name: ${generatedName}`);
      }

      // Instantiate the extension
      const extension = new ExtensionClass();

      return { extension, metadata };
    } catch (error) {
      logger.error(`Failed to load extension from ${filePath}:`, error);
      return null;
    }
  }
}
