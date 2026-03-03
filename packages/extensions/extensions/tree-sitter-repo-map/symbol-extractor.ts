import { Tag } from './types';
import { TreeSitterParser } from './tree-sitter-parser';
import { isLanguageSupported } from './language-detector';
import { CacheManager } from './cache-manager';
import logger from './logger';

export class SymbolExtractor {
  private cacheManager: CacheManager | null = null;

  constructor(private readonly parser: TreeSitterParser) {}

  setCacheManager(cacheManager: CacheManager): void {
    this.cacheManager = cacheManager;
  }

  async extractTags(files: string[], rootDir?: string): Promise<Tag[]> {
    const allTags: Tag[] = [];
    const supportedFiles = files.filter(isLanguageSupported);

    logger.info(`[SymbolExtractor] Extracting tags from ${supportedFiles.length} supported files out of ${files.length} total`);

    // Process files in parallel batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < supportedFiles.length; i += batchSize) {
      const batch = supportedFiles.slice(i, i + batchSize);
      const batchTags = await Promise.all(
        batch.map(async (file) => {
          try {
            // Check cache first
            if (this.cacheManager) {
              const currentMtime = await this.cacheManager.getFileMtime(file);

              if (currentMtime !== null) {
                const cached = await this.cacheManager.getFileCache(file);

                // Use cache if mtime matches
                if (cached && cached.mtime === currentMtime) {
                  logger.debug(`[SymbolExtractor] Cache hit for ${file}`);
                  // Update relative paths in cached tags if rootDir is provided
                  if (rootDir) {
                    const path = await import('path');
                    const relPath = path.relative(rootDir, file);
                    return cached.tags.map((tag) => ({ ...tag, rel_fname: relPath }));
                  }
                  return cached.tags;
                }

                // Parse file and update cache
                const tags = await this.parser.parseFile(file, rootDir);
                await this.cacheManager.setFileCache(file, currentMtime, tags);
                return tags;
              }
            }

            // Fallback to parsing without cache
            return await this.parser.parseFile(file, rootDir);
          } catch (error) {
            logger.error(`[SymbolExtractor] Error processing ${file}:`, error);
            return [];
          }
        }),
      );
      allTags.push(...batchTags.flat());
    }

    logger.info(`[SymbolExtractor] Extracted ${allTags.length} tags total`);
    return allTags;
  }

  filterDefinitions(tags: Tag[]): Tag[] {
    return tags.filter((tag) => tag.kind === 'def');
  }

  filterReferences(tags: Tag[]): Tag[] {
    return tags.filter((tag) => tag.kind === 'ref');
  }

  groupTagsByFile(tags: Tag[]): Map<string, Tag[]> {
    const grouped = new Map<string, Tag[]>();
    for (const tag of tags) {
      const fileTags = grouped.get(tag.rel_fname) || [];
      fileTags.push(tag);
      grouped.set(tag.rel_fname, fileTags);
    }
    return grouped;
  }
}
