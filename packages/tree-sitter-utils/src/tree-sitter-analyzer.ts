import { TreeSitterParser } from './tree-sitter-parser';
import { SymbolExtractor } from './symbol-extractor';
import { GraphBuilder } from './graph-builder';
import { PageRankCalculator } from './pagerank';
import { TreeRenderer } from './tree-renderer';
import { CacheManager } from './cache-manager';
import { getAllFiles } from './file-utils';
import { RepoMapOptions, SymbolOptions, Tag, Symbol, ParseResult } from './types';
import logger from './logger';

export class TreeSitterAnalyzer {
  private readonly parser: TreeSitterParser;
  private readonly symbolExtractor: SymbolExtractor;
  private readonly graphBuilder: GraphBuilder;
  private readonly pageRankCalculator: PageRankCalculator;
  private readonly treeRenderer: TreeRenderer;
  private readonly cacheManager: CacheManager;
  private initialized = false;

  constructor() {
    this.parser = new TreeSitterParser();
    this.cacheManager = new CacheManager();
    this.symbolExtractor = new SymbolExtractor(this.parser);
    this.symbolExtractor.setCacheManager(this.cacheManager);
    this.graphBuilder = new GraphBuilder();
    this.pageRankCalculator = new PageRankCalculator();
    this.treeRenderer = new TreeRenderer();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.parser.initialize();
    await this.cacheManager.initialize();
    this.initialized = true;
    logger.info('[TreeSitterAnalyzer] Initialized');
  }

  async getRepoMap(options: RepoMapOptions): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { root, files, excludePatterns = [], mentionedFiles = new Set(), mentionedIdents = new Set(), chatFiles = new Set(), maxLines } = options;

    try {
      // Get files to process
      let filesToProcess: string[];
      if (files && files.length > 0) {
        filesToProcess = files;
      } else {
        filesToProcess = await getAllFiles(root, excludePatterns);
      }

      logger.info(`[TreeSitterAnalyzer] Processing ${filesToProcess.length} files for repository map`);

      // Extract tags from all files
      const tags = await this.symbolExtractor.extractTags(filesToProcess, root);

      if (tags.length === 0) {
        return '';
      }

      // Build dependency graph
      const { graph, defines: _defines, references: _references } = this.graphBuilder.buildDependencyGraph(tags);

      // Calculate PageRank
      const rankedDefinitions = this.pageRankCalculator.calculate(graph, tags, mentionedFiles, mentionedIdents);

      // Render tree
      const output = await this.treeRenderer.render(rankedDefinitions, chatFiles, maxLines);

      logger.info(`[TreeSitterAnalyzer] Generated repository map with ${rankedDefinitions.length} definitions`);

      return output;
    } catch (error) {
      logger.error('[TreeSitterAnalyzer] Error generating repository map:', error);
      return '';
    }
  }

  async extractSymbols(filePaths: string[], options?: SymbolOptions): Promise<Symbol[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const useCache = options?.useCache !== false;

    try {
      // Temporarily disable cache if requested
      const originalCacheManager = useCache ? this.cacheManager : null;
      if (!useCache) {
        this.symbolExtractor.setCacheManager(null as any);
      }

      const tags = await this.symbolExtractor.extractTags(filePaths, options?.rootDir);

      // Restore cache manager
      if (!useCache) {
        this.symbolExtractor.setCacheManager(this.cacheManager);
      }

      // Convert tags to symbols
      const symbols: Symbol[] = tags.map((tag) => ({
        name: tag.name,
        kind: tag.kind,
        line: tag.line,
        file: tag.fname,
        relativeFile: tag.rel_fname,
      }));

      logger.info(`[TreeSitterAnalyzer] Extracted ${symbols.length} symbols from ${filePaths.length} files`);

      return symbols;
    } catch (error) {
      logger.error('[TreeSitterAnalyzer] Error extracting symbols:', error);
      return [];
    }
  }

  async parseFile(filePath: string): Promise<ParseResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { detectLanguage } = await import('./language-detector');
    const language = detectLanguage(filePath) || 'unknown';

    const tags = await this.parser.parseFile(filePath);

    return {
      tags,
      file: filePath,
      language,
    };
  }
}
