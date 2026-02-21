import path from 'path';

import { createJiti } from 'jiti';
import { Extension, ExtensionMetadata } from '@common/extensions/types';

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
    this.jiti = createJiti(import.meta.url || __filename);
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

      // Check for static metadata
      const metadata = ExtensionClass.metadata;
      if (!metadata) {
        logger.error(`Extension file ${path.basename(filePath)} class is missing static 'metadata' property.`);
        return null;
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
