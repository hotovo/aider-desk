import * as fs from 'fs/promises';
import * as path from 'path';

import { Parser, Language, Query } from 'web-tree-sitter';

import { Tag } from './types';
import { detectLanguage } from './language-detector';
import { RESOURCES_DIR } from './constants';
import logger from './logger';

const LANGUAGE_WASM_MAP: Record<string, string> = {
  python: 'tree-sitter-python.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  java: 'tree-sitter-java.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  ruby: 'tree-sitter-ruby.wasm',
  php: 'tree-sitter-php.wasm',
  scala: 'tree-sitter-scala.wasm',
  dart: 'tree-sitter-dart.wasm',
  ocaml: 'tree-sitter-ocaml.wasm',
  ocaml_interface: 'tree-sitter-ocaml_interface.wasm',
  c_sharp: 'tree-sitter-c_sharp.wasm',
  haskell: 'tree-sitter-haskell.wasm',
  julia: 'tree-sitter-julia.wasm',
};

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
      const queriesDir = path.join(RESOURCES_DIR, 'queries');
      const queryFiles = await fs.readdir(queriesDir);

      for (const file of queryFiles) {
        if (file.endsWith('-tags.scm')) {
          const language = file.replace('-tags.scm', '');
          const queryPath = path.join(queriesDir, file);
          const queryContent = await fs.readFile(queryPath, 'utf-8');
          this.queries.set(language, queryContent);
        }
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

    const wasmFile = LANGUAGE_WASM_MAP[language];
    if (!wasmFile) {
      return null;
    }

    try {
      // Try multiple possible locations for WASM files
      const possiblePaths = [
        path.join(RESOURCES_DIR, 'wasm', wasmFile),
        path.join(__dirname, 'resources', 'wasm', wasmFile),
        path.join(__dirname, '..', '..', 'node_modules', wasmFile),
        path.join(process.cwd(), 'node_modules', wasmFile),
      ];

      let wasmBuffer: Buffer | null = null;

      for (const wasmPath of possiblePaths) {
        try {
          wasmBuffer = await fs.readFile(wasmPath);
          logger.debug(`[TreeSitterParser] Found WASM at: ${wasmPath}`);
          break;
        } catch {
          // Try next path
        }
      }

      if (!wasmBuffer) {
        logger.warn(`[TreeSitterParser] WASM file not found for ${language}: ${wasmFile}`);
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
