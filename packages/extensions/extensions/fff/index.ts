import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { FileFinder, type GrepResult } from '@ff-labs/fff-node';

import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';

export const metadata = {
  name: 'fff',
  version: '1.3.0',
  description: 'Fast file content search using FFF (Freakin Fast File Finder) — replaces the internal grep tool',
  iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/fff/icon.png',
  author: 'wladimiiir',
  capabilities: ['tools', 'search'],
};

const inputSchema = z.object({
  filePattern: z.string().describe('A glob pattern specifying the files to search within (e.g., src/**/*.tsx, *.py).'),
  searchTerm: z.string().describe('The regular expression to search for within the files.'),
  contextLines: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('The number of lines of context to show before and after each matching line. Default: 0.'),
  caseSensitive: z.boolean().optional().default(false).describe('Whether the search should be case sensitive. Default: false.'),
  maxResults: z.number().int().min(1).optional().default(50).describe('Maximum number of results to return. Default: 50.'),
});

type GrepInput = z.infer<typeof inputSchema>;

interface GrepMatchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  context?: string[];
}

const buildFffQuery = (input: GrepInput): string => {
  const { filePattern, searchTerm } = input;

  if (!filePattern || filePattern === '**/*' || filePattern === '*' || filePattern === '.') {
    return searchTerm;
  }

  return `${filePattern} ${searchTerm}`;
};

/** Cache file contents to avoid re-reading the same file for multiple matches */
const fileContentCache = new Map<string, string[]>();

const clearFileCache = (): void => {
  fileContentCache.clear();
};

const formatGrepResultsAsMarkdown = (
  results: GrepMatchResult[],
  searchTerm: string,
  filePattern: string,
  maxResults: number,
): string => {
  // Group results by file path
  const grouped: Record<string, GrepMatchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.filePath]) {
      grouped[r.filePath] = [];
    }
    grouped[r.filePath].push(r);
  }

  const lines: string[] = [];
  lines.push(`## Grep Results: \`${searchTerm}\` in \`${filePattern}\` (${results.length} matches)`);
  lines.push('');

  for (const [filePath, matches] of Object.entries(grouped)) {
    lines.push(`### ${filePath} (${matches.length} ${matches.length === 1 ? 'match' : 'matches'})`);
    for (const match of matches) {
      const escapedContent = match.lineContent.replace(/`/g, '\\`');
      lines.push(`- **L${match.lineNumber}:** \`${escapedContent}\``);
      if (match.context && match.context.length > 0) {
        lines.push('  ```');
        for (const ctxLine of match.context) {
          // Strip line number prefix (format: "123|content" → "content")
          const content = ctxLine.replace(/^\d+\|/, '');
          lines.push(`  ${content}`);
        }
        lines.push('  ```');
      }
    }
    lines.push('');
  }

  const notices: string[] = [];
  if (results.length >= maxResults) {
    notices.push(`${maxResults} matches limit reached. Use maxResults=${maxResults * 2} for more, or refine pattern`);
  }
  if (notices.length > 0) {
    lines.push('---');
    lines.push(`[${notices.join('. ')}]`);
  }

  return lines.join('\n');
};

const getCachedLines = (projectDir: string, relativePath: string): string[] | null => {
  const cacheKey = `${projectDir}/${relativePath}`;
  let lines = fileContentCache.get(cacheKey);
  if (!lines) {
    try {
      const content = readFileSync(cacheKey, 'utf-8');
      lines = content.split('\n');
      fileContentCache.set(cacheKey, lines);
    } catch {
      return null;
    }
  }
  return lines;
};

