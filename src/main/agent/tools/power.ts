import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { glob } from 'glob';
import { search, searchSchema } from '@buger/probe';
import { AgentProfile, ContextFile, FileWriteMode, ToolApprovalState, PromptContext } from '@common/types';
import { v4 as uuidv4 } from 'uuid';
import {
  POWER_TOOL_AGENT,
  POWER_TOOL_AGENT as TOOL_AGENT,
  POWER_TOOL_BASH,
  POWER_TOOL_BASH as TOOL_BASH,
  POWER_TOOL_DESCRIPTIONS,
  POWER_TOOL_FILE_EDIT as TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ as TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE as TOOL_FILE_WRITE,
  POWER_TOOL_GLOB as TOOL_GLOB,
  POWER_TOOL_GREP as TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH as TOOL_SEMANTIC_SEARCH,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';
import { isBinary } from 'istextorbinary';

import { ApprovalManager } from './approval-manager';

import { Project } from '@/project';
import logger from '@/logger';
import { isFileIgnored } from '@/utils';
import { getSubAgentSystemPrompt } from '@/agent';

const execAsync = promisify(exec);

export const createPowerToolset = (project: Project, profile: AgentProfile, abortSignal?: AbortSignal, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(project, profile);

  const fileEditTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_EDIT],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be edited (relative to the project root).'),
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
    execute: async (args, { toolCallId }) => {
      const { filePath, searchTerm, replacementText, isRegex, replaceAll } = args;
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_FILE_EDIT, args, undefined, undefined, promptContext);

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

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_EDIT}`;
      const questionText = `Approve editing file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File edit to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);
      try {
        const fileContent = await fs.readFile(absolutePath, 'utf8');
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
            : 'When you try again make sure to exactly match content, character for character, including all comments, docstrings, etc.';

          return `Warning: Given 'searchTerm' was not found in the file. Content remains the same. ${improveInfo}`;
        }

        await fs.writeFile(absolutePath, modifiedContent, 'utf8');
        return `Successfully edited '${filePath}'.`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return `Error: File '${filePath}' not found.`;
        }
        return `Error editing file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const fileReadTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_READ],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be read (relative to the project root or absolute if outside of project directory).'),
    }),
    execute: async ({ filePath }, { toolCallId }) => {
      project.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_FILE_READ,
        {
          filePath,
        },
        undefined,
        undefined,
        promptContext,
      );

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_READ}`;
      const questionText = `Approve reading file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File read of '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);
      try {
        const fileContentBuffer = await fs.readFile(absolutePath);
        if (isBinary(absolutePath, fileContentBuffer)) {
          return 'Error: Binary files cannot be read.';
        }
        const content = fileContentBuffer.toString('utf8');
        return `Here is the most recent content of '${filePath}' (ignore previous versions):\n\n${content}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
          return `Error: File '${filePath}' not found.`;
        }
        return `Error: Could not read file '${filePath}'. ${errorMessage}`;
      }
    },
  });

  const fileWriteTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_FILE_WRITE],
    parameters: z.object({
      filePath: z.string().describe('The path to the file to be written (relative to the project root).'),
      content: z.string().describe('The content to write to the file. Do not use escape characters \\ in the string like \\n or \\" and others.'),
      mode: z
        .nativeEnum(FileWriteMode)
        .optional()
        .default(FileWriteMode.Overwrite)
        .describe(
          "Mode of writing: 'overwrite' (overwrites or creates), 'append' (appends or creates), 'create_only' (creates if not exists, fails if exists). Default: 'overwrite'.",
        ),
    }),
    execute: async ({ filePath, content, mode }, { toolCallId }) => {
      project.addToolMessage(
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

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_FILE_WRITE}`;
      const questionText =
        mode === FileWriteMode.Overwrite
          ? `Approve overwriting or creating file '${filePath}'?`
          : mode === FileWriteMode.Append
            ? `Approve appending to file '${filePath}'?`
            : `Approve creating file '${filePath}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `File write to '${filePath}' denied by user. Reason: ${userInput}`;
      }

      const absolutePath = path.resolve(project.baseDir, filePath);

      const addToGit = async () => {
        try {
          // Add the new file to git staging
          await project.git.add(absolutePath);
        } catch (gitError) {
          const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
          project.addLogMessage('warning', `Failed to add new file ${absolutePath} to git staging area: ${gitErrorMessage}`, false, promptContext);
          // Continue even if git add fails, as the file was created successfully
        }
      };

      try {
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });

        if (mode === FileWriteMode.CreateOnly) {
          try {
            await fs.writeFile(absolutePath, content, { flag: 'wx' });
            await addToGit();

            return `Successfully wrote to '${filePath}' (created).`;
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
          await fs.writeFile(absolutePath, content, 'utf8');
          await addToGit();
          return `Successfully wrote to '${filePath}' (overwritten/created).`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error writing to file '${filePath}': ${errorMessage}`;
      }
    },
  });

  const globTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GLOB],
    parameters: z.object({
      pattern: z.string().describe('The glob pattern to search for (e.g., src/**/*.ts, *.md).'),
      cwd: z
        .string()
        .optional()
        .describe('The current working directory from which to apply the glob pattern (relative to project root). Default: project root.'),
      ignore: z.array(z.string()).optional().describe('An array of glob patterns to ignore.'),
    }),
    execute: async ({ pattern, cwd, ignore }, { toolCallId }) => {
      project.addToolMessage(
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

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GLOB}`;
      const questionText = `Approve glob search with pattern '${pattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Glob search with pattern '${pattern}' denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const files = await glob(pattern, {
          cwd: absoluteCwd,
          ignore: ignore,
          nodir: false,
          absolute: false, // Keep paths relative to cwd for easier processing
        });
        const result: string[] = [];

        for (const file of files) {
          if (await isFileIgnored(project.baseDir, file)) {
            continue;
          }
          // Ensure paths are relative to project.baseDir
          result.push(path.relative(project.baseDir, path.resolve(absoluteCwd, file)));
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error executing glob pattern '${pattern}': ${errorMessage}`;
      }
    },
  });

  const grepTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_GREP],
    parameters: z.object({
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
    }),
    execute: async ({ filePattern, searchTerm, contextLines, caseSensitive }, { toolCallId }) => {
      project.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_GREP,
        {
          filePattern,
          searchTerm,
          contextLines,
          caseSensitive,
        },
        undefined,
        undefined,
        promptContext,
      );

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GREP}`;
      const questionText = `Approve grep search for '${searchTerm}' in files matching '${filePattern}'?`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText);

      if (!isApproved) {
        return `Grep search for '${searchTerm}' in files matching '${filePattern}' denied by user. Reason: ${userInput}`;
      }

      try {
        const files = await glob(filePattern, {
          cwd: project.baseDir,
          nodir: true,
          absolute: true,
        });

        if (files.length === 0) {
          return `No files found matching pattern '${filePattern}'.`;
        }

        const results: Array<{
          filePath: string;
          lineNumber: number;
          lineContent: string;
          context?: string[];
        }> = [];
        const searchRegex = new RegExp(searchTerm, caseSensitive ? undefined : 'i'); // Simpler for line-by-line test

        for (const absoluteFilePath of files) {
          if (await isFileIgnored(project.baseDir, absoluteFilePath)) {
            continue;
          }
          const fileContent = await fs.readFile(absoluteFilePath, 'utf8');
          const lines = fileContent.split('\n');
          const relativeFilePath = path.relative(project.baseDir, absoluteFilePath);

          lines.forEach((line, index) => {
            if (searchRegex.test(line)) {
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
          });
        }

        if (results.length === 0) {
          return `No matches found for pattern '${searchTerm}' in files matching '${filePattern}'.`;
        }
        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Error during grep: ${errorMessage}`;
      }
    },
  });

  const bashTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_BASH],
    parameters: z.object({
      command: z.string().describe('The shell command to execute (e.g., ls -la, npm install).'),
      cwd: z.string().optional().describe('The working directory for the command (relative to project root). Default: project root.'),
      timeout: z.number().int().min(0).optional().default(60000).describe('Timeout for the command execution in milliseconds. Default: 60000 ms.'),
    }),
    execute: async ({ command, cwd, timeout }, { toolCallId }) => {
      project.addToolMessage(
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
      );

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_BASH}`;
      const questionText = 'Approve executing bash command?';
      const questionSubject = `Command: ${command}\nWorking Directory: ${cwd || '.'}\nTimeout: ${timeout}ms`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Bash command execution denied by user. Reason: ${userInput}`;
      }

      const absoluteCwd = cwd ? path.resolve(project.baseDir, cwd) : project.baseDir;
      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd: absoluteCwd,
          timeout: timeout,
        });
        return { stdout, stderr, exitCode: 0 };
      } catch (error: unknown) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: number;
        };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || execError.message || String(error),
          exitCode: typeof execError.code === 'number' ? execError.code : 1,
        };
      }
    },
  });

  const searchTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_SEMANTIC_SEARCH],
    parameters: searchSchema,
    execute: async ({ query: searchQuery, path, allow_tests, exact, maxTokens: paramMaxTokens, language }, { toolCallId }) => {
      project.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_SEMANTIC_SEARCH, { searchQuery, path }, undefined, undefined, promptContext);

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_SEMANTIC_SEARCH}`;
      const questionText = 'Approve running codebase search?';
      const questionSubject = `Query: ${searchQuery}\nPath: ${path || '.'}\nAllow Tests: ${allow_tests}\nExact: ${exact}\nLanguage: ${language}`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        return `Search execution denied by user. Reason: ${userInput}`;
      }

      // Use parameter maxTokens if provided, otherwise use the default
      const effectiveMaxTokens = paramMaxTokens || 10000;

      let searchPath = path || project.baseDir;
      if (searchPath === '.' || searchPath === './') {
        // If path is "." or "./", use the project baseDir
        searchPath = project.baseDir;
      }

      try {
        const results = await search({
          query: searchQuery,
          path: searchPath,
          allow_tests,
          exact,
          json: false,
          maxTokens: effectiveMaxTokens,
          language,
        });

        logger.debug(`Search results: ${JSON.stringify(results)}`);

        return results;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error executing search command:', error);
        return `Error executing search command: ${errorMessage}`;
      }
    },
  });

  const agentTool = tool({
    description: POWER_TOOL_DESCRIPTIONS[TOOL_AGENT],
    parameters: z.object({
      prompt: z
        .string()
        .describe(
          'A clear and concise natural language prompt describing the task the sub-agent needs to perform. This prompt should provide all necessary information for the sub-agent to complete its task independently within its limited context.',
        ),
      files: z
        .array(z.string())
        .optional()
        .describe(
          'An array of file paths (strings) that the main agent identifies as relevant for the sub-agent task. These files will be provided to the sub-agent as its working context, ensuring it has access to the necessary code or data without being burdened by the entire project context.',
        ),
    }),
    execute: async ({ prompt, files }, { toolCallId }) => {
      // Create promptContext with working group
      const promptContext: PromptContext = {
        id: uuidv4(),
        group: {
          id: uuidv4(),
          color: 'var(--color-agent-sub-agent)',
          name: 'toolMessage.power.agent.running',
        },
      };

      project.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_AGENT,
        {
          prompt,
          files,
        },
        undefined,
        undefined,
        promptContext,
      );

      const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_AGENT}`;
      const questionText = 'Approve delegating task to sub-agent?';
      const filesText = files ? `Files: ${files.join(', ')}` : 'Files: None (sub-agent will work without file context)';
      const questionSubject = `Prompt: ${prompt}${filesText}`;

      const [isApproved, userInput] = await approvalManager.handleApproval(questionKey, questionText, questionSubject);

      if (!isApproved) {
        // Update promptContext to finished state with denied status
        promptContext.group = {
          ...promptContext.group!,
          name: 'toolMessage.denied',
          finished: true,
        };
        return `Sub-agent delegation denied by user. Reason: ${userInput}`;
      }

      try {
        // Create a sub-agent profile optimized for cost and focused context
        const subAgentProfile: AgentProfile = {
          ...DEFAULT_AGENT_PROFILE,
          ...profile,
          id: 'sub-agent',
          name: 'Sub-Agent',
          includeContextFiles: false, // Don't include full context
          includeRepoMap: false, // Don't include repo map for cost optimization
          usePowerTools: true, // Enable power tools for sub-agent
          useAiderTools: false, // Disable aider tools to prevent nested delegation
          useTodoTools: false, // Disable todo tools for simplicity
          enabledServers: [], // No MCP servers for sub-agent,
          toolApprovals: {
            ...profile.toolApprovals,
            [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_AGENT}`]: ToolApprovalState.Never,
            [`${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`]: ToolApprovalState.Never,
          },
        };

        // Set limited context if files are provided
        const contextFiles: ContextFile[] = (files || []).map((filePath) => ({
          path: filePath,
          readOnly: false,
        }));

        // Run the sub-agent with the focused context
        const messages = await project.runSubAgent(subAgentProfile, prompt, contextFiles, getSubAgentSystemPrompt(), abortSignal, promptContext);

        // Update promptContext to finished state with success
        promptContext.group = {
          ...promptContext.group!,
          name: 'toolMessage.power.agent.completed',
          finished: true,
        };

        return {
          messages,
          promptContext,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error running sub-agent:', error);

        // Update promptContext to finished state with error
        promptContext.group = {
          ...promptContext.group!,
          name: 'toolMessage.error',
          color: 'var(--color-error-muted)',
          finished: true,
        };

        return {
          error: `Error running sub-agent: ${errorMessage}`,
          promptContext,
        };
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
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_AGENT}`]: agentTool,
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
