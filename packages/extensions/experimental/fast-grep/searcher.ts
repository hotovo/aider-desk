/**
 * searcher.ts
 *
 * Search functionality for the sparse n-gram index
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { SearchResult, WeightFunction, SparseNgram } from './types';
import type { IndexManager } from './index-manager';
import { extractSparseNgrams } from './indexer';

export class Searcher {
  constructor(
    private indexManager: IndexManager,
    private weightFn: WeightFunction
  ) {}

  async search(
    searchTerm: string,
    caseSensitive: boolean,
    filePattern: string,
    maxResults: number,
    contextLines: number,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const stats = this.indexManager.getStats();

    if (!stats.isIndexed || stats.fileCount === 0) {
      throw new Error('Search index not available. Please wait for indexing to complete or check extension logs.');
    }

    const candidates = await this.searchWithIndex(searchTerm, caseSensitive, filePattern);
    if (!candidates || candidates.size === 0) {
      return [];
    }

    return await this.searchInCandidates(
      Array.from(candidates),
      searchTerm,
      caseSensitive,
      maxResults,
      contextLines,
      signal
    );
  }

  private async searchWithIndex(
    searchTerm: string,
    caseSensitive: boolean,
    filePattern: string
  ): Promise<Set<string> | null> {
    try {
      const ngrams = parseRegexToNgrams(searchTerm, this.weightFn, 2, 32);
      if (ngrams.length === 0) {
        return null;
      }

      const candidateSets: Set<string>[] = [];

      for (const { ngram } of ngrams) {
        const files = this.indexManager.searchNgram(ngram);
        if (files && files.length > 0) {
          candidateSets.push(new Set(files.map(id => this.indexManager.getFile(id)?.path).filter(Boolean) as string[]));
        }
      }

      if (candidateSets.length === 0) {
        return null;
      }

      const candidates = this.intersectSets(candidateSets);
      if (candidates.size === 0) {
        return null;
      }

      const filtered = await this.filterByPattern(candidates, filePattern);
      return filtered;
    } catch (error) {
      return null;
    }
  }

  private async filterByPattern(files: Set<string>, pattern: string): Promise<Set<string>> {
    if (pattern === '**/*' || pattern === '*') {
      return files;
    }

    const matched = new Set<string>();

    for (const f of files) {
      try {
        if (minimatch(f, pattern)) {
          matched.add(f);
        }
      } catch {
        // Ignore errors
      }
    }

    return matched;
  }

  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) {
      return new Set<string>();
    }

    const first = sets[0];
    if (!first) {
      return new Set<string>();
    }

    let result = new Set(first);

    for (const current of sets.slice(1)) {
      const intersection = new Set<string>();
      for (const f of current) {
        if (result.has(f)) {
          intersection.add(f);
        }
      }
      result = intersection;
    }

    return result;
  }

  private async searchInCandidates(
    candidates: string[],
    searchTerm: string,
    caseSensitive: boolean,
    maxResults: number,
    contextLines: number,
    signal?: AbortSignal
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const projectDir = this.indexManager.getProjectDir();
    
    // Sort candidates to ensure consistent ordering (shorter paths first for better diversity)
    const sortedCandidates = [...candidates].sort((a, b) => a.localeCompare(b));

    fileLoop: for (const relativePath of sortedCandidates) {
      if (signal?.aborted) {
        break;
      }
      
      if (results.length >= maxResults) {
        break;
      }

      const filePath = path.join(projectDir, relativePath);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const flags = caseSensitive ? 'g' : 'gi';
        const searchRegex = new RegExp(searchTerm, flags);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (searchRegex.test(line)) {
            if (results.length >= maxResults) {
              break fileLoop;
            }

            const match: SearchResult = {
              filePath: relativePath,
              lineNumber: i + 1,
              lineContent: line,
            };

            if (contextLines > 0) {
              const start = Math.max(0, i - contextLines);
              const end = Math.min(lines.length - 1, i + contextLines);
              match.context = lines.slice(start, end + 1);
            }

            results.push(match);

            // Reset regex lastIndex for global flag
            searchRegex.lastIndex = 0;
          }
        }
      } catch {
        // Continue with next file
      }
    }

    return results;
  }
}

/**
 * Parse regex into n-grams for index lookup
 */
function parseRegexToNgrams(
  pattern: string,
  weightFn: WeightFunction,
  minLength: number,
  maxLength: number
): SparseNgram[] {
  // Simple literal extraction from regex
  // For complex regexes, this returns empty array (no matches will be found)
  const ngrams: SparseNgram[] = [];

  // Try to extract literal strings from the regex
  const literals = extractLiterals(pattern);

  for (const literal of literals) {
    if (literal.length >= minLength) {
      const sparse = extractSparseNgrams(literal, weightFn, minLength, maxLength);
      ngrams.push(...sparse);
    }
  }

  return ngrams;
}

/**
 * Extract literal strings from regex pattern
 */
function extractLiterals(pattern: string): string[] {
  const literals: string[] = [];
  let current = '';
  let inClass = false;
  let escaped = false;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (!char) continue;

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '[') {
      if (current.length >= 2) {
        literals.push(current);
      }
      current = '';
      inClass = true;
      continue;
    }

    if (char === ']') {
      inClass = false;
      continue;
    }

    if (inClass) {
      continue;
    }

    if (char === '^' || char === '$' || char === '.' || char === '|' ||
        char === '?' || char === '*' || char === '+' ||
        char === '(' || char === ')' || char === '{') {
      if (current.length >= 2) {
        literals.push(current);
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length >= 2) {
    literals.push(current);
  }

  return literals;
}

// Minimal minimatch implementation for glob patterns
function minimatch(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '<<DOUBLESTAR>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<DOUBLESTAR>>/g, '.*')
    .replace(/\?/g, '[^/]')
    .replace(/\[!/g, '[^')
    .replace(/\[/g, '[');

  try {
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  } catch {
    return false;
  }
}
