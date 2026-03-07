import fs from 'fs/promises';
import path from 'path';

import { tool } from 'ai';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  TOOL_GROUP_NAME_SEPARATOR,
  AIDER_TOOL_GROUP_NAME as TOOL_GROUP_NAME,
  AIDER_TOOL_GET_CONTEXT_FILES as TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_ADD_CONTEXT_FILES as TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES as TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_RUN_PROMPT as TOOL_RUN_PROMPT,
  AIDER_TOOL_DESCRIPTIONS,
} from '@common/tools';
import { AgentProfile, PromptContext, ToolApprovalState } from '@common/types';

import { ApprovalManager } from './approval-manager';

import type { ToolSet } from 'ai';

import { Task } from '@/task';

export const createAiderToolset = (task: Task, profile: AgentProfile, promptContext?: PromptContext): ToolSet => {
  const approvalManager = new ApprovalManager(task, profile);

  const getContextFilesTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_GET_CONTEXT_FILES],
    inputSchema: z.object({
      taskDir: z.string().describe("The task directory. Can be '.' for current task."),
    }),
    execute: async (input, { toolCallId }) => {
      const { taskDir } = input;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_GET_CONTEXT_FILES,
        {
          taskDir,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GET_CONTEXT_FILES}`;
      const questionKey = toolName;
      const questionText = 'Approve getting context files?';

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

      if (!isApproved) {
        return `Getting context files denied by user. Reason: ${userInput}`;
      }

      const files = await task.getContextFiles();
      return JSON.stringify(files);
    },
  });

  const addContextFilesTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_ADD_CONTEXT_FILES],
    inputSchema: z.object({
      paths: z
        .array(z.string())
        .describe('One or more file paths to add to context. Relative to task directory (e.g. "src/file.ts") or absolute (e.g. "/tmp/log.txt" for read-only).'),
      readOnly: z.boolean().optional().describe('Whether the file(s) are read-only. Applies to all paths if true.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { paths, readOnly = false } = input;
      task.addToolMessage(
        toolCallId,
        TOOL_GROUP_NAME,
        TOOL_ADD_CONTEXT_FILES,
        {
          paths,
          readOnly,
        },
        undefined,
        undefined,
        promptContext,
      );

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_ADD_CONTEXT_FILES}`;
      const results: string[] = [];
      for (const filePath of paths) {
        const absolutePath = path.resolve(task.getTaskDir(), filePath);
        let fileExists = false;
        try {
          await fs.access(absolutePath);
          fileExists = true;
        } catch {
          fileExists = false;
        }

        if (!fileExists) {
          const createFileQuestionKey = `tool_aider_${TOOL_ADD_CONTEXT_FILES}_create_file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const createFileQuestionText = `File '${filePath}' does not exist. Create it?`;
          const [createApproved] = await approvalManager.handleToolApproval(toolName, input, createFileQuestionKey, createFileQuestionText);

          if (createApproved) {
            try {
              const dir = path.dirname(absolutePath);
              await fs.mkdir(dir, { recursive: true });
              await fs.writeFile(absolutePath, '');
              task.addLogMessage('info', `Created new file: ${filePath}`);
              fileExists = true;

              await task.addToGit(absolutePath, promptContext);
              results.push(`Created and added file: ${filePath}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              task.addLogMessage('error', `Failed to create file '${filePath}': ${errorMessage}`);
              results.push(`Error: Failed to create file '${filePath}'. It was not added to the context.`);
            }
          } else {
            results.push(`File '${filePath}' does not exist and was not created. It was not added to the context.`);
          }
        } else {
          const questionKey = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_ADD_CONTEXT_FILES}_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const questionText = `Approve adding file '${filePath}' to context?`;

          const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

          if (!isApproved) {
            results.push(`Adding '${filePath}' to context denied by user. Reason: ${userInput}`);
            continue;
          }
        }

        if (fileExists) {
          // This condition is now met if the file initially existed or was just created
          const added = await task.addFiles({
            path: filePath,
            readOnly,
          });
          if (added) {
            // Only add to results if it wasn't handled by the creation logic above
            if (!results.some((r) => r.includes(`Created and added file: ${filePath}`))) {
              results.push(`Added file: ${filePath}`);
            }
          } else {
            results.push(`Not added - file '${filePath}' was already in the context.`);
          }
        }
      }
      return results.join('\n');
    },
  });

  const dropContextFilesTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_DROP_CONTEXT_FILES],
    inputSchema: z.object({
      paths: z.array(z.string()).describe('One or more file paths to remove from context.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { paths } = input;
      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_DROP_CONTEXT_FILES, { paths }, undefined, undefined, promptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DROP_CONTEXT_FILES}`;
      const results: string[] = [];
      for (const filePath of paths) {
        const questionKey = toolName;
        const questionText = `Approve dropping file '${path}' from context?`;

        const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText);

        if (!isApproved) {
          results.push(`Dropping file '${filePath}' from context denied by user. Reason: ${userInput}`);
          continue;
        }

        task.dropFile(filePath);
        results.push(`Dropped file: ${filePath}`);
      }
      return results.join('\n');
    },
  });

  const runPromptTool = tool({
    description: AIDER_TOOL_DESCRIPTIONS[TOOL_RUN_PROMPT],
    inputSchema: z.object({
      prompt: z.string().describe('The prompt to run in natural language.'),
    }),
    execute: async (input, { toolCallId }) => {
      const { prompt } = input;
      const aiderPromptContext: PromptContext = {
        id: uuidv4(),
        group: {
          id: uuidv4(),
          color: 'var(--color-agent-aider-tools)',
          name: 'toolMessage.aider.working',
        },
      };

      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_RUN_PROMPT, { prompt }, undefined, undefined, aiderPromptContext);

      const toolName = `${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RUN_PROMPT}`;
      const questionKey = toolName;
      const questionText = 'Approve prompt to run in Aider?';

      // Ask the question and wait for the answer
      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, input, questionKey, questionText, prompt);

      if (!isApproved) {
        return {
          responses: [],
          updatedFiles: [],
          deniedReason: userInput,
          error: 'Aider prompt execution denied by user. Update the prompt based on the denied reason or cancel and do not run again.',
        };
      }

      task.addToolMessage(toolCallId, TOOL_GROUP_NAME, TOOL_RUN_PROMPT, { prompt }, undefined, undefined, aiderPromptContext);

      const responses = await task.sendPromptToAider(prompt, aiderPromptContext, 'code', [], undefined, {
        autoApprove: task.task.autoApprove,
        denyCommands: true,
      });

      // Notify that we are still processing after aider finishes
      task.addLogMessage('loading');

      const updatedFiles = responses.flatMap((response) => response.editedFiles || []).filter((value, index, self) => self.indexOf(value) === index);
      return {
        responses,
        updatedFiles,
        promptContext: {
          ...aiderPromptContext,
          group: {
            ...aiderPromptContext.group!,
            name: updatedFiles.length ? 'toolMessage.aider.finishedTask' : 'toolMessage.aider.noChanges',
            finished: true,
          },
        } satisfies PromptContext,
      };
    },
  });

  const allTools = {
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_GET_CONTEXT_FILES}`]: getContextFilesTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_ADD_CONTEXT_FILES}`]: addContextFilesTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_DROP_CONTEXT_FILES}`]: dropContextFilesTool,
    [`${TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TOOL_RUN_PROMPT}`]: runPromptTool,
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
