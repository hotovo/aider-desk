import { z } from 'zod';

import type { ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';

const inputSchema = z.object({
  action: z
    .enum(['create', 'edit', 'write_file', 'refresh'])
    .describe('Action to perform: create a new skill, edit SKILL.md of an existing skill, write a supporting file, or list all skills to refresh the index'),
  name: z.string().optional().describe("Skill name (lowercase-hyphenated). Required for all actions except 'refresh'"),
  content: z.string().optional().describe("SKILL.md content for 'create' or 'edit' actions. Must include YAML frontmatter with name and description"),
  file_path: z.string().optional().describe("Supporting file path within the skill (e.g. 'references/api.md', 'scripts/deploy.sh'). For 'write_file' action"),
  file_content: z.string().optional().describe('Content for the supporting file. For write_file action'),
  location: z
    .enum(['global', 'project'])
    .optional()
    .default('global')
    .describe('Where to save the skill: global (~/.aider-desk/skills/) or project (.aider-desk/skills/). Defaults to global'),
});

type SaveSkillInput = z.infer<typeof inputSchema>;

interface SkillResult {
  success: boolean;
  message: string;
  path?: string;
  hint?: string;
}

const handleCreate = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  if (!input.name) {
    return { success: false, message: 'Skill name is required for create action.' };
  }
  if (!input.content) {
    return { success: false, message: 'Content is required for create action.' };
  }

  const result = await context.getSkillContext().createSkill(input.name, input.content, input.location ?? 'global');
  if (result.success) {
    return { ...result, hint: "To add reference files, templates, or scripts, use action='write_file' with file_path like 'references/example.md'" };
  }
  return result;
};

const handleEdit = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  if (!input.name) {
    return { success: false, message: 'Skill name is required for edit action.' };
  }
  if (!input.content) {
    return { success: false, message: 'Content is required for edit action.' };
  }

  return context.getSkillContext().updateSkill(input.name, input.content);
};

const handleWriteFile = async (input: SaveSkillInput, context: ExtensionContext): Promise<SkillResult> => {
  if (!input.name) {
    return { success: false, message: 'Skill name is required for write_file action.' };
  }
  if (!input.file_path) {
    return { success: false, message: 'file_path is required for write_file action.' };
  }
  if (input.file_content === undefined || input.file_content === null) {
    return { success: false, message: 'file_content is required for write_file action.' };
  }

  return context.getSkillContext().writeSkillFile(input.name, input.file_path, input.file_content);
};

const handleRefresh = async (context: ExtensionContext): Promise<SkillResult> => {
  const skills = await context.getSkillContext().listSkills();

  return { success: true, message: `Skill index refreshed. ${skills.length} skill(s) available.` };
};

export const createSaveSkillTool = (): ToolDefinition<typeof inputSchema> => ({
  name: 'save-skill',
  description:
    'Create, edit, or write files to AiderDesk skills. Skills are reusable procedural knowledge stored as SKILL.md files with optional supporting files (references/, templates/, scripts/, assets/). Use action="create" to create a new skill, action="edit" to rewrite SKILL.md, action="write_file" to add supporting files, or action="refresh" to list all skills and refresh the index.',
  inputSchema,
  execute: async (input: SaveSkillInput, _signal: AbortSignal | undefined, context: ExtensionContext): Promise<unknown> => {
    if (input.action !== 'refresh' && !input.name) {
      return JSON.stringify({ success: false, message: 'Skill name is required for all actions except refresh.' }, null, 2);
    }

    try {
      let result: SkillResult;
      switch (input.action) {
        case 'create':
          result = await handleCreate(input, context);
          break;
        case 'edit':
          result = await handleEdit(input, context);
          break;
        case 'write_file':
          result = await handleWriteFile(input, context);
          break;
        case 'refresh':
          result = await handleRefresh(context);
          break;
        default:
          result = { success: false, message: `Unknown action: ${input.action}` };
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, message: `Error: ${errorMsg}` }, null, 2);
    }
  },
});
