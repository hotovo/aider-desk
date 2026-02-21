import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { glob } from 'glob';
import { AgentProfile, BashToolSettings, FileWriteMode, PromptContext, ToolApprovalState } from '@common/types';
import {
  POWER_TOOL_BASH as TOOL_BASH,
  POWER_TOOL_DESCRIPTIONS,
  POWER_TOOL_FETCH as TOOL_FETCH,
  POWER_TOOL_FILE_EDIT as TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ as TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE as TOOL_FILE_WRITE,
  POWER_TOOL_GLOB as TOOL_GLOB,
  POWER_TOOL_GREP as TOOL_GREP,
  POWER_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH as TOOL_SEMANTIC_SEARCH,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
// @ts-expect-error istextorbinary is not typed properly
import { isBinary } from 'istextorbinary';
import { isURL } from '@common/utils';
import { search } from '@probelabs/probe';

import { ApprovalManager } from './approval-manager';

import { PROBE_BINARY_PATH } from '@/constants';
import { Task } from '@/task';
import logger from '@/logger';
import { filterIgnoredFiles, scrapeWeb } from '@/utils';
import { isAbortError, isFileNotFoundError } from '@/utils/errors';

/**
 * Expands a tilde (~) at the beginning of a path to the user's home directory.
 * @param filePath - The file path to expand
 * @returns The expanded path with ~ replaced by the home directory
 */
const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return filePath.replace('~', os.homedir());
  }
  return filePath;
};

/**
 * Reads a file and returns its content with optional line numbering and line range.
 * @param absolutePath - The absolute path to the file
 * @param withLines - Whether to return the file content with line numbers in format "lineNumber|content"
 * @param lineOffset - The starting line number (0-based) to begin reading from
 * @param lineLimit - The maximum number of lines to read
 * @returns The file content as a string, formatted according to the parameters
 * @throws Error if the file is binary or cannot be read
 */
export const readFileContent = async (absolutePath: string, withLines = false, lineOffset = 0, lineLimit = 1000): Promise<string> => {
  const fileContentBuffer = await fs.readFile(absolutePath);

  if (isBinary(absolutePath, fileContentBuffer)) {
    throw new Error('Binary files cannot be read.');
  }

  const fileContent = fileContentBuffer.toString('utf8');
  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  const startIndex = Math.max(0, lineOffset);
  const endIndex = Math.min(totalLines, startIndex + lineLimit);
  let limitedLines = lines.slice(startIndex, endIndex);

  if (withLines) {
    limitedLines = limitedLines.map((line, index) => `${startIndex + index + 1}|${line}`);
  }

  if (endIndex < totalLines) {
    limitedLines.push('...');
    limitedLines.push(`Total lines in the file: ${totalLines}`);
  }

  return limitedLines.join('\n');
};

