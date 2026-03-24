/**
 * index-manager.ts
 *
 * Manages the sparse n-gram index lifecycle with memory-mapped file support.
 *
 * Architecture (based on Cursor's blog):
 * - Lookup table: memory-mapped sorted array of [hash, offset, count] entries
 * - Postings file: sequential posting lists, read on-demand at specific offsets
 * - Minimal memory footprint even for large codebases
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

import { glob } from 'glob';
import simpleGit from 'simple-git';

import type { IndexMetadata, FileEntry } from './types';
import {
  INDEX_DIR_NAME,
  INDEX_SUBDIR,
  METADATA_FILE,
  FILES_FILE,
  LOOKUP_FILE,
  POSTINGS_FILE,
  INDEX_VERSION,
  MAX_NGRAMS_PER_FILE,
  LOOKUP_ENTRY_SIZE,
  POSTING_ENTRY_SIZE,
} from './types';
import { MAX_FILE_SIZE } from './constants';
import {
  INDEXABLE_EXTENSIONS,
  SKIP_DIRECTORIES,
  SKIP_FILE_PATTERNS,
} from './constants';
import { hashNgram, extractSparseNgrams } from './indexer';
import type { WeightFunction } from './types';
import { createWeightFunction } from './constants';

export class IndexManager {
  private indexDir: string;
  private metadataPath: string;
  private filesPath: string;
  private lookupPath: string;
  private postingsPath: string;

  private metadata: IndexMetadata | null = null;
  private files: Map<number, FileEntry> = new Map();
  private filePathToId: Map<string, number> = new Map();

  // Memory-mapped lookup table buffer
  private lookupBuffer: Buffer | null = null;
  private lookupEntryCount = 0;

  // File descriptor for postings (kept open for on-demand reads)
  private postingsFd: number | null = null;

  weightFn: WeightFunction;
  private projectDir: string;
  private log: (message: string, level: 'info' | 'error' | 'warn') => void;

  constructor(projectDir: string, log: (message: string, level: 'info' | 'error' | 'warn') => void) {
    this.projectDir = projectDir;
    this.log = log;
    this.weightFn = createWeightFunction();

    this.indexDir = path.join(projectDir, INDEX_DIR_NAME, INDEX_SUBDIR);
    this.metadataPath = path.join(this.indexDir, METADATA_FILE);
    this.filesPath = path.join(this.indexDir, FILES_FILE);
    this.lookupPath = path.join(this.indexDir, LOOKUP_FILE);
    this.postingsPath = path.join(this.indexDir, POSTINGS_FILE);
  }

  getProjectDir(): string {
    return this.projectDir;
  }

  async indexFiles(files?: string[]): Promise<void> {
    // Ensure index directory exists
    await fs.mkdir(this.indexDir, { recursive: true });

    // Find files to index
    const filesToIndex = files || await this.findIndexableFiles();

    // Build index
    await this.buildIndex(filesToIndex);

    // Load the newly built index into memory-mapped mode
    await this.loadIndex();
  }

  private async findIndexableFiles(): Promise<string[]> {
    const files = await glob('**/*', {
      cwd: this.projectDir,
      nodir: true,
      absolute: true,
      ignore: Array.from(SKIP_DIRECTORIES).map(d => `**/${d}/**`),
    });

    const filtered = files.filter(file => this.shouldIndex(file));
    return filtered;
  }

  private shouldIndex(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (!INDEXABLE_EXTENSIONS.has(ext)) {
      // Check for files without extensions
      const basename = path.basename(filePath).toLowerCase();
      if (basename === 'dockerfile' || basename === 'makefile' || basename === 'license') {
        return true;
      }
      return false;
    }

    const basename = path.basename(filePath);
    for (const pattern of SKIP_FILE_PATTERNS) {
      if (pattern.test(basename)) {
        return false;
      }
    }

    const relativePath = path.relative(this.projectDir, filePath);
    const parts = relativePath.split(path.sep);
    for (const part of parts) {
      if (SKIP_DIRECTORIES.has(part)) {
        return false;
      }
    }

    return true;
  }

  private async buildIndex(files: string[]): Promise<void> {
    this.log(`[fast-grep] indexing ${files.length} files for project ${this.projectDir}...`, 'info');

    // Clear existing state
    this.files.clear();
    this.filePathToId.clear();

    // Close existing postings fd if open
    if (this.postingsFd !== null) {
      fsSync.closeSync(this.postingsFd);
      this.postingsFd = null;
    }
    this.lookupBuffer = null;
    this.lookupEntryCount = 0;

    let fileId = 0;
    // Temporary in-memory structure for building
    const allNgrams: Map<number, Set<number>> = new Map();

    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile() || stats.size > MAX_FILE_SIZE) {
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        if (!content) {
          continue;
        }

        const id = fileId++;
        const hash = createHash('md5').update(content).digest('hex');

        this.files.set(id, {
          id,
          path: path.relative(this.projectDir, filePath),
          size: stats.size,
          hash,
        });
        this.filePathToId.set(filePath, id);

        // Extract sparse n-grams
        const ngrams = extractSparseNgrams(content, this.weightFn);

        let ngramCount = 0;
        for (const { ngram } of ngrams) {
          if (ngramCount >= MAX_NGRAMS_PER_FILE) {
            break;
          }

          const ngramHash = hashNgram(ngram);
          if (!allNgrams.has(ngramHash)) {
            allNgrams.set(ngramHash, new Set());
          }
          allNgrams.get(ngramHash)!.add(id);
          ngramCount++;
        }
      } catch (error) {
        this.log(`[fast-grep] error indexing ${filePath}: ${error}`, 'error');
      }
    }

    // Sort hashes for binary search
    const sortedHashes = Array.from(allNgrams.keys()).sort((a, b) => a - b);

    // Build binary lookup table and postings file
    const lookupBuffer = Buffer.alloc(sortedHashes.length * LOOKUP_ENTRY_SIZE);
    const postingsChunks: Buffer[] = [];
    let currentOffset = 0;

    for (let i = 0; i < sortedHashes.length; i++) {
      const hash = sortedHashes[i];
      const fileIds = Array.from(allNgrams.get(hash)!).sort((a, b) => a - b);

      // Write lookup entry: hash (4) + offset (4) + count (4)
      const lookupOffset = i * LOOKUP_ENTRY_SIZE;
      lookupBuffer.writeUInt32LE(hash, lookupOffset);
      lookupBuffer.writeUInt32LE(currentOffset, lookupOffset + 4);
      lookupBuffer.writeUInt32LE(fileIds.length, lookupOffset + 8);

      // Build postings chunk: sequential fileIds
      const postingBuffer = Buffer.alloc(fileIds.length * POSTING_ENTRY_SIZE);
      for (let j = 0; j < fileIds.length; j++) {
        postingBuffer.writeUInt32LE(fileIds[j], j * POSTING_ENTRY_SIZE);
      }
      postingsChunks.push(postingBuffer);

      currentOffset += fileIds.length * POSTING_ENTRY_SIZE;
    }

    // Save metadata
    await this.saveMetadata({
      version: INDEX_VERSION,
      projectDir: this.projectDir,
      baseCommitHash: await this.getGitCommitHash(),
      fileCount: this.files.size,
      totalSize: Array.from(this.files.values()).reduce((sum, f) => sum + f.size, 0),
      createdAt: this.metadata?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });

    // Save files list
    await this.saveFiles();

    // Write binary lookup table
    await fs.writeFile(this.lookupPath, lookupBuffer);

    // Write binary postings file
    const postingsBuffer = Buffer.concat(postingsChunks);
    await fs.writeFile(this.postingsPath, postingsBuffer);

    this.log(`[fast-grep] indexed ${this.files.size} files, ${sortedHashes.length} unique n-grams`, 'info');
  }

  /**
   * Load index into memory-mapped mode for efficient queries
   */
  private async loadIndex(): Promise<void> {
    try {
      // Load metadata
      const metadataContent = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(metadataContent);

      // Load files list
      await this.loadFiles();

      // Memory-map the lookup table (read entire file into buffer)
      const lookupStats = await fs.stat(this.lookupPath);
      this.lookupBuffer = await fs.readFile(this.lookupPath);
      this.lookupEntryCount = Math.floor(lookupStats.size / LOOKUP_ENTRY_SIZE);

      // Open postings file descriptor for on-demand reads
      this.postingsFd = fsSync.openSync(this.postingsPath, 'r');

      this.log(`[fast-grep] loaded index: ${this.lookupEntryCount} n-grams, ${this.files.size} files for project ${this.projectDir}`, 'info');
    } catch (error) {
      this.log(`[fast-grep] error loading index for project ${this.projectDir}: ${error}`, 'error');
      // Reset state on error
      this.lookupBuffer = null;
      this.lookupEntryCount = 0;
      if (this.postingsFd !== null) {
        fsSync.closeSync(this.postingsFd);
        this.postingsFd = null;
      }
    }
  }

  /**
   * Search for files containing an n-gram using binary search
   */
  searchNgram(ngram: string): number[] | null {
    if (!this.lookupBuffer || this.postingsFd === null) {
      return null;
    }

    const hash = hashNgram(ngram);

    // Binary search in lookup table
    let left = 0;
    let right = this.lookupEntryCount - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const offset = mid * LOOKUP_ENTRY_SIZE;
      const entryHash = this.lookupBuffer.readUInt32LE(offset);

      if (entryHash === hash) {
        // Found! Read posting list offset and count
        const postingOffset = this.lookupBuffer.readUInt32LE(offset + 4);
        const postingCount = this.lookupBuffer.readUInt32LE(offset + 8);

        // Read postings synchronously (blocking but fast for small reads)
        return this.readPostingsSync(postingOffset, postingCount);
      } else if (entryHash < hash) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return null; // Not found
  }

  /**
   * Read posting list from disk at specific offset
   */
  private readPostingsSync(offset: number, count: number): number[] {
    if (this.postingsFd === null) {
      return [];
    }

    const buffer = Buffer.alloc(count * POSTING_ENTRY_SIZE);

    try {
      const bytesRead = fsSync.readSync(this.postingsFd, buffer, 0, buffer.length, offset);

      if (bytesRead !== buffer.length) {
        return [];
      }

      const fileIds: number[] = [];
      for (let i = 0; i < count; i++) {
        fileIds.push(buffer.readUInt32LE(i * POSTING_ENTRY_SIZE));
      }
      return fileIds;
    } catch {
      return [];
    }
  }

  getFile(id: number): FileEntry | undefined {
    return this.files.get(id);
  }

  getStats(): { isIndexed: boolean; fileCount: number; lastCommitHash: string | null; lastUpdated: number | null } {
    return {
      isIndexed: this.files.size > 0 && this.lookupBuffer !== null,
      fileCount: this.files.size,
      lastCommitHash: this.metadata?.baseCommitHash || null,
      lastUpdated: this.metadata?.updatedAt || null,
    };
  }

  isIndexed(): boolean {
    return this.files.size > 0 && this.lookupBuffer !== null;
  }

  async clear(): Promise<void> {
    this.files.clear();
    this.filePathToId.clear();
    this.lookupBuffer = null;
    this.lookupEntryCount = 0;
    this.metadata = null;

    if (this.postingsFd !== null) {
      fsSync.closeSync(this.postingsFd);
      this.postingsFd = null;
    }
  }

  private async getGitCommitHash(): Promise<string | null> {
    try {
      const git = simpleGit(this.projectDir);
      const log = await git.log(['-1', '--format=%H']);
      return log.latest?.hash || null;
    } catch {
      return null;
    }
  }

  private async saveMetadata(metadata: IndexMetadata): Promise<void> {
    this.metadata = metadata;
    await fs.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async saveFiles(): Promise<void> {
    const entries = Array.from(this.files.values());
    const data = entries.map(e => `${e.id}:${e.path}:${e.size}:${e.hash}`).join('\n');
    await fs.writeFile(this.filesPath, data);
  }

  private async loadFiles(): Promise<void> {
    try {
      const content = await fs.readFile(this.filesPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      this.files.clear();
      this.filePathToId.clear();

      for (const line of lines) {
        const [idStr, filePath, sizeStr, hash] = line.split(':');
        if (idStr && filePath && sizeStr && hash) {
          const id = parseInt(idStr, 10);
          const size = parseInt(sizeStr, 10);
          this.files.set(id, { id, path: filePath, size, hash });
          this.filePathToId.set(path.join(this.projectDir, filePath), id);
        }
      }
    } catch {
      // Files list doesn't exist yet
    }
  }
}
