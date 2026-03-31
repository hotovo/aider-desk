import { spawn, type ChildProcess } from 'node:child_process';

import { z } from 'zod';

import type { Extension, ExtensionContext, ProjectStartedEvent, ToolDefinition } from '@aiderdesk/extensions';

export const metadata = {
  name: 'seek',
  version: '1.0.0',
  description: 'Fast ranked code search using seek (zoekt) — replaces the internal grep tool',
  author: 'wladimiiir',
  icon: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/experimental/seek/icon.png',
  capabilities: ['tools', 'search'],
};

const SEEK_INSTALL_URL = 'https://raw.githubusercontent.com/dualeai/seek/main/install.sh';
const GO_INSTALL_CMD = 'go install github.com/dualeai/seek/cmd/seek@latest';
const CTAGS_INSTALL_MACOS = 'brew install universal-ctags';
const CTAGS_INSTALL_LINUX = 'sudo apt-get install universal-ctags';

const runningProcesses: Set<ChildProcess> = new Set();

const inputSchema = z.object({
  filePattern: z.string().describe('A glob pattern specifying the files to search within (e.g., src/**/*.tsx, *.py).'),
  searchTerm: z.string().describe('The regular expression to search for within the files.'),
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

const globToRegex = (glob: string): string | null => {
  if (glob === '**/*' || glob === '*' || glob === '.' || !glob) {
    return null;
  }

  // Extract brace expansions {a,b,c} before escaping and replace with placeholders
  const bracePatterns: string[] = [];
  const processed = glob.replace(/\{([^{}]+)\}/g, (_match, content: string) => {
    bracePatterns.push(content);
    return `__BRACE_${bracePatterns.length - 1}__`;
  });

  let regex = processed
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*')
    .replace(/\?/g, '[^/]');

  // Restore brace expansions as regex alternations (a|b|c)
  bracePatterns.forEach((content, index) => {
    const options = content.split(',').map((opt) => opt.replace(/[.+^${}()|[\]\\]/g, '\\$&'));
    regex = regex.replace(`__BRACE_${index}__`, `(${options.join('|')})`);
  });

  if (!regex.startsWith('.*')) {
    regex = '.*' + regex;
  }

  return regex;
};

const buildSeekQuery = (input: GrepInput): string => {
  const parts: string[] = [];

  parts.push(input.searchTerm);

  const fileRegex = globToRegex(input.filePattern);
  if (fileRegex) {
    parts.push(`file:${fileRegex}`);
  }

  parts.push(input.caseSensitive ? 'case:yes' : 'case:no');

  return parts.join(' ');
};

const parseSeekOutput = (output: string, searchTerm: string, caseSensitive: boolean): GrepMatchResult[] => {
  const results: GrepMatchResult[] = [];
  const flags = caseSensitive ? '' : 'i';

  let searchRegex: RegExp;
  try {
    searchRegex = new RegExp(searchTerm, flags);
  } catch {
    return results;
  }

  const fileBlocks = output.split(/\n(?=## )/);

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    if (lines.length === 0) {
      continue;
    }

    const headerMatch = lines[0]!.match(/^## (.+?)(?: \([^)]+\))?(?: \[uncommitted\])?$/);
    if (!headerMatch) {
      continue;
    }

    const filePath = headerMatch[1]!;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const lineMatch = line.match(/^(\s*\d+) (.*)$/);
      if (!lineMatch) {
        continue;
      }

      const lineNumber = parseInt(lineMatch[1]!.trim(), 10);
      const lineContent = lineMatch[2]!;

      if (searchRegex.test(lineContent)) {
        const contextLines: string[] = [];

        for (let j = Math.max(1, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          const ctxLine = lines[j]!;
          const ctxMatch = ctxLine.match(/^\s*(\d+) (.*)$/);
          if (ctxMatch) {
            contextLines.push(`${ctxMatch[1]}: ${ctxMatch[2]!}`);
          }
        }

        results.push({
          filePath,
          lineNumber,
          lineContent,
          ...(contextLines.length > 0 ? { context: contextLines } : {}),
        });
      }
    }
  }

  return results;
};

const execSeek = (query: string, cwd: string, signal?: AbortSignal): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
  return new Promise((resolve, reject) => {
    const child = spawn('seek', [query], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    runningProcesses.add(child);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const onAbort = () => {
      child.kill('SIGTERM');
      runningProcesses.delete(child);
      reject(new Error('Operation was cancelled by user.'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      runningProcesses.delete(child);
      reject(err);
    });

    child.on('close', (code) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      runningProcesses.delete(child);
      if (signal?.aborted) {
        reject(new Error('Operation was cancelled by user.'));
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });
  });
};

const tryInstallSeek = async (signal?: AbortSignal): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
      const installProcess = spawn('sh', ['-c', `curl -sSfL ${SEEK_INSTALL_URL} | sh`], {
        cwd: '/tmp',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      runningProcesses.add(installProcess);

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      installProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const onAbort = () => {
        installProcess.kill('SIGTERM');
        runningProcesses.delete(installProcess);
        reject(new Error('Installation was cancelled by user.'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      installProcess.on('error', (err) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        runningProcesses.delete(installProcess);
        reject(err);
      });

      installProcess.on('close', (code) => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        runningProcesses.delete(installProcess);
        resolve({ stdout, stderr, exitCode: code });
      });
    });

    if (result.exitCode === 0) {
      return { success: true };
    }

    return {
      success: false,
      error: `Auto-install failed (exit code ${result.exitCode}).\n${result.stderr || result.stdout}\n\nPlease install seek manually:\n  curl -sSfL ${SEEK_INSTALL_URL} | sh\n  or: ${GO_INSTALL_CMD}\n\nPrerequisites:\n  macOS:  ${CTAGS_INSTALL_MACOS}\n  Linux:  ${CTAGS_INSTALL_LINUX}`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Auto-install failed: ${errorMsg}\n\nPlease install seek manually:\n  curl -sSfL ${SEEK_INSTALL_URL} | sh\n  or: ${GO_INSTALL_CMD}\n\nPrerequisites:\n  macOS:  ${CTAGS_INSTALL_MACOS}\n  Linux:  ${CTAGS_INSTALL_LINUX}`,
    };
  }
};

const buildInstallErrorMessage = (): string => {
  return [
    'seek is not installed. Install it with:',
    `  curl -sSfL ${SEEK_INSTALL_URL} | sh`,
    `  or: ${GO_INSTALL_CMD}`,
    '',
    'Prerequisites:',
    `  macOS:  ${CTAGS_INSTALL_MACOS}`,
    `  Linux:  ${CTAGS_INSTALL_LINUX}`,
  ].join('\n');
};

const runSeekAndParse = async (input: GrepInput, projectDir: string, signal?: AbortSignal): Promise<string | GrepMatchResult[]> => {
  const query = buildSeekQuery(input);
  const result = await execSeek(query, projectDir, signal);

  if (result.exitCode === 2 || (result.exitCode !== 0 && result.exitCode !== 1 && result.stderr)) {
    const errorDetail = result.stderr || 'Unknown error';
    return `Error during seek search: ${errorDetail}`;
  }

  if (result.exitCode === 1) {
    return `No matches found for pattern '${input.searchTerm}' in files matching '${input.filePattern}'.`;
  }

  const output = result.stdout.trim();
  if (!output) {
    return `No matches found for pattern '${input.searchTerm}' in files matching '${input.filePattern}'.`;
  }

  const parsed = parseSeekOutput(output, input.searchTerm, input.caseSensitive);

  if (parsed.length === 0) {
    return `No matches found for pattern '${input.searchTerm}' in files matching '${input.filePattern}'.`;
  }

  if (parsed.length > input.maxResults) {
    return parsed.slice(0, input.maxResults);
  }

  return parsed;
};

export default class SeekExtension implements Extension {
  static metadata = metadata;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('[seek] extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    for (const child of runningProcesses) {
      child.kill('SIGTERM');
    }
    runningProcesses.clear();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    context.log(`[seek] project started: ${event.baseDir}`, 'info');
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'power---grep',
        description: 'Searches file content using regular expressions with context. Uses seek (zoekt) for fast, ranked searches in large codebases.',
        inputSchema,
        execute: async (input, signal, context) => {
          return this.executeGrep(input as GrepInput, signal, context);
        },
      },
    ];
  }

  private async executeGrep(input: GrepInput, signal: AbortSignal | undefined, context: ExtensionContext): Promise<string | GrepMatchResult[]> {
    const projectDir = context.getProjectDir();

    if (!projectDir) {
      return 'Error: No project directory available.';
    }

    context.log(`[seek] executing: seek "${buildSeekQuery(input)}" in ${projectDir}`, 'info');

    try {
      return await runSeekAndParse(input, projectDir, signal);
    } catch (err) {
      if (err instanceof Error && err.message === 'Operation was cancelled by user.') {
        return 'Operation was cancelled by user.';
      }

      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        context.log('[seek] binary not found, attempting auto-install...', 'info');

        const installResult = await tryInstallSeek(signal);
        if (installResult.success) {
          context.log('[seek] auto-install succeeded, retrying search...', 'info');

          try {
            return await runSeekAndParse(input, projectDir, signal);
          } catch (retryErr) {
            if (retryErr instanceof Error && retryErr.message === 'Operation was cancelled by user.') {
              return 'Operation was cancelled by user.';
            }
            const errorMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            return `Error after auto-install: ${errorMsg}`;
          }
        }

        return installResult.error || buildInstallErrorMessage();
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      return `Error during seek search: ${errorMsg}`;
    }
  }
}
