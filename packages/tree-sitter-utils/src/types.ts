export interface Tag {
  rel_fname: string;
  fname: string;
  line: number;
  name: string;
  kind: 'def' | 'ref';
}

export interface Symbol {
  name: string;
  kind: 'def' | 'ref';
  line: number;
  file: string;
  relativeFile: string;
}

export interface RepoMapOptions {
  root: string;
  files?: string[];
  excludePatterns?: string[];
  mentionedFiles?: Set<string>;
  mentionedIdents?: Set<string>;
  chatFiles?: Set<string>;
  maxLines?: number;
}

export interface SymbolOptions {
  useCache?: boolean;
  rootDir?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  ident: string;
}

export interface RankedDefinition {
  rel_fname: string;
  name: string;
  rank: number;
  line: number;
}

export interface ParseResult {
  tags: Tag[];
  file: string;
  language: string;
}

export interface LanguageConfig {
  name: string;
  extensions: string[];
  wasmUrl: string;
  wasmFile: string;
}

export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}