export const createPowerToolset = (task: Task, profile: AgentProfile, promptContext?: PromptContext, abortSignal?: AbortSignal): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const fileEditTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_EDIT],
    inputSchema: z.object({
      filePath: z.string().describe('The path to the file to be edited (relative to the <WorkingDirectory>).'),
      searchTerm: z.string().describe(
        `The string or regular expression to find in the file.
*EXACTLY MATCH* the existing file content, character for character, including all comments, docstrings, etc.
Include enough lines in each to uniquely match each set of lines that need to change.
Do not use escape characters \\ in the string like \\n or \\" and others. Do not start the search term with a \\ character.`,
      ),
      replacementText: z
        .string()
        .describe('The string to replace the searchTerm with. Do not use escape characters \\ in the string like \\n or \\" and others'),
      isRegex: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether the searchTerm should be treated as a regular expression. Use regex only when it is really needed. Default: false.'),
      replaceAll: z.boolean().optional().default(false).describe('Whether to replace all occurrences or just the first one. Default: false.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { filePath, searchTerm, replacementText, isRegex, replaceAll } = input;
      const expandedPath = expandTilde(filePath);
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_FILE_EDIT, input, undefined, undefined, promptContext);

      if (searchTerm === replacementText) {
        return 'Already updated - no changes were needed.';
      }

      // Sanitize escape characters from searchTerm and replacementText
      const sanitize = (str: string) => {
        // Check if string contains single escaped backslashes (like \n, \t, etc.)
        const hasSingleEscaped = /\\[nrt"'](?!\\)/.test(str);

        // Only sanitize if no single escaped backslashes are found
        if (hasSingleEscaped) {
          return str;
        }

        // Remove leading backslash
        let updated = str.replace(/^\\+/, '');
        // Remove escaped newlines, quotes, tabs, etc. only when they have double backslashes
        updated = updated.replace(/\\[nrt"']/g, (match) => {
          switch (match) {
            case '\\n':
              return '\n';
            case '\\r':
              return '\r';
            case '\\t':
              return '\t';
            case '\\"':
              return '"';
            case "\\'":
              return "'";
            default:
              return '';
          }
        });
        return updated;
      };

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_EDIT}`;
      const questionKey = toolName;
      const questionText = `Approve editing file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `File edit to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(task.getTaskDir(), expandedPath);
      try {
        const fileContent = await fs.readFile(absolutePath, { encoding: 'utf8', signal: abortSignal });
        let modifiedContent: string;

        if (isRegex) {
          const regex = new RegExp(searchTerm, replaceAll ? 'g' : '');
          modifiedContent = fileContent.replace(regex, replacementText);
        } else {
          const sanitizedSearchTerm = sanitize(searchTerm);
          const sanitizedReplacementText = sanitize(replacementText);

          if (replaceAll) {
            modifiedContent = fileContent.replaceAll(sanitizedSearchTerm, sanitizedReplacementText);
          } else {
            modifiedContent = fileContent.replace(sanitizedSearchTerm, sanitizedReplacementText);
          }
        }

        if (fileContent === modifiedContent) {
          const improveInfo = searchTerm.startsWith('\\\n')
            ? 'Do not start the search term with a \\ character. No escape characters are needed.'
            : searchTerm.includes('\\"')
              ? 'Try not using the \\ in the string like \\" and others, but use only ".'
              : 'When you try again make sure to exactly match content, character for character, including all comments, docstrings, etc.';

          return `Warning: Given 'searchTerm' was not found in the file. Content remains the same. ${improveInfo}`;
        }

        await fs.writeFile(absolutePath, modifiedContent, { encoding: 'utf8', signal: abortSignal });
        return `Successfully edited '${filePath}'.`;
      } catch (error) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isFileNotFoundError(error)) {
          return `Error: File '${filePath}' not found.`;
        }
        return `Error editing file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const fileReadTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_READ],
    inputSchema: z.object({
      filePath: z.string().describe('The path to the file to be read (relative to the <WorkingDirectory> or absolute if outside of the directory).'),
      withLines: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to return the file content with line numbers in format "lineNumber|content". Default: false.'),
      lineOffset: z.number().int().min(0).optional().default(0).describe('The starting line number (0-based) to begin reading from. Default: 0.'),
      lineLimit: z.number().int().min(1).optional().default(1000).describe('The maximum number of lines to read. Default: 1000.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { filePath, withLines, lineOffset, lineLimit } = input;
      const expandedPath = expandTilde(filePath);
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_FILE_READ,
        {
          filePath,
          withLines,
          lineOffset,
          lineLimit,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_READ}`;
      const questionKey = toolName;
      const questionText = `Approve reading file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `File read of '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(task.getTaskDir(), expandedPath);
      try {
        return await readFileContent(absolutePath, withLines, lineOffset, lineLimit);
      } catch (error) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === 'Binary files cannot be read.' || isFileNotFoundError(error)) {
          return `Error: ${errorMessage}`;
        }
        return `Error: Could not read file '${filePath}'. ${errorMessage}`;
      }
    },
  });

  const fileWriteTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_WRITE],
    inputSchema: z.object({
      filePath: z.string().describe('The path to the file to be written (relative to the <WorkingDirectory>).'),
      content: z.string().describe('The content to write to the file. Do not use escape characters \\ in the string like \\n or \\" and others.'),
      mode: z
        .enum(FileWriteMode)
        .optional()
        .default(FileWriteMode.CreateOnly)
        .describe(
          "Mode of writing: 'create_only' (creates if not exists, fails if exists), 'overwrite' (overwrites or creates), 'append' (appends or creates). Default: 'create_only'.",
        ),
    }),
    execute: async (input, { toolCallId }) => {
      const { filePath, content, mode } = input;
      const expandedPath = expandTilde(filePath);
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_FILE_WRITE,
        {
          filePath,
          content,
          mode,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_WRITE}`;
      const questionKey = toolName;
      const questionText =
        mode === FileWriteMode.Overwrite
          ? `Approve overwriting file '${filePath}'?`
          : mode === FileWriteMode.Append
            ? `Approve appending to file '${filePath}'?`
            : `Approve creating file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `File write to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(task.getTaskDir(), expandedPath);

      try {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });

        if (mode === FileWriteMode.CreateOnly) {
          try {
            await fs.writeFile(absolutePath, content, {
              encoding: 'utf8',
              flag: 'wx',
              signal: abortSignal,
            });
            await task.addToGit(absolutePath, promptContext);

            return `Successfully created '${filePath}'.`;
          } catch (e) {
            if ((e as NodeJS.ErrnoException)?.code === 'EEXIST') {
              return `Error: File '${filePath}' already exists (mode: create_only).`;
            }
            throw e;
          }
        } else if (mode === FileWriteMode.Append) {
          await fs.appendFile(absolutePath, content, 'utf8');
          return `Successfully appended to '${filePath}'.`;
        } else {
          await fs.writeFile(absolutePath, content, {
            encoding: 'utf8',
            signal: abortSignal,
          });
          await task.addToGit(absolutePath, promptContext);
          return `Successfully written to '${filePath}' (overwritten).`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error: Cannot write to file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const globTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GLOB],
    inputSchema: z.object({
      pattern: z.string().describe('The glob pattern to search for (e.g., src/**/*.ts, *.md).'),
      cwd: z
        .string()
        .optional()
        .describe('The current working directory from which to apply the glob pattern (relative to <WorkingDirectory>). Default: <WorkingDirectory>.'),
      ignore: z.array(z.string()).optional().describe('An array of glob patterns to ignore.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { pattern, cwd, ignore } = input;
      const expandedCwd = cwd ? expandTilde(cwd) : cwd;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_GLOB,
        {
          pattern,
          cwd,
          ignore,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GLOB}`;
      const questionKey = toolName;
      const questionText = `Approve glob search with pattern '${pattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Glob search with pattern '${pattern}' denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = expandedCwd ? path.resolve(task.getTaskDir(), expandedCwd) : task.getTaskDir();
      try {
        const files = await glob(pattern, {
          cwd: absoluteCwd,
          ignore: ignore,
          nodir: false,
          absolute: false, // Keep paths relative to cwd for easier processing
          signal: abortSignal,
        });

        // Convert to absolute paths for filtering, then back to relative
        const absoluteFiles = files.map((file) => path.resolve(absoluteCwd, file));
        const filteredFiles = await filterIgnoredFiles(task.getTaskDir(), absoluteFiles);

        // Ensure paths are relative to task.getTaskDir()
        const result = filteredFiles.map((file) => path.relative(task.getTaskDir(), file));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error executing glob pattern '${pattern}': ${errorMessage}`;
      }
    },
  });

  const grepTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GREP],
    inputSchema: z.object({
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
    }),
    execute: async (input, { toolCallId }) => {
      const { filePattern, searchTerm, contextLines, caseSensitive, maxResults } = input;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_GREP,
        {
          filePattern,
          searchTerm,
          contextLines,
          caseSensitive,
          maxResults,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GREP}`;
      const questionKey = toolName;
      const questionText = `Approve grep search for '${searchTerm}' in files matching '${filePattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Grep search for '${searchTerm}' in files matching '${filePattern}' denied by user. Reason: ${userInput}`;
      }

      try {
        const files = await glob(filePattern, {
          cwd: task.getTaskDir(),
          nodir: true,
          absolute: true,
          signal: abortSignal,
        });

        if (files.length === 0) {
          return `No files found matching pattern '${filePattern}'.`;
        }

        // Filter out ignored files in batch
        const filteredFiles = await filterIgnoredFiles(task.getTaskDir(), files);

        if (filteredFiles.length === 0) {
          return `No files found matching pattern '${filePattern}' (all files were ignored).`;
        }

        const results: Array<{
          filePath: string;
          lineNumber: number;
          lineContent: string;
          context?: string[];
        }> = [];
        const searchRegex = new RegExp(searchTerm, caseSensitive ? undefined : 'i'); // Simpler for line-by-line test

        for (const absoluteFilePath of filteredFiles) {
          const fileContent = await fs.readFile(absoluteFilePath, { encoding: 'utf8', signal: abortSignal });
          const lines = fileContent.split('\n');
          const relativeFilePath = path.relative(task.getTaskDir(), absoluteFilePath);

          for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            if (searchRegex.test(line)) {
              if (results.length >= maxResults) {
                break;
              }
              const matchResult: {
                filePath: string;
                lineNumber: number;
                lineContent: string;
                context?: string[];
              } = {
                filePath: relativeFilePath,
                lineNumber: index + 1,
                lineContent: line,
              };

              if (contextLines > 0) {
                const start = Math.max(0, index - contextLines);
                const end = Math.min(lines.length - 1, index + contextLines);
                matchResult.context = lines.slice(start, end + 1);
              }
              results.push(matchResult);
            }
          }
        }

        if (results.length === 0) {
          return `No matches found for pattern '${searchTerm}' in files matching '${filePattern}'.`;
        }
        return results;
      } catch (error) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error during grep: ${errorMessage}`;
      }
    },
  });

  const bashTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_BASH],
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute (e.g., ls -la, npm install).'),
      cwd: z.string().optional().describe('The working directory for the command (relative to <WorkingDirectory>). Default: <WorkingDirectory>.'),
      timeout: z.number().int().min(0).optional().default(120000).describe('Timeout for the command execution in milliseconds. Default: 120000 ms.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { command, cwd, timeout } = input;
      const expandedCwd = cwd ? expandTilde(cwd) : cwd;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_BASH,
        {
          command,
          cwd,
          timeout,
        },
        undefined,
        undefined,
        promptContext,
        false, // not finished yet
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_BASH}`;
      const toolId = toolName;
      const questionText = 'Approve executing bash command?';
      const questionSubject = `Command: ${command}\nWorking Directory: ${cwd || '.'}\nTimeout: ${timeout}ms`;

      // Pattern validation
      const bashSettings = profile.toolSettings?.[toolId] as BashToolSettings;

      logger.debug('Bash tool settings:', { bashSettings });
      // Check denied patterns first
      const deniedPatterns = bashSettings?.deniedPattern?.split(';').filter(Boolean) || [];
      if (deniedPatterns.some((pattern) => new RegExp(pattern).test(command))) {
        return `Bash command execution denied by settings. Command matches denied pattern: \`${bashSettings?.deniedPattern}\`. If the command is destructive, you must not try to workaround it, inform the user instead.`;
      }

      let approvedBySettings = false;
      // Check allowed patterns - if matches, skip approval and execute directly
      const allowedPatterns = bashSettings?.allowedPattern?.split(';').filter(Boolean) || [];
      if (allowedPatterns.length > 0 && allowedPatterns.some((pattern) => new RegExp(pattern).test(command))) {
        approvedBySettings = true;
      }

      const [isApproved, userInput] = approvedBySettings
        ? [true, undefined]
        : await approvalManager.handleToolApproval(toolName, input, toolId, questionText, questionSubject);

      if (!isApproved) {
        return `Bash command execution denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = expandedCwd ? path.resolve(task.getTaskDir(), expandedCwd) : task.getTaskDir();

      return await new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let exitCode = 0;
        let timeoutHandle: NodeJS.Timeout | null = null;
        let isResolved = false;

        const cleanup = () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
          }
        };

        const resolveWithResult = () => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          cleanup();

          resolve({ stdout, stderr, exitCode });
        };

        const abortListener = () => {
          if (isResolved) {
            return;
          }
          isResolved = true;
          cleanup();

          const cancelledMessage = 'Operation was cancelled by user.';
          resolve(cancelledMessage);
        };

        // Listen for abort signal
        abortSignal?.addEventListener('abort', abortListener);

        try {
          const childProcess = spawn(command, {
            cwd: absoluteCwd,
            shell: true,
            env: process.env,
          });

          // Set timeout
          timeoutHandle = setTimeout(() => {
            if (!isResolved) {
              childProcess.kill('SIGTERM');
              stderr = `Error: Command timed out after ${timeout}ms. Consider increasing the timeout parameter.`;
              exitCode = 124;
              resolveWithResult();
            }
          }, timeout);

          childProcess.stdout?.on('data', (data: Buffer) => {
            const chunk = data.toString('utf-8');
            stdout += chunk;

            // Send streaming update
            task.addToolMessage(
              toolCallId,
              TOOL_GROUP_NAME,
              TOOL_BASH,
              { command, cwd, timeout },
              JSON.stringify({ stdout, stderr: '', exitCode: null }),
              undefined,
              promptContext,
              false,
              false, // not finished yet
            );
          });

          childProcess.stderr?.on('data', (data: Buffer) => {
            const chunk = data.toString('utf-8');
            stderr += chunk;

            // Send streaming update
            task.addToolMessage(
              toolCallId,
              TOOL_GROUP_NAME,
              TOOL_BASH,
              { command, cwd, timeout },
              JSON.stringify({ stdout, stderr, exitCode: null }),
              undefined,
              promptContext,
              false,
              false, // not finished yet
            );
          });

          childProcess.on('error', (error: Error) => {
            if (!isResolved) {
              stderr = error.message;
              exitCode = 1;
              resolveWithResult();
            }
          });

          childProcess.on('exit', (code: number | null, signal: string | null) => {
            if (!isResolved) {
              if (code !== null) {
                exitCode = code;
              } else if (signal === 'SIGTERM') {
                exitCode = 124; // Timeout exit code
              } else {
                exitCode = 1;
              }
              resolveWithResult();
            }
          });
        } catch (error: unknown) {
          if (!isResolved) {
            stderr = error instanceof Error ? error.message : String(error);
            exitCode = 1;
            resolveWithResult();
          }
        }
      });
    },
  });

  const fetchTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FETCH],
    inputSchema: z.object({
      url: z.string().describe('The URL to fetch.'),
      timeout: z.number().int().min(0).optional().default(60000).describe('Timeout for the fetch operation in milliseconds. Default: 60000 ms.'),
      format: z
        .enum(['markdown', 'html', 'raw'])
        .optional()
        .default('markdown')
        .describe(
          'Format of the response: "markdown" (default, converts HTML to markdown), "html" (returns raw HTML), "raw" (fetches raw content via HTTP, ideal for API responses or raw files).',
        ),
    }),
    execute: async (input, { toolCallId }) => {
      const { url, timeout, format } = input;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_FETCH,
        {
          url,
          timeout,
          format,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FETCH}`;
      const questionKey = toolName;
      const questionText = `Approve fetching content from URL '${url}'?`;
      const questionSubject = `URL: ${url}\nTimeout: ${timeout}ms\nFormat: ${format}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `URL fetch from '${url}' denied by user. Reason: ${userInput}`;
      }

      if (!isURL(url)) {
        return `Error: Invalid URL provided: ${url}. Please provide a valid URL.`;
      }

      try {
        return await scrapeWeb(url, timeout, abortSignal, format);
      } catch (error) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error: ${errorMessage}`;
      }
    },
  });

  const searchTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_SEMANTIC_SEARCH],
    inputSchema: z.object({
      query: z.string().describe('Search query with Elasticsearch syntax. Use + for important terms.'),
      path: z
        .string()
        .optional()
        .default(task.getTaskDir())
        .describe('Absolute path to search in. For dependencies use "go:github.com/owner/repo", "js:package_name", or "rust:cargo_name" etc.'),
      allowTests: z.boolean().optional().default(false).describe('Allow test files in search results'),
      exact: z.boolean().optional().default(false).describe('Perform exact search without tokenization (case-insensitive)'),
      maxResults: z.number().optional().describe('Maximum number of results to return'),
      maxTokens: z.number().optional().default(5000).describe('Maximum number of tokens to return'),
      language: z.string().optional().describe('Limit search to files of a specific programming language'),
    }),
    execute: async (input, { toolCallId }) => {
      const { query: searchQuery, path: inputPath, allowTests, exact, maxTokens: paramMaxTokens, language } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_SEMANTIC_SEARCH, { searchQuery, path: inputPath }, undefined, undefined, promptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_SEMANTIC_SEARCH}`;
      const questionKey = toolName;
      const questionText = 'Approve running codebase search?';
      const questionSubject = `Query: ${searchQuery}\nPath: ${inputPath || '.'}\nAllow Tests: ${allowTests}\nExact: ${exact}\nLanguage: ${language}`;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Search execution denied by user. Reason: ${userInput}`;
      }

      // Use parameter maxTokens if provided, otherwise use the default
      const effectiveMaxTokens = paramMaxTokens || 5000;

      let searchPath = inputPath || task.getTaskDir();

      // Check if it's a dependency path (format: language:rest)
      const isDependencyPath = /^[a-zA-Z]+:/.test(searchPath);

      if (!isDependencyPath && !path.isAbsolute(searchPath)) {
        // If path is relative (including "." and "./"), resolve it relative to task.getTaskDir()
        searchPath = path.resolve(task.getTaskDir(), searchPath);
      }

      // List of supported languages by the probe binary
      const supportedLanguages = [
        'rust',
        'rs',
        'javascript',
        'js',
        'jsx',
        'typescript',
        'ts',
        'tsx',
        'python',
        'py',
        'go',
        'c',
        'h',
        'cpp',
        'cc',
        'cxx',
        'hpp',
        'hxx',
        'java',
        'ruby',
        'rb',
        'php',
        'swift',
        'csharp',
        'cs',
        'yaml',
        'yml',
      ];

      // Only include language parameter if it's supported
      const effectiveLanguage = language && supportedLanguages.includes(language) ? language : undefined;

      try {
        // @ts-expect-error probe is not typed properly
        const results = await search({
          query: searchQuery,
          path: searchPath,
          allowTests,
          exact,
          timeout: 5 * 60, // 5 minutes
          json: false,
          maxTokens: effectiveMaxTokens,
          language: effectiveLanguage,
          binaryOptions: {
            path: PROBE_BINARY_PATH,
          },
        });

        logger.debug(`Search results: ${JSON.stringify(results)}`);

        return results;
      } catch (error: unknown) {
        if (isAbortError(error)) {
          return 'Operation was cancelled by user.';
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error executing search command:', error);
        task.addLogMessage(
          'error',
          `Semantic search failed with error:\n\n${errorMessage}\n\nPlease, consider reporting an issue at https://github.com/hotovo/aider-desk/issues. Thank you.`,
        );
        return errorMessage;
      }
    },
  });

  const allTools = {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_EDIT}`]: fileEditTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_READ}`]: fileReadTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_WRITE}`]: fileWriteTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GLOB}`]: globTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GREP}`]: grepTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_SEMANTIC_SEARCH}`]: searchTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_BASH}`]: bashTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FETCH}`]: fetchTool,
  };

  // Filter out tools that are set to Never in toolApprovals
  const filteredTools: ToolSet = {};
  for (const [toolId, tool] of Object.entries(allTools)) {
    if (profile.toolApprovals[toolId] !== ToolApprovalState.Never) {
      filteredTools[toolId] = tool;
    }
  }

  return filteredTools;
};
