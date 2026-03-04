// Export types
export type { Tag, Symbol, RepoMapOptions, SymbolOptions, GraphEdge, RankedDefinition, ParseResult, LanguageConfig, Logger } from './types';

// Export classes
export { TreeSitterAnalyzer } from './tree-sitter-analyzer';
export { TreeSitterParser } from './tree-sitter-parser';
export { SymbolExtractor } from './symbol-extractor';
export { GraphBuilder } from './graph-builder';
export { PageRankCalculator } from './pagerank';
export { TreeRenderer } from './tree-renderer';
export { CacheManager } from './cache-manager';

// Export utilities
export { detectLanguage, isLanguageSupported, getSupportedExtensions, getSupportedLanguages } from './language-detector';
export { downloadWasmForLanguage, getLanguageWasmConfig, getSupportedLanguagesForWasm } from './wasm-downloader';
export { setLogger, getLogger } from './logger';
export { getAllFiles } from './file-utils';

// Convenience functions
import { TreeSitterAnalyzer } from './tree-sitter-analyzer';

let defaultAnalyzer: TreeSitterAnalyzer | null = null;

async function getAnalyzer(): Promise<TreeSitterAnalyzer> {
  if (!defaultAnalyzer) {
    defaultAnalyzer = new TreeSitterAnalyzer();
    await defaultAnalyzer.initialize();
  }
  return defaultAnalyzer;
}

/**
 * Extract symbols from files
 * @param filePaths - Array of file paths to extract symbols from
 * @param options - Symbol extraction options
 * @returns Array of symbols
 */
export async function extractSymbols(filePaths: string[], options?: import('./types').SymbolOptions): Promise<import('./types').Symbol[]> {
  const analyzer = await getAnalyzer();
  return analyzer.extractSymbols(filePaths, options);
}

/**
 * Generate a repository map
 * @param root - Root directory of the repository
 * @param options - Repository map options
 * @returns Formatted repository map string
 */
export async function getRepoMap(root: string, options?: Omit<import('./types').RepoMapOptions, 'root'>): Promise<string> {
  const analyzer = await getAnalyzer();
  return analyzer.getRepoMap({ ...options, root });
}