const convertGrepResults = (
  result: GrepResult,
  maxResults: number,
  projectDir: string,
  contextLineCount: number,
): GrepMatchResult[] => {
  // Clear cache for each new search batch
  clearFileCache();

  const items = result.items.slice(0, maxResults);

  return items.map((match) => {
    const contextLines: string[] = [];

    if (contextLineCount > 0) {
      const allLines = getCachedLines(projectDir, match.relativePath);
      const matchIdx = match.lineNumber - 1; // 1-based → 0-based

      if (allLines) {
        // Before-context (each with 1-based line number)
        const beforeStart = Math.max(0, matchIdx - contextLineCount);
        for (let i = beforeStart; i < matchIdx; i++) {
          contextLines.push(`${i + 1}|${allLines[i] ?? ''}`);
        }

        // Matched line (with line number prefix)
        contextLines.push(`${match.lineNumber}|${match.lineContent}`);

        // After-context (each with 1-based line number)
        const afterEnd = Math.min(allLines.length, matchIdx + 1 + contextLineCount);
        for (let i = matchIdx + 1; i < afterEnd; i++) {
          contextLines.push(`${i + 1}|${allLines[i] ?? ''}`);
        }
      }
    }

    return {
      filePath: match.relativePath,
      lineNumber: match.lineNumber,
      lineContent: match.lineContent,
      ...(contextLines.length > 1 ? { context: contextLines } : {}),
    };
  });
};

export default class FffExtension implements Extension {
  static metadata = metadata;

  private finders = new Map<string, FileFinder>();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('[fff] extension loaded', 'info');

    if (!FileFinder.isAvailable()) {
      context.log('[fff] native library not available — fff will be disabled', 'error');
    }
  }

  async onUnload(): Promise<void> {
    for (const finder of this.finders.values()) {
      finder.destroy();
    }
    this.finders.clear();
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'power---grep',
        description: 'Searches file content using regular expressions with context. Uses FFF (Freakin Fast File Finder) for fast searches in large codebases.',
        inputSchema,
        execute: async (input, signal, context) => {
          return this.executeGrep(input as GrepInput, signal, context);
        },
      },
    ];
  }

  private async executeGrep(input: GrepInput, _signal: AbortSignal | undefined, context: ExtensionContext): Promise<string> {
    const taskContext = context.getTaskContext();
    const projectDir = taskContext?.getTaskDir() ?? context.getProjectDir();

    if (!projectDir) {
      return 'Error: No project directory available.';
    }

    if (!FileFinder.isAvailable()) {
      return 'Error: FFF native library not available.';
    }

    let finder = this.finders.get(projectDir);
    if (!finder) {
      try {
        context.log(`[fff] initializing finder for project: ${projectDir}`, 'info');
        const createResult = await FileFinder.create({ basePath: projectDir, aiMode: true });

        if (!createResult.ok || !createResult.value) {
          return `Error: Failed to create FFF finder: ${createResult.error ?? 'unknown error'}`;
        }

        const scanResult = await createResult.value.waitForScan(30_000);

        if (!scanResult.ok || !scanResult.value) {
          return `Error: FFF file scan did not complete in time — try again later`;
        }

        finder = createResult.value;
        this.finders.set(projectDir, finder);
        context.log(`[fff] project indexed successfully: ${projectDir}`, 'info');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `Error: Failed to initialize FFF finder: ${errorMsg}`;
      }
    }

    const query = buildFffQuery(input);

    context.log(`[fff] executing grep: "${query}" in ${projectDir}`, 'info');

    try {
      // Do NOT request context from FFF — its FFI binding has a struct layout
      // bug that causes contextBefore/contextAfter to return garbage (U+FFFD
      // replacement chars, random memory fragments). We read context from disk
      // ourselves in convertGrepResults() instead.
      const grepResult = await finder.grep(query, {
        mode: 'regex',
        beforeContext: 0,
        afterContext: 0,
        maxMatchesPerFile: input.maxResults,
        smartCase: !input.caseSensitive,
      });

      if (!grepResult.ok || !grepResult.value?.items || grepResult.value.items.length === 0) {
        return `No matches found for pattern '${input.searchTerm}' in files matching '${input.filePattern}'.`;
      }

      const results = convertGrepResults(grepResult.value, input.maxResults, projectDir, input.contextLines);
      return formatGrepResultsAsMarkdown(results, input.searchTerm, input.filePattern, input.maxResults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Error during fff search: ${errorMsg}`;
    }
  }
}
