/**
 * Type definitions for fast-grep extension
 */

export interface IndexMetadata {
  version: number;
  projectDir: string;
  baseCommitHash: string | null;
  fileCount: number;
  totalSize: number;
  createdAt: number;
  updatedAt: number;
}

export interface FileEntry {
  id: number;
  path: string;
  size: number;
  hash: string;
}

export interface NgramEntry {
  hash: number;
  offset: number;
  count: number;
}

export interface PostingsEntry {
  fileId: number;
  positions: number[];
}

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  context?: string[];
}

export interface GrepInput {
  filePattern: string;
  searchTerm: string;
  contextLines: number;
  caseSensitive: boolean;
  maxResults: number;
}

export interface IndexStats {
  isIndexed: boolean;
  fileCount: number;
  indexSize: number;
  lastUpdated: number | null;
  baseCommitHash: string | null;
}

export interface WeightFunction {
  (bigram: string): number;
}

export interface SparseNgram {
  ngram: string;
  start: number;
  end: number;
}

export interface IndexData {
  metadata: IndexMetadata;
  files: Map<number, FileEntry>;
  filePathToId: Map<string, number>;
  ngramTable: NgramEntry[];
}

export const INDEX_VERSION = 1;
export const INDEX_DIR_NAME = '.aider-desk';
export const INDEX_SUBDIR = 'fast-grep-index';
export const METADATA_FILE = 'metadata.json';
export const FILES_FILE = 'files.bin';
export const LOOKUP_FILE = 'lookup.bin';
export const POSTINGS_FILE = 'postings.bin';

export const MIN_NGRAM_LENGTH = 2;
export const MAX_NGRAM_LENGTH = 32;
export const MAX_NGRAMS_PER_FILE = 10000;
export const HASH_MASK = 0xFFFFFFFF;

/**
 * Binary format constants for memory-mapped index
 */
export const LOOKUP_ENTRY_SIZE = 12; // hash (4) + offset (4) + count (4)
export const POSTING_ENTRY_SIZE = 4; // fileId (4 bytes)
