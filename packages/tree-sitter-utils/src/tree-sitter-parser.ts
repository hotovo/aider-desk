import * as fs from 'fs/promises';
import * as path from 'path';

import { Parser, Language, Query } from 'web-tree-sitter';

import { Tag } from './types';
import { detectLanguage } from './language-detector';
import { downloadWasmForLanguage } from './wasm-downloader';
import { QUERIES_DIR } from './constants';
import logger from './logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SyntaxNode = any;

export class TreeSitterParser {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parser: any = null;
  private languages: Map<string, Language> = new Map();
  private queries: Map<string, string> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await Parser.init();
      this.parser = new Parser();

      // Load queries
      try {
        const queryFiles = await fs.readdir(QUERIES_DIR);

        for (const file of queryFiles) {
          if (file.endsWith('-tags.scm')) {
            const language = file.replace('-tags.scm', '');
            const queryPath = path.join(QUERIES_DIR, file);
            const queryContent = await fs.readFile(queryPath, 'utf-8');
            this.queries.set(language, queryContent);
          }
        }
      } catch (error) {
        logger.warn('[TreeSitterParser] Could not load query files from resources:', error);
      }

      this.initialized = true;
      logger.info(`[TreeSitterParser] Initialized with ${this.queries.size} language queries`);
    } catch (error) {
      logger.error('[TreeSitterParser] Initialization failed:', error);
      throw error;
    }
  }

  private async loadLanguage(language: string): Promise<Language | null> {
    if (this.languages.has(language)) {
      return this.languages.get(language)!;
    }

    try {
      // Use on-demand WASM download
      const wasmBuffer = await downloadWasmForLanguage(language);
      if (!wasmBuffer) {
        return null;
      }

      const lang = await Language.load(wasmBuffer);
      this.languages.set(language, lang);
      return lang;
    } catch (error) {
      logger.error(`[TreeSitterParser] Failed to load language ${language}:`, error);
      return null;
    }
  }

  async parseFile(filePath: string, rootDir?: string): Promise<Tag[]> {
    if (!this.initialized || !this.parser) {
      await this.initialize();
    }

    if (!this.parser) {
      return [];
    }

    const language = detectLanguage(filePath);
    if (!language) {
      return [];
    }

    const lang = await this.loadLanguage(language);
    if (!lang) {
      return [];
    }

    const query = this.queries.get(language);
    if (!query) {
      return [];
    }

    try {
      const sourceCode = await fs.readFile(filePath, 'utf-8');

      this.parser.setLanguage(lang);
      const tree = this.parser.parse(sourceCode);

      if (!tree) {
        return [];
      }

      const tags = this.extractTags(tree.rootNode, query, filePath, lang, rootDir);
      return tags;
    } catch (error) {
      logger.error(`[TreeSitterParser] Error parsing file ${filePath}:`, error);
      return [];
    }
  }

  private extractTags(node: SyntaxNode, query: string, filePath: string, language: Language, rootDir?: string): Tag[] {
    const tags: Tag[] = [];

    try {
      const queryObj = new Query(language, query);
      const matches = queryObj.matches(node);

      logger.debug(`[TreeSitterParser] Found ${matches.length} matches in ${filePath}`);

      // Compute relative path if rootDir is provided
      const relFname = rootDir ? path.relative(rootDir, filePath) : filePath;

      for (const match of matches) {
        for (const capture of match.captures) {
          // Only process captures that contain the actual name (name.definition.* or name.reference.*)
          // Skip captures that are just markers for the entire definition (@definition.* or @reference.*)
          if (!capture.name.startsWith('name.')) {
            continue;
          }

          const name = capture.node.text;
          const kind = this.determineKind(capture.name);
          const line = capture.node.startPosition.row;

          logger.debug(`[TreeSitterParser] Found tag: ${name} (${kind}) at line ${line}`);

          tags.push({
            rel_fname: relFname,
            fname: filePath,
            line,
            name,
            kind,
          });
        }
      }
    } catch (error) {
      logger.error(`[TreeSitterParser] Error extracting tags from ${filePath}:`, error);
    }

    return tags;
  }

  private determineKind(captureName: string): 'def' | 'ref' {
    if (captureName.includes('definition')) {
      return 'def';
    }
    return 'ref';
  }
}
