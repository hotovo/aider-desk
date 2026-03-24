/**
 * Sparse N-gram Indexer
 *
 * Implements the sparse n-gram extraction algorithm from Cursor's blog:
 * - Extracts variable-length n-grams where edge weights > all inner weights
 * - Uses frequency-based weight function for discriminative n-gram selection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

import { glob } from 'glob';
import ignore from 'ignore';

import type {
  FileEntry,
  IndexMetadata,
  IndexData,
  NgramEntry,
  PostingsEntry,
  SparseNgram,
  WeightFunction
} from './types';
import {
  INDEX_VERSION,
  MIN_NGRAM_LENGTH,
  MAX_NGRAM_LENGTH,
  MAX_NGRAMS_PER_FILE,
  HASH_MASK,
} from './types';
import {
  createWeightFunction,
  INDEXABLE_EXTENSIONS,
  SKIP_DIRECTORIES,
  SKIP_FILE_PATTERNS,
  MAX_FILE_SIZE,
} from './constants';

/**
 * Compute 32-bit hash of an n-gram string
 */
export const hashNgram = (ngram: string): number => {
  let hash = 5381;
  for (let i = 0; i < ngram.length; i++) {
    hash = ((hash << 5) + hash) ^ ngram.charCodeAt(i);
  }
  return hash >>> 0; // Ensure unsigned 32-bit
};

/**
 * Extract sparse n-grams from a string using the build_all algorithm.
 *
 * A sparse n-gram is a substring where the weights at both ends are
 * strictly greater than all weights inside the substring.
 */
export const extractSparseNgrams = (
  content: string,
  weightFn: WeightFunction,
  minLength = MIN_NGRAM_LENGTH,
  maxLength = MAX_NGRAM_LENGTH
): SparseNgram[] => {
  const ngrams: SparseNgram[] = [];
  const len = content.length;

  if (len < minLength) {
    return ngrams;
  }

  // Compute weights for all adjacent character pairs
  const weights: number[] = [];
  for (let i = 0; i < len - 1; i++) {
    weights.push(weightFn(content.slice(i, i + 2)));
  }

  // Extract sparse n-grams
  for (let start = 0; start < len; start++) {
    // Limit max length to remaining content
    const maxEnd = Math.min(start + maxLength, len);

    // Skip if not enough characters left
    if (start + minLength > len) {
      continue;
    }

    // Get weight at left edge (bigram starting at start)
    const leftWeight = weights[start] ?? Infinity;

    for (let end = start + minLength; end <= maxEnd; end++) {
      // Get weight at right edge (bigram ending at end-2)
      const rightWeight = weights[end - 2] ?? Infinity;

      // Check if all inner weights are strictly less than both edge weights
      let isSparse = true;
      const minInnerWeight = Math.min(leftWeight, rightWeight);

      for (let i = start + 1; i < end - 2; i++) {
        if (weights[i] !== undefined && weights[i] >= minInnerWeight) {
          isSparse = false;
          break;
        }
      }

      if (isSparse) {
        ngrams.push({
          ngram: content.slice(start, end),
          start,
          end,
        });
      }
    }
  }

  return ngrams;
};

/**
 * Extract minimal covering n-grams for a query string.
 * Uses the build_covering algorithm to minimize index lookups.
 */
export const extractCoveringNgrams = (
  content: string,
  weightFn: WeightFunction,
  minLength = MIN_NGRAM_LENGTH,
  maxLength = MAX_NGRAM_LENGTH
): SparseNgram[] => {
  const ngrams: SparseNgram[] = [];
  const len = content.length;

  if (len < minLength) {
    return ngrams;
  }

  // Compute weights
  const weights: number[] = [];
  for (let i = 0; i < len - 1; i++) {
    weights.push(weightFn(content.slice(i, i + 2)));
  }

  // Track which positions are covered
  const covered = new Array(len).fill(false);

  // Find local maxima (potential edge positions)
  const localMaxima: number[] = [];
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    const leftW = weights[i - 1] ?? -Infinity;
    const rightW = weights[i + 1] ?? -Infinity;

    if (w > leftW && w > rightW) {
      localMaxima.push(i);
    }
  }

  // Sort by weight (descending) to process most discriminative first
  localMaxima.sort((a, b) => weights[b] - weights[a]);

  // Build covering from local maxima
  for (const maxIdx of localMaxima) {
    // Try to extend left and right from this maximum
    const leftWeight = weights[maxIdx];

    // Find left edge
    let left = maxIdx;
    while (left > 0 && weights[left - 1] < leftWeight) {
      left--;
    }

    // Find right edge
    let right = maxIdx + 2; // At least 2 characters for n-gram
    while (right < len && weights[right - 1] < leftWeight) {
      right++;
    }

    // Ensure minimum length
    if (right - left >= minLength) {
      // Clamp to max length
      if (right - left > maxLength) {
        // Keep the side with the maximum
        if (maxIdx - left > right - maxIdx) {
          right = left + maxLength;
        } else {
          left = right - maxLength;
        }
      }

      // Check if this adds new coverage
      let addsCoverage = false;
      for (let i = left; i < right; i++) {
        if (!covered[i]) {
          addsCoverage = true;
          covered[i] = true;
        }
      }

      if (addsCoverage) {
        ngrams.push({
          ngram: content.slice(left, right),
          start: left,
          end: right,
        });
      }
    }

    // Early exit if fully covered
    if (covered.every(c => c)) {
      break;
    }
  }

  // If still not covered, add n-grams for uncovered regions
  let uncoveredStart = -1;
  for (let i = 0; i < len; i++) {
    if (!covered[i]) {
      if (uncoveredStart === -1) {
        uncoveredStart = i;
      }
    } else if (uncoveredStart !== -1) {
      // Add n-gram for uncovered region
      const end = Math.min(i, uncoveredStart + maxLength);
      if (end - uncoveredStart >= minLength) {
        ngrams.push({
          ngram: content.slice(uncoveredStart, end),
          start: uncoveredStart,
          end,
        });
      }
      uncoveredStart = -1;
    }
  }

  // Handle trailing uncovered region
  if (uncoveredStart !== -1 && len - uncoveredStart >= minLength) {
    ngrams.push({
      ngram: content.slice(uncoveredStart, Math.min(len, uncoveredStart + maxLength)),
      start: uncoveredStart,
      end: Math.min(len, uncoveredStart + maxLength),
    });
  }

  return ngrams;
};

