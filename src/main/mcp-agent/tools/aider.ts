import { StructuredTool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import { EditFormat } from 'src/main/messages';

import { Project } from '../../project';

export const createAiderTools = (project: Project, editFormat: EditFormat = 'code'): StructuredTool[] => {
  const getContextFilesTool = tool(
    async () => {
      const files = project.getContextFiles();
      const response = JSON.stringify(files);

      project.addToolMessage('aider', 'get_context_files', undefined, response);

      return response;
    },
    {
      name: 'aider-get_context_files',
      description: 'Get all files currently in the context for Aider to use',
      schema: z.object({
        // eslint-disable-next-line quotes
        projectDir: z.string().describe("The project directory. Can be '.' for current project."),
      }),
    },
  );

  const addContextFileTool = tool(
    async (params: { path: string; readOnly?: boolean }) => {
      await project.addFile({
        path: params.path,
        readOnly: params.readOnly || false,
      });

      project.addToolMessage('aider', 'add_context_file', undefined, `Added file: ${params.path}`);

      return `Added file: ${params.path}`;
    },
    {
      name: 'aider-add_context_file',
      description: 'Add a file to the context of Aider',
      schema: z.object({
        path: z.string().describe('File path to add to context'),
        readOnly: z.boolean().describe('Whether the file is read-only'),
      }),
    },
  );

  const dropContextFileTool = tool(
    async (params: { path: string }) => {
      project.dropFile(params.path);

      project.addToolMessage('aider', 'drop_context_file', undefined, `Dropped file: ${params.path}`);

      return `Dropped file: ${params.path}`;
    },
    {
      name: 'aider-drop_context_file',
      description: 'Remove a file from the context of Aider',
      schema: z.object({
        path: z.string().describe('File path to remove from context'),
      }),
    },
  );

  const runPromptTool = tool(
    async (params: { prompt: string; editFormat?: 'code' | 'ask' | 'architect' }) => {
      const responses = await project.sendPrompt(params.prompt, editFormat);

      // Merge all responses into a single cohesive response
      const mergedResponse = responses
        .map((response) => response.content.trim())
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n'); // Normalize excessive newlines

      const editedFiles = responses.flatMap((response) => response.editedFiles || []).filter((value, index, self) => self.indexOf(value) === index); // Unique files

      const result = `${mergedResponse}\n\nUsing the above information I have updated the following files: ${editedFiles.join(', ')}`;

      project.addToolMessage('aider', 'run_prompt', undefined, result);

      return result;
    },
    {
      name: 'aider-run_prompt',
      description:
        'Run a prompt in Aider to perform coding tasks. Before running this tool, make sure all the necessary files are added to the context, if possible.',
      schema: z.object({
        prompt: z.string().describe('The prompt to run'),
      }),
    },
  );

  return [getContextFilesTool, addContextFileTool, dropContextFileTool, runPromptTool];
};
