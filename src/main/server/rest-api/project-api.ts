import { Router } from 'express';
import { z } from 'zod';
import { CreateTaskParams, ProjectSettingsSchema, TaskDataSchema } from '@common/types';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const RestartProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ResetTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const GetProjectSettingsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const PatchProjectSettingsSchema = ProjectSettingsSchema.partial().and(
  z.object({
    projectDir: z.string().min(1, 'Project directory is required'),
  }),
);

const InterruptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const ClearContextSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const AnswerQuestionSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  answer: z.string().min(1, 'Answer is required'),
});

const RemoveQueuedPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  promptId: z.string().min(1, 'Prompt id is required'),
});

const SendQueuedPromptNowSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  promptId: z.string().min(1, 'Prompt id is required'),
});

const UpdateMainModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  mainModel: z.string().min(1, 'Main model is required'),
});

const UpdateWeakModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  weakModel: z.string().min(1, 'Weak model is required'),
});

const UpdateArchitectModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  architectModel: z.string().min(1, 'Architect model is required'),
});

const UpdateEditFormatsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  editFormats: z.record(z.string(), z.enum(['diff', 'diff-fenced', 'whole', 'udiff', 'udiff-simple', 'patch'])),
});

const StartProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const StopProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const AddOpenProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const SetActiveProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RemoveOpenProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const UpdateOpenProjectsOrderSchema = z.object({
  projectDirs: z.array(z.string().min(1, 'Project directory is required')),
});

const LoadInputHistorySchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RedoLastUserPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context']),
  updatedPrompt: z.string().optional(),
});

const ResumeTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const IsValidPathSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  path: z.string().min(1, 'Path is required'),
});

const IsProjectPathSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

const GetFilePathSuggestionsSchema = z.object({
  currentPath: z.string().min(1, 'Current path is required'),
  directoriesOnly: z.boolean().optional(),
});

const ApplyEditsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  edits: z.array(
    z.object({
      path: z.string(),
      original: z.string(),
      updated: z.string(),
    }),
  ),
});

const PasteImageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  base64ImageData: z.string().optional(),
});

const RunCommandSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  command: z.string().min(1, 'Command is required'),
});

const InitProjectRulesFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const CreateNewTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  parentId: z.string().nullable().optional(),
  name: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  id: z.string().min(1, 'Task id is required'),
  updates: TaskDataSchema.partial(),
});

const LoadTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  id: z.string().min(1, 'Task id is required'),
});

const ListTasksSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const DeleteTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  id: z.string().min(1, 'Task id is required'),
});

const DuplicateTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const ForkTaskSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  messageId: z.string().min(1, 'Message id is required'),
});

const GetTaskContextDataSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  id: z.string().min(1, 'Task id is required'),
});

const ExportSessionToMarkdownSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const RemoveLastMessageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const RemoveMessageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  messageId: z.string().min(1, 'Message id is required'),
});

const RemoveMessagesUpToSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  messageId: z.string().min(1, 'Message id is required'),
});

const CompactConversationSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context']),
  customInstructions: z.string().optional(),
});

const HandoffConversationSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  focus: z.string().optional(),
});

const RunCodeInlineRequestSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  filename: z.string().min(1, 'Filename is required'),
  lineNumber: z.number().int().min(1, 'Line number is required'),
  userComment: z.string().min(1, 'User comment is required'),
});

const ScrapeWebSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  url: z.url('Invalid URL format').min(1, 'URL is required'),
  filePath: z.string().optional(),
});

const MergeWorktreeToMainSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  squash: z.boolean(),
  targetBranch: z.string().optional(),
  commitMessage: z.string().optional(),
});

const ApplyUncommittedChangesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  targetBranch: z.string().optional(),
});

const RevertLastMergeSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const RestoreFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  filePath: z.string().min(1, 'File path is required'),
});

const GenerateCommitMessageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const CommitChangesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  message: z.string().min(1, 'Commit message is required'),
  amend: z.boolean(),
});

const ListBranchesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const WorktreeStatusSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  targetBranch: z.string().optional(),
});

const RebaseWorktreeFromBranchSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  fromBranch: z.string().optional(),
});

const AbortWorktreeRebaseSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const ContinueWorktreeRebaseSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

const ResolveWorktreeConflictsWithAgentSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
});

export class ProjectApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get projects
    router.get(
      '/projects',
      this.handleRequest(async (_, res) => {
        const projects = this.eventsHandler.getOpenProjects();
        res.status(200).json(projects);
      }),
    );

    // Get input history
    router.get(
      '/project/input-history',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadInputHistorySchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const inputHistory = await this.eventsHandler.loadInputHistory(projectDir);
        res.status(200).json(inputHistory);
      }),
    );

    // Redo last user prompt
    router.post(
      '/project/redo-prompt',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RedoLastUserPromptSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, mode, updatedPrompt } = parsed;
        await this.eventsHandler.redoLastUserPrompt(projectDir, taskId, mode, updatedPrompt);
        res.status(200).json({ message: 'Redo last user prompt initiated' });
      }),
    );

    // Resume task
    router.post(
      '/project/resume-task',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ResumeTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.resumeTask(projectDir, taskId);
        res.status(200).json({ message: 'Task resumed' });
      }),
    );

    // Validate path
    router.post(
      '/project/validate-path',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(IsValidPathSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, path } = parsed;
        const isValid = await this.eventsHandler.isValidPath(projectDir, path);
        res.status(200).json({ isValid });
      }),
    );

    // Is project path
    router.post(
      '/project/is-project-path',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(IsProjectPathSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { path } = parsed;
        const isProject = await this.eventsHandler.isProjectPath(path);
        res.status(200).json({ isProject });
      }),
    );

    // Get file path suggestions
    router.post(
      '/project/file-suggestions',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetFilePathSuggestionsSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { currentPath, directoriesOnly } = parsed;
        const suggestions = await this.eventsHandler.getFilePathSuggestions(currentPath, directoriesOnly);
        res.status(200).json(suggestions);
      }),
    );

    // Paste image
    router.post(
      '/project/paste-image',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(PasteImageSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, base64ImageData } = parsed;

        let imageBuffer: Buffer | undefined;
        if (base64ImageData) {
          const base64String = base64ImageData.split(',')[1] || base64ImageData;
          imageBuffer = Buffer.from(base64String, 'base64');
        }

        await this.eventsHandler.pasteImage(projectDir, taskId, imageBuffer);
        res.status(200).json({ message: 'Image pasted' });
      }),
    );

    // Apply edits
    router.post(
      '/project/apply-edits',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ApplyEditsSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, edits } = parsed;
        this.eventsHandler.applyEdits(projectDir, taskId, edits);
        res.status(200).json({ message: 'Edits applied' });
      }),
    );

    // Run command
    router.post(
      '/project/run-command',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RunCommandSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, command } = parsed;
        this.eventsHandler.runCommand(projectDir, taskId, command);
        res.status(200).json({ message: 'Command executed' });
      }),
    );

    // Init project rules file
    router.post(
      '/project/init-rules',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(InitProjectRulesFileSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.initProjectRulesFile(projectDir, taskId);
        res.status(200).json({ message: 'Project rules file initialized' });
      }),
    );

    // Create new task
    router.post(
      '/project/tasks/new',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CreateNewTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, parentId, name } = parsed;
        const params: CreateTaskParams = { parentId, name };
        const task = await this.eventsHandler.createNewTask(projectDir, params);
        res.status(200).json(task);
      }),
    );

    // Save task
    router.post(
      '/project/tasks',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, id, updates } = parsed;
        const savedTask = await this.eventsHandler.updateTask(projectDir, id, updates);
        res.status(200).json(savedTask);
      }),
    );

    // Load task messages
    router.post(
      '/project/tasks/load',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, id } = parsed;
        const taskContextData = await this.eventsHandler.loadTask(projectDir, id);
        res.status(200).json(taskContextData);
      }),
    );

    // List tasks
    router.get(
      '/project/tasks',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ListTasksSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const tasks = await this.eventsHandler.getTasks(projectDir);
        res.status(200).json(tasks);
      }),
    );

    // Delete session
    router.post(
      '/project/tasks/delete',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DeleteTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, id } = parsed;
        await this.eventsHandler.deleteTask(projectDir, id);
        res.status(200).json({ message: 'Task deleted' });
      }),
    );

    // Duplicate task
    router.post(
      '/project/tasks/duplicate',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DuplicateTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const duplicatedTask = await this.eventsHandler.duplicateTask(projectDir, taskId);
        res.status(200).json(duplicatedTask);
      }),
    );

    // Fork task from message
    router.post(
      '/project/tasks/fork',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ForkTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, messageId } = parsed;
        const forkedTask = await this.eventsHandler.forkTask(projectDir, taskId, messageId);
        res.status(200).json(forkedTask);
      }),
    );

    // Reset task
    router.post(
      '/project/tasks/reset',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ResetTaskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.resetTask(projectDir, taskId);
        res.status(200).json({ message: 'Task reset' });
      }),
    );

    // Load task data
    router.post(
      '/project/tasks/load',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetTaskContextDataSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, id } = parsed;
        const contextData = await this.eventsHandler.loadTask(projectDir, id);
        res.status(200).json(contextData);
      }),
    );

    // Export session to markdown
    router.post(
      '/project/tasks/export-markdown',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ExportSessionToMarkdownSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const markdownContent = await this.eventsHandler.generateTaskMarkdown(projectDir, taskId);

        if (!markdownContent) {
          res.status(404).json({ error: 'Task not found or no content to export' });
          return;
        }

        const filename = `session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.md`;
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(markdownContent);
      }),
    );

    // Remove last message
    router.post(
      '/project/remove-last-message',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveLastMessageSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.removeLastMessage(projectDir, taskId);
        res.status(200).json({ message: 'Last message removed' });
      }),
    );

    // Remove message by ID
    router.delete(
      '/project/remove-message',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveMessageSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, messageId } = parsed;
        await this.eventsHandler.removeMessage(projectDir, taskId, messageId);
        res.status(200).json({ message: 'Message removed' });
      }),
    );

    // Remove messages up to specified message ID
    router.delete(
      '/project/remove-messages-up-to',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveMessagesUpToSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, messageId } = parsed;
        await this.eventsHandler.removeMessagesUpTo(projectDir, taskId, messageId);
        res.status(200).json({ message: 'Messages removed' });
      }),
    );

    // Compact conversation
    router.post(
      '/project/compact-conversation',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CompactConversationSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, mode, customInstructions } = parsed;
        await this.eventsHandler.compactConversation(projectDir, taskId, mode, customInstructions);
        res.status(200).json({ message: 'Conversation compacted' });
      }),
    );

    // Handoff conversation
    router.post(
      '/project/handoff-conversation',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(HandoffConversationSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, focus } = parsed;
        await this.eventsHandler.handoffConversation(projectDir, taskId, focus);
        res.status(200).json({ message: 'Conversation handed off' });
      }),
    );

    // Run code inline request
    router.post(
      '/project/run-code-inline-request',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RunCodeInlineRequestSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, filename, lineNumber, userComment } = parsed;
        await this.eventsHandler.runCodeInlineRequest(projectDir, taskId, filename, lineNumber, userComment);
        res.status(200).json({ message: 'Code inline request initiated' });
      }),
    );

    // Scrape web
    router.post(
      '/project/scrape-web',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ScrapeWebSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, url, filePath } = parsed;
        await this.eventsHandler.scrapeWeb(projectDir, taskId, url, filePath);
        res.status(200).json({ message: 'Web content scraped and added to context' });
      }),
    );

    // Merge worktree to main
    router.post(
      '/project/worktree/merge-to-main',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(MergeWorktreeToMainSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, squash, targetBranch, commitMessage } = parsed;
        await this.eventsHandler.mergeWorktreeToMain(projectDir, taskId, squash, targetBranch, commitMessage);
        res.status(200).json({ message: 'Worktree merged' });
      }),
    );

    // Apply uncommitted changes
    router.post(
      '/project/worktree/apply-uncommitted',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ApplyUncommittedChangesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, targetBranch } = parsed;
        await this.eventsHandler.applyUncommittedChanges(projectDir, taskId, targetBranch);
        res.status(200).json({ message: 'Uncommitted changes applied' });
      }),
    );

    // Revert last merge
    router.post(
      '/project/worktree/revert-last-merge',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RevertLastMergeSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.revertLastMerge(projectDir, taskId);
        res.status(200).json({ message: 'Last merge reverted' });
      }),
    );

    // Restore file
    router.post(
      '/project/worktree/restore-file',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RestoreFileSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, filePath } = parsed;
        await this.eventsHandler.restoreFile(projectDir, taskId, filePath);
        res.status(200).json({ message: 'File restored' });
      }),
    );

    // Generate commit message
    router.post(
      '/project/worktree/generate-commit-message',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GenerateCommitMessageSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const message = await this.eventsHandler.generateCommitMessage(projectDir, taskId);
        res.status(200).json({ message });
      }),
    );

    // Commit changes
    router.post(
      '/project/worktree/commit-changes',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CommitChangesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, message, amend } = parsed;
        await this.eventsHandler.commitChanges(projectDir, taskId, message, amend);
        res.status(200).json({ message: 'Changes committed' });
      }),
    );

    // List branches
    router.get(
      '/project/worktree/branches',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ListBranchesSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const branches = await this.eventsHandler.listBranches(projectDir);
        res.status(200).json(branches);
      }),
    );

    // Worktree status
    router.get(
      '/project/worktree/status',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(WorktreeStatusSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, targetBranch } = parsed;
        const status = await this.eventsHandler.getWorktreeIntegrationStatus(projectDir, taskId, targetBranch);
        res.status(200).json(status);
      }),
    );

    // Rebase worktree from branch
    router.post(
      '/project/worktree/rebase-from-branch',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RebaseWorktreeFromBranchSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, fromBranch } = parsed;
        await this.eventsHandler.rebaseWorktreeFromBranch(projectDir, taskId, fromBranch);
        res.status(200).json({ message: 'Worktree rebased' });
      }),
    );

    // Abort worktree rebase
    router.post(
      '/project/worktree/abort-rebase',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(AbortWorktreeRebaseSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.abortWorktreeRebase(projectDir, taskId);
        res.status(200).json({ message: 'Rebase aborted' });
      }),
    );

    // Continue worktree rebase
    router.post(
      '/project/worktree/continue-rebase',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ContinueWorktreeRebaseSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.continueWorktreeRebase(projectDir, taskId);
        res.status(200).json({ message: 'Rebase continued' });
      }),
    );

    // Resolve worktree conflicts with agent
    router.post(
      '/project/worktree/resolve-conflicts-with-agent',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ResolveWorktreeConflictsWithAgentSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.resolveConflictsWithAgent(projectDir, taskId);
        res.status(200).json({ message: 'Conflicts resolved' });
      }),
    );

    // Update open projects order
    router.post(
      '/project/update-order',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateOpenProjectsOrderSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDirs } = parsed;
        const projects = this.eventsHandler.updateOpenProjectsOrder(projectDirs);
        res.status(200).json(projects);
      }),
    );

    // Remove open project
    router.post(
      '/project/remove-open',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveOpenProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const projects = this.eventsHandler.removeOpenProject(projectDir);
        res.status(200).json(projects);
      }),
    );

    // Set active project
    router.post(
      '/project/set-active',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SetActiveProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const projects = await this.eventsHandler.setActiveProject(projectDir);
        res.status(200).json(projects);
      }),
    );

    // Restart project
    router.post(
      '/project/restart',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RestartProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        await this.eventsHandler.restartProject(projectDir);
        res.status(200).json({ message: 'Project restarted' });
      }),
    );

    // Get project settings
    router.get(
      '/project/settings',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetProjectSettingsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const projectSettings = this.eventsHandler.getProjectSettings(projectDir);
        res.status(200).json(projectSettings);
      }),
    );

    // Update project settings
    router.patch(
      '/project/settings',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(PatchProjectSettingsSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, ...settings } = parsed;
        const updatedSettings = await this.eventsHandler.patchProjectSettings(projectDir, settings);
        res.status(200).json(updatedSettings);
      }),
    );

    // Interrupt project
    router.post(
      '/project/interrupt',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(InterruptSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        await this.eventsHandler.interruptResponse(projectDir, taskId);
        res.status(200).json({ message: 'Interrupt signal sent' });
      }),
    );

    // Clear project context
    router.post(
      '/project/clear-context',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ClearContextSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        this.eventsHandler.clearContext(projectDir, taskId);
        res.status(200).json({ message: 'Context cleared' });
      }),
    );

    // Answer project question
    router.post(
      '/project/answer-question',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(AnswerQuestionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, answer } = parsed;
        await this.eventsHandler.answerQuestion(projectDir, taskId, answer);
        res.status(200).json({ message: 'Answer submitted' });
      }),
    );

    // Remove queued prompt
    router.post(
      '/project/remove-queued-prompt',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveQueuedPromptSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, promptId } = parsed;
        this.eventsHandler.removeQueuedPrompt(projectDir, taskId, promptId);
        res.status(200).json({ message: 'Queued prompt removed' });
      }),
    );

    // Send queued prompt immediately
    router.post(
      '/project/send-queued-prompt-now',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SendQueuedPromptNowSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, promptId } = parsed;
        await this.eventsHandler.sendQueuedPromptNow(projectDir, taskId, promptId);
        res.status(200).json({ message: 'Queued prompt sent' });
      }),
    );

    // Update main model
    router.post(
      '/project/settings/main-model',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateMainModelSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, mainModel } = parsed;
        this.eventsHandler.updateMainModel(projectDir, taskId, mainModel);
        res.status(200).json({ message: 'Main model updated' });
      }),
    );

    // Update weak model
    router.post(
      '/project/settings/weak-model',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateWeakModelSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, weakModel } = parsed;
        this.eventsHandler.updateWeakModel(projectDir, taskId, weakModel);
        res.status(200).json({ message: 'Weak model updated' });
      }),
    );

    // Update architect model
    router.post(
      '/project/settings/architect-model',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateArchitectModelSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, architectModel } = parsed;
        this.eventsHandler.updateArchitectModel(projectDir, taskId, architectModel);
        res.status(200).json({ message: 'Architect model updated' });
      }),
    );

    // Update edit formats
    router.post(
      '/project/settings/edit-formats',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateEditFormatsSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, editFormats } = parsed;
        this.eventsHandler.updateEditFormats(projectDir, editFormats);
        res.status(200).json({ message: 'Edit formats updated' });
      }),
    );

    // Start project
    router.post(
      '/project/start',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(StartProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        await this.eventsHandler.startProject(projectDir);
        res.status(200).json({ message: 'Project started' });
      }),
    );

    // Stop project
    router.post(
      '/project/stop',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(StopProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        await this.eventsHandler.stopProject(projectDir);
        res.status(200).json({ message: 'Project stopped' });
      }),
    );

    // Add open project
    router.post(
      '/project/add-open',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(AddOpenProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const projects = await this.eventsHandler.addOpenProject(projectDir);
        res.status(200).json(projects);
      }),
    );
  }
}
