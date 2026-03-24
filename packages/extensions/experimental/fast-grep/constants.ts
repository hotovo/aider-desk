/**
 * Constants for fast-grep extension
 */

import type { WeightFunction } from './types';

// Import the generated frequency weights
import { FREQUENCY_WEIGHTS } from './frequency-weights';

export { FREQUENCY_WEIGHTS };

/**
 * Default weight for character pairs not in the frequency table.
 * Uses a simple hash function to assign pseudo-random weights.
 */
export const DEFAULT_WEIGHT_BASE = 1000;

/**
 * Create a weight function using frequency table with fallback to hash.
 */
export const createWeightFunction = (): WeightFunction => {
  return (bigram: string): number => {
    if (bigram in FREQUENCY_WEIGHTS) {
      return FREQUENCY_WEIGHTS[bigram];
    }

    // Fallback: use simple hash for unknown bigrams
    // This gives pseudo-random but deterministic weights
    let hash = 0;
    for (let i = 0; i < bigram.length; i++) {
      const char = bigram.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return DEFAULT_WEIGHT_BASE + Math.abs(hash % 10000);
  };
};

/**
 * File extensions to index (source code and text files)
 */
export const INDEXABLE_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyw', '.pyi',
  // Java/JVM
  '.java', '.kt', '.kts', '.scala', '.groovy',
  // C/C++
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
  // C#
  '.cs',
  // Go
  '.go',
  // Rust
  '.rs',
  // Ruby
  '.rb', '.rake', '.gemspec',
  // PHP
  '.php',
  // Swift/Objective-C
  '.swift', '.m', '.mm', '.h',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.vue', '.svelte',
  // Config/Data
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.xml', '.svg',
  // Shell
  '.sh', '.bash', '.zsh', '.fish',
  // Other
  '.md', '.rst', '.txt', '.sql',
  '.proto', '.graphql', '.gql',
  '.dockerfile', '.makefile', '.cmake',
]);

/**
 * Directories to skip during indexing
 */
export const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target',
  'build',
  'dist',
  'out',
  '.next',
  '.nuxt',
  'vendor',
  'Pods',
  '.gradle',
  '.idea',
  '.vscode',
  '.aider-desk',
]);

/**
 * Files to skip (by name pattern)
 */
export const SKIP_FILE_PATTERNS = [
  /\.min\.js$/,
  /\.min\.css$/,
  /\.bundle\.js$/,
  /-lock\.json$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.d\.ts$/,
];

/**
 * Maximum file size to index (in bytes) - 1MB
 */
export const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Debounce delay for reindexing (in ms)
 */
export const REINDEX_DEBOUNCE_MS = 2000;
