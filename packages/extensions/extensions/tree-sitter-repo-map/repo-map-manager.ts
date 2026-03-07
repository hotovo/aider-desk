import { RepoMapOptions } from './types';
import { TreeSitterParser } from './tree-sitter-parser';
import { SymbolExtractor } from './symbol-extractor';
import { GraphBuilder } from './graph-builder';
import { PageRankCalculator } from './pagerank';
import { TreeRenderer } from './tree-renderer';
import { CacheManager } from './cache-manager';
import { getAllFiles } from './file-utils';
import logger from './logger';

export class RepoMapManager {
  private readonly parser: TreeSitterParser;
  private readonly symbolExtractor: SymbolExtractor;
  private readonly graphBuilder: GraphBuilder;
  private readonly pageRankCalculator: PageRankCalculator;
  private readonly treeRenderer: TreeRenderer;
  private readonly cacheManager: CacheManager;
  private initialized = false;

  private static instance: RepoMapManager | null = null;

  static getInstance(): RepoMapManager {
    if (!RepoMapManager.instance) {
      RepoMapManager.instance = new RepoMapManager();
    }
    return RepoMapManager.instance;
  }

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
    logger.info('[RepoMapManager] Initialized');
  }

  async getRepositoryMap(options: RepoMapOptions): Promise<string> {
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

      logger.info(`[RepoMapManager] Processing ${filesToProcess.length} files for repository map`);

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

      logger.info(`[RepoMapManager] Generated repository map with ${rankedDefinitions.length} definitions`);

      return output;
    } catch (error) {
      logger.error('[RepoMapManager] Error generating repository map:', error);
      return '';
    }
  }
}
