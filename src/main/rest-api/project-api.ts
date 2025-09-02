import { Router } from 'express';
import { z } from 'zod';
import { StartupMode, ProjectSettingsSchema } from '@common/types';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const RestartProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  startupMode: z.enum(['ask', 'architect', 'context']).optional(),
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
});

const ClearContextSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const AnswerQuestionSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  answer: z.string().min(1, 'Answer is required'),
});

const UpdateMainModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  mainModel: z.string().min(1, 'Main model is required'),
});

const UpdateWeakModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  weakModel: z.string().min(1, 'Weak model is required'),
});

const UpdateArchitectModelSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
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
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context']),
  updatedPrompt: z.string().optional(),
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

const PasteImageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ApplyEditsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  edits: z.array(
    z.object({
      path: z.string(),
      original: z.string(),
      updated: z.string(),
    }),
  ),
});

const RunCommandSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  command: z.string().min(1, 'Command is required'),
});

const InitProjectRulesFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const SaveSessionSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  name: z.string().min(1, 'Session name is required'),
});

const LoadSessionMessagesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  name: z.string().min(1, 'Session name is required'),
});

const LoadSessionFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  name: z.string().min(1, 'Session name is required'),
});

const ListSessionsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const DeleteSessionSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  name: z.string().min(1, 'Session name is required'),
});

const ExportSessionToMarkdownSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RemoveLastMessageSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const CompactConversationSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context']),
  customInstructions: z.string().optional(),
});

const ScrapeWebSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  url: z.string().url('Invalid URL format').min(1, 'URL is required'),
  filePath: z.string().optional(),
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

        const { projectDir, mode, updatedPrompt } = parsed;
        await this.eventsHandler.redoLastUserPrompt(projectDir, mode, updatedPrompt);
        res.status(200).json({ message: 'Redo last user prompt initiated' });
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

        const { projectDir } = parsed;
        await this.eventsHandler.pasteImage(projectDir);
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

        const { projectDir, edits } = parsed;
        this.eventsHandler.applyEdits(projectDir, edits);
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

        const { projectDir, command } = parsed;
        this.eventsHandler.runCommand(projectDir, command);
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

        const { projectDir } = parsed;
        await this.eventsHandler.initProjectRulesFile(projectDir);
        res.status(200).json({ message: 'Project rules file initialized' });
      }),
    );

    // Save session
    router.post(
      '/project/session/save',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SaveSessionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, name } = parsed;
        await this.eventsHandler.saveSession(projectDir, name);
        res.status(200).json({ message: 'Session saved' });
      }),
    );

    // Load session messages
    router.post(
      '/project/session/load-messages',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadSessionMessagesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, name } = parsed;
        await this.eventsHandler.loadSessionMessages(projectDir, name);
        res.status(200).json({ message: 'Session messages loaded' });
      }),
    );

    // Load session files
    router.post(
      '/project/session/load-files',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LoadSessionFilesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, name } = parsed;
        await this.eventsHandler.loadSessionFiles(projectDir, name);
        res.status(200).json({ message: 'Session files loaded' });
      }),
    );

    // List sessions
    router.get(
      '/project/sessions',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ListSessionsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const sessions = await this.eventsHandler.listSessions(projectDir);
        res.status(200).json(sessions);
      }),
    );

    // Delete session
    router.post(
      '/project/session/delete',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DeleteSessionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, name } = parsed;
        await this.eventsHandler.deleteSession(projectDir, name);
        res.status(200).json({ message: 'Session deleted' });
      }),
    );

    // Export session to markdown
    router.post(
      '/project/session/export-markdown',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ExportSessionToMarkdownSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        await this.eventsHandler.exportSessionToMarkdown(projectDir);
        res.status(200).json({ message: 'Session exported to markdown' });
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

        const { projectDir } = parsed;
        await this.eventsHandler.removeLastMessage(projectDir);
        res.status(200).json({ message: 'Last message removed' });
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

        const { projectDir, mode, customInstructions } = parsed;
        await this.eventsHandler.compactConversation(projectDir, mode, customInstructions);
        res.status(200).json({ message: 'Conversation compacted' });
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

        const { projectDir, url, filePath } = parsed;
        await this.eventsHandler.scrapeWeb(projectDir, url, filePath);
        res.status(200).json({ message: 'Web content scraped and added to context' });
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

        const { projectDir, startupMode } = parsed;
        await this.eventsHandler.restartProject(projectDir, startupMode as StartupMode);
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

        const { projectDir } = parsed;
        this.eventsHandler.interruptResponse(projectDir);
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

        const { projectDir } = parsed;
        this.eventsHandler.clearContext(projectDir);
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

        const { projectDir, answer } = parsed;
        this.eventsHandler.answerQuestion(projectDir, answer);
        res.status(200).json({ message: 'Answer submitted' });
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

        const { projectDir, mainModel } = parsed;
        this.eventsHandler.updateMainModel(projectDir, mainModel);
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

        const { projectDir, weakModel } = parsed;
        this.eventsHandler.updateWeakModel(projectDir, weakModel);
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

        const { projectDir, architectModel } = parsed;
        this.eventsHandler.updateArchitectModel(projectDir, architectModel);
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
        this.eventsHandler.startProject(projectDir);
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
        const projects = this.eventsHandler.addOpenProject(projectDir);
        res.status(200).json(projects);
      }),
    );
  }
}
