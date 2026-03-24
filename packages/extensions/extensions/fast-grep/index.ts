/**
 * Main entry point for fast-grep extension
 *
 * Replaces internal power---grep tool with advanced sparse n-gram indexing
 * for significantly faster regex searches in large codebases
 */

import type { Extension, ExtensionContext, ProjectStartedEvent, ToolDefinition } from '@aiderdesk/extensions';
import { z } from 'zod';
import { debounce } from 'lodash';
import chokidar, { type FSWatcher } from 'chokidar';

import { IndexManager } from './index-manager';
import { Searcher } from './searcher';
import { REINDEX_DEBOUNCE_MS } from './constants';
import type { SearchResult } from './types';

export const metadata = {
  name: 'fast-grep',
  version: '1.0.0',
  description: 'Fast regex search using sparse n-gram indexing for significantly faster searches in large codebases, replacing the internal Power grep tool',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/fast-grep/icon.png',
  author: 'wladimiiir',
  capabilities: ['tools', 'indexing'],
};

/**
 * Per-project state container
 */
interface ProjectState {
  indexManager: IndexManager;
  searcher: Searcher;
  debouncedReindex: ReturnType<typeof debounce>;
  watcher: FSWatcher | null;
  log: (message: string, level: 'info' | 'error' | 'warn') => void;
  isIndexing: boolean;
}

// Map of project directories to their state
const projectStates = new Map<string, ProjectState>();

/**
 * Get or create project state, initializing on-demand if needed
 */
const getProjectState = (projectDir: string, context: ExtensionContext): ProjectState => {
  let state = projectStates.get(projectDir);

  if (!state) {
    const log = context.log.bind(context);
    const indexManager = new IndexManager(projectDir, log);
    const searcher = new Searcher(indexManager, indexManager['weightFn']);
    const debouncedReindex = debounce(
      async () => {
        const currentState = projectStates.get(projectDir);
        if (!currentState || currentState.isIndexing) return;

        currentState.isIndexing = true;
        try {
          await currentState.indexManager.indexFiles();
          log('[fast-grep] index rebuilt', 'info');
        } catch (error) {
          log(`[fast-grep] error during reindex: ${error}`, 'error');
        } finally {
          currentState.isIndexing = false;
        }
      },
      REINDEX_DEBOUNCE_MS
    );

    state = {
      indexManager,
      searcher,
      debouncedReindex,
      watcher: null,
      log,
      isIndexing: false,
    };

    projectStates.set(projectDir, state);
  }

  return state;
};

/**
 * Set up file watcher for a project directory
 */
const setupWatcher = (projectDir: string, state: ProjectState): void => {
  if (state.watcher) {
    return;
  }

  const watcher = chokidar.watch(projectDir, {
    ignored: [
      /node_modules/,
      /\.git/,
      /__pycache__/,
      /\.pytest_cache/,
      /\.mypy_cache/,
      /target/,
      /build/,
      /dist/,
      /out/,
      /\.next/,
      /\.nuxt/,
      /vendor/,
      /Pods/,
      /\.gradle/,
      /\.idea/,
      /\.vscode/,
      /\.aider-desk/,
      /\.min\.js$/,
      /\.min\.css$/,
      /\.bundle\.js$/,
      /-lock\.json$/,
      /package-lock\.json$/,
      /yarn\.lock/,
      /pnpm-lock\.yaml/,
      /\.d\.ts$/,
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath: string) => {
    state.log(`[fast-grep] file added: ${filePath}`, 'info');
    state.debouncedReindex();
  });

  watcher.on('change', (filePath: string) => {
    state.log(`[fast-grep] file changed: ${filePath}`, 'info');
    state.debouncedReindex();
  });

  watcher.on('unlink', (filePath: string) => {
    state.log(`[fast-grep] file removed: ${filePath}`, 'info');
    state.debouncedReindex();
  });

  watcher.on('error', (error: unknown) => {
    state.log(`[fast-grep] watcher error: ${error}`, 'error');
  });

  state.watcher = watcher;
  state.log('[fast-grep] file watcher started', 'info');
};

/**
 * Initialize index for a project (non-blocking)
 */
const initializeProjectIndex = async (projectDir: string, context: ExtensionContext): Promise<void> => {
  const state = getProjectState(projectDir, context);

  if (state.isIndexing) {
    return;
  }

  state.isIndexing = true;
  try {
    await state.indexManager.indexFiles();
    state.log('[fast-grep] index built', 'info');
  } catch (error) {
    state.log(`[fast-grep] error during initial indexing: ${error}`, 'error');
  } finally {
    state.isIndexing = false;
  }
};

export default class FastGrepExtension implements Extension {
  async onUnload(): Promise<void> {
    for (const state of projectStates.values()) {
      state.debouncedReindex.cancel();
      if (state.watcher) {
        await state.watcher.close();
      }
      await state.indexManager.clear();
    }
    projectStates.clear();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    const state = getProjectState(event.baseDir, context);
    setupWatcher(event.baseDir, state);
    void initializeProjectIndex(event.baseDir, context);
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'power---grep',
        description: 'Searches file content using regular expressions with context. Uses sparse n-gram indexing for fast searches in large codebases.',
        inputSchema: z.object({
          filePattern: z.string().describe('A glob pattern specifying the files to search within (e.g., src/**/*.tsx, *.py).'),
          searchTerm: z.string().describe('The regular expression to search for within the files.'),
          contextLines: z.number().int().min(0).optional().default(0).describe('The number of lines of context to show before and after each matching line. Default: 0.'),
          caseSensitive: z.boolean().optional().default(false).describe('Whether the search should be case sensitive. Default: false.'),
          maxResults: z.number().int().min(1).optional().default(50).describe('Maximum number of results to return. Default: 50.'),
        }),
        execute: async (input, signal, context) => {
          const typedInput = input as { filePattern: string; searchTerm: string; contextLines: number; caseSensitive: boolean; maxResults: number };
          return await this.executeGrep(typedInput, signal, context);
        },
      },
    ];
  }

  private async executeGrep(
    input: { filePattern: string; searchTerm: string; contextLines: number; caseSensitive: boolean; maxResults: number },
    signal?: AbortSignal,
    context?: ExtensionContext
  ): Promise<string | SearchResult[]> {
    const projectDir = context?.getProjectDir();

    if (!projectDir) {
      return 'Error: No project directory available';
    }

    // Get or create project state (on-demand initialization)
    const state = getProjectState(projectDir, context!);

    // Initialize index if not yet indexed
    if (!state.indexManager.isIndexed() && !state.isIndexing) {
      state.isIndexing = true;
      try {
        await state.indexManager.indexFiles();
        state.log('[fast-grep] index built on-demand', 'info');
      } catch (error) {
        state.log(`[fast-grep] error during on-demand indexing: ${error}`, 'error');
      } finally {
        state.isIndexing = false;
      }
    }

    try {
      const results = await state.searcher.search(
        input.searchTerm,
        input.caseSensitive,
        input.filePattern,
        input.maxResults,
        input.contextLines,
        signal
      );

      if (results.length === 0) {
        return `No matches found for pattern '${input.searchTerm}' in files matching '${input.filePattern}'.`;
      }

      return results;
    } catch (error) {
      if (signal?.aborted) {
        return 'Operation was cancelled by user.';
      }

      return `Error during grep: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