/**
 * Indexer class for building and managing the sparse n-gram index
 */
export class Indexer {
  private weightFn: WeightFunction;
  private files: Map<number, FileEntry> = new Map();
  private filePathToId: Map<string, number> = new Map();
  private nextFileId = 0;

  // n-gram -> file IDs (for building)
  private ngramPostings: Map<number, Set<number>> = new Map();

  constructor() {
    this.weightFn = createWeightFunction();
  }

  /**
   * Check if a file should be indexed
   */
  private shouldIndexFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();

    // Check extension
    if (!INDEXABLE_EXTENSIONS.has(ext)) {
      // Also check files without extensions or special names
      const basename = path.basename(filePath).toLowerCase();
      if (basename === 'dockerfile' || basename === 'makefile' || basename === 'license') {
        return true;
      }
      return false;
    }

    // Check skip patterns
    for (const pattern of SKIP_FILE_PATTERNS) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a directory should be skipped
   */
  private shouldSkipDir(dirName: string): boolean {
    return SKIP_DIRECTORIES.has(dirName);
  }

  /**
   * Get file hash for change detection
   */
  private async getFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string, projectDir: string): Promise<void> {
    try {
      const stat = await fs.stat(filePath);

      // Skip large files
      if (stat.size > MAX_FILE_SIZE) {
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(projectDir, filePath);
      const hash = createHash('md5').update(content).digest('hex');

      // Assign file ID
      const fileId = this.nextFileId++;
      this.files.set(fileId, {
        id: fileId,
        path: relativePath,
        size: stat.size,
        hash,
      });
      this.filePathToId.set(relativePath, fileId);

      // Extract sparse n-grams
      const ngrams = extractSparseNgrams(content, this.weightFn);

      // Limit n-grams per file to prevent memory issues
      const limitedNgrams = ngrams.slice(0, MAX_NGRAMS_PER_FILE);

      // Add to postings
      for (const { ngram } of limitedNgrams) {
        const hash = hashNgram(ngram);
        if (!this.ngramPostings.has(hash)) {
          this.ngramPostings.set(hash, new Set());
        }
        this.ngramPostings.get(hash)!.add(fileId);
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }

  /**
   * Build index for a project directory
   */
  async buildIndex(projectDir: string, signal?: AbortSignal): Promise<IndexData> {
    // Reset state
    this.files.clear();
    this.filePathToId.clear();
    this.ngramPostings.clear();
    this.nextFileId = 0;

    // Load .gitignore if exists
    let ig = ignore();
    try {
      const gitignorePath = path.join(projectDir, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      ig = ignore().add(gitignoreContent);
    } catch {
      // No .gitignore, that's fine
    }

    // Find all indexable files
    const files = await glob('**/*', {
      cwd: projectDir,
      nodir: true,
      dot: false,
      ignore: Array.from(SKIP_DIRECTORIES).map(d => `**/${d}/**`),
      signal,
    });

    // Filter and index files
    const indexableFiles = files.filter(f => {
      // Check gitignore
      if (ig.ignores(f)) {
        return false;
      }
      // Check if should index
      return this.shouldIndexFile(f);
    });

    // Index files in parallel batches
    const batchSize = 50;
    for (let i = 0; i < indexableFiles.length; i += batchSize) {
      if (signal?.aborted) {
        throw new Error('Indexing aborted');
      }

      const batch = indexableFiles.slice(i, i + batchSize);
      await Promise.all(
        batch.map(f => this.indexFile(path.join(projectDir, f), projectDir))
      );
    }

    // Build metadata
    const metadata: IndexMetadata = {
      version: INDEX_VERSION,
      projectDir,
      baseCommitHash: null, // Will be set by IndexManager
      fileCount: this.files.size,
      totalSize: Array.from(this.files.values()).reduce((sum, f) => sum + f.size, 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Build n-gram table (sorted by hash for binary search)
    const ngramTable: NgramEntry[] = [];
    let offset = 0;

    const sortedHashes = Array.from(this.ngramPostings.keys()).sort((a, b) => a - b);

    for (const hash of sortedHashes) {
      const fileIds = this.ngramPostings.get(hash)!;
      ngramTable.push({
        hash,
        offset,
        count: fileIds.size,
      });
      // Each posting: fileId (4 bytes) + position count placeholder
      offset += fileIds.size * 4;
    }

    return {
      metadata,
      files: this.files,
      filePathToId: this.filePathToId,
      ngramTable,
    };
  }

  /**
   * Get postings data for serialization
   */
  getPostingsData(): Map<number, Set<number>> {
    return this.ngramPostings;
  }
}

/**
 * Calculate file hash quickly
 */
export const calculateFileHash = async (filePath: string): Promise<string> => {
  const content = await fs.readFile(filePath);
  return createHash('md5').update(content).digest('hex');
};
