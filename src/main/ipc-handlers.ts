import {
  EditFormat,
  FileEdit,
  McpServerConfig,
  Mode,
  Model,
  ProjectSettings,
  ProviderProfile,
  SettingsData,
  TaskData,
  CreateTaskParams,
  TodoItem,
  AgentProfile,
} from '@common/types';
import { ipcMain, clipboard } from 'electron';

import { EventsHandler } from './events-handler';

import type { ExtensionMetadata } from '@common/extensions';
import type { ExtensionManager } from './extensions/extension-manager';

import { ServerController } from '@/server';

export interface ExtensionInfo {
  metadata: ExtensionMetadata;
  filePath: string;
  initialized: boolean;
}

export const setupIpcHandlers = (eventsHandler: EventsHandler, serverController: ServerController, extensionManager?: ExtensionManager) => {
  // Voice handlers
  ipcMain.handle('create-voice-session', async (_, provider: ProviderProfile) => {
    return await eventsHandler.createVoiceSession(provider);
  });

  ipcMain.handle('load-settings', () => {
    return eventsHandler.loadSettings();
  });

  ipcMain.handle('save-settings', (_, newSettings: SettingsData) => {
    return eventsHandler.saveSettings(newSettings);
  });

  ipcMain.on('run-prompt', async (_, baseDir: string, taskId: string, prompt: string, mode?: Mode) => {
    void eventsHandler.runPrompt(baseDir, taskId, prompt, mode);
  });

  ipcMain.handle('save-prompt', async (_, baseDir: string, taskId: string, prompt: string) => {
    return await eventsHandler.savePrompt(baseDir, taskId, prompt);
  });

  ipcMain.on('answer-question', (_, baseDir: string, taskId: string, answer: string) => {
    void eventsHandler.answerQuestion(baseDir, taskId, answer);
  });

  ipcMain.on('remove-queued-prompt', (_, baseDir: string, taskId: string, promptId: string) => {
    eventsHandler.removeQueuedPrompt(baseDir, taskId, promptId);
  });

  ipcMain.on('send-queued-prompt-now', async (_, baseDir: string, taskId: string, promptId: string) => {
    await eventsHandler.sendQueuedPromptNow(baseDir, taskId, promptId);
  });

  ipcMain.on('drop-file', (_, baseDir: string, taskId: string, filePath: string) => {
    void eventsHandler.dropFile(baseDir, taskId, filePath);
  });

  ipcMain.on('add-file', (_, baseDir: string, taskId: string, filePath: string, readOnly = false) => {
    void eventsHandler.addFile(baseDir, taskId, filePath, readOnly);
  });

  ipcMain.handle('start-project', (_, baseDir: string) => {
    return eventsHandler.startProject(baseDir);
  });

  ipcMain.on('stop-project', async (_, baseDir: string) => {
    await eventsHandler.stopProject(baseDir);
  });

  ipcMain.on('restart-project', async (_, baseDir: string) => {
    await eventsHandler.restartProject(baseDir);
  });

  ipcMain.on('reset-task', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.resetTask(baseDir, taskId);
  });

  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogSyncOptions) => {
    return await eventsHandler.showOpenDialog(options);
  });

  ipcMain.handle('load-input-history', async (_, baseDir: string) => {
    return await eventsHandler.loadInputHistory(baseDir);
  });

  ipcMain.handle('get-open-projects', async () => {
    return eventsHandler.getOpenProjects();
  });

  ipcMain.handle('add-open-project', async (_, baseDir: string) => {
    return eventsHandler.addOpenProject(baseDir);
  });

  ipcMain.handle('remove-open-project', async (_, baseDir: string) => {
    return eventsHandler.removeOpenProject(baseDir);
  });

  ipcMain.handle('set-active-project', async (_, baseDir: string) => {
    return eventsHandler.setActiveProject(baseDir);
  });

  ipcMain.handle('update-open-projects-order', async (_, baseDirs: string[]) => {
    return eventsHandler.updateOpenProjectsOrder(baseDirs);
  });

  ipcMain.handle('get-recent-projects', async () => {
    return eventsHandler.getRecentProjects();
  });

  ipcMain.handle('add-recent-project', async (_, baseDir: string) => {
    eventsHandler.addRecentProject(baseDir);
  });

  ipcMain.handle('remove-recent-project', async (_, baseDir: string) => {
    eventsHandler.removeRecentProject(baseDir);
  });

  ipcMain.handle('get-project-settings', (_, baseDir: string) => {
    return eventsHandler.getProjectSettings(baseDir);
  });

  ipcMain.handle('patch-project-settings', async (_, baseDir: string, settings: Partial<ProjectSettings>) => {
    return eventsHandler.patchProjectSettings(baseDir, settings);
  });

  ipcMain.handle('get-addable-files', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.getAddableFiles(baseDir, taskId);
  });

  ipcMain.handle('get-all-files', async (_, baseDir: string, taskId: string, useGit = true) => {
    return await eventsHandler.getAllFiles(baseDir, taskId, useGit);
  });

  ipcMain.handle('get-updated-files', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.getUpdatedFiles(baseDir, taskId);
  });

  ipcMain.handle('is-project-path', async (_, path: string) => {
    return await eventsHandler.isProjectPath(path);
  });

  ipcMain.handle('is-valid-path', async (_, baseDir: string, path: string) => {
    return await eventsHandler.isValidPath(baseDir, path);
  });

  ipcMain.handle('get-file-path-suggestions', async (_, currentPath: string, directoriesOnly = true) => {
    return await eventsHandler.getFilePathSuggestions(currentPath, directoriesOnly);
  });

  ipcMain.on('update-main-model', (_, baseDir: string, taskId: string, mainModel: string) => {
    void eventsHandler.updateMainModel(baseDir, taskId, mainModel);
  });

  ipcMain.on('update-weak-model', (_, baseDir: string, taskId: string, weakModel: string) => {
    void eventsHandler.updateWeakModel(baseDir, taskId, weakModel);
  });

  ipcMain.on('update-architect-model', (_, baseDir: string, taskId: string, architectModel: string) => {
    eventsHandler.updateArchitectModel(baseDir, taskId, architectModel);
  });

  ipcMain.on('update-edit-formats', (_, baseDir: string, updatedFormats: Record<string, EditFormat>) => {
    eventsHandler.updateEditFormats(baseDir, updatedFormats);
  });

  ipcMain.on('run-command', (_, baseDir: string, taskId: string, command: string) => {
    eventsHandler.runCommand(baseDir, taskId, command);
  });

  ipcMain.on('paste-image', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.pasteImage(baseDir, taskId);
  });

  ipcMain.on('interrupt-response', (_, baseDir: string, taskId: string, interruptId?: string) => {
    void eventsHandler.interruptResponse(baseDir, taskId, interruptId);
  });

  ipcMain.on('apply-edits', (_, baseDir: string, taskId: string, edits: FileEdit[]) => {
    eventsHandler.applyEdits(baseDir, taskId, edits);
  });

  ipcMain.on('clear-context', (_, baseDir: string, taskId: string) => {
    eventsHandler.clearContext(baseDir, taskId);
  });

  ipcMain.on('remove-last-message', (_, baseDir: string, taskId: string) => {
    void eventsHandler.removeLastMessage(baseDir, taskId);
  });

  ipcMain.handle('remove-message', async (_, baseDir: string, taskId: string, messageId: string) => {
    await eventsHandler.removeMessage(baseDir, taskId, messageId);
    return { message: 'Message removed' };
  });

  ipcMain.handle('remove-messages-up-to', async (_, baseDir: string, taskId: string, messageId: string) => {
    await eventsHandler.removeMessagesUpTo(baseDir, taskId, messageId);
    return { message: 'Messages removed' };
  });

  ipcMain.on('redo-last-user-prompt', (_, baseDir: string, taskId: string, mode: Mode, updatedPrompt?: string) => {
    void eventsHandler.redoLastUserPrompt(baseDir, taskId, mode, updatedPrompt);
  });

  ipcMain.on('resume-task', (_, baseDir: string, taskId: string) => {
    void eventsHandler.resumeTask(baseDir, taskId);
  });

  ipcMain.handle('compact-conversation', async (_event, baseDir: string, taskId: string, mode: Mode, customInstructions?: string) => {
    return await eventsHandler.compactConversation(baseDir, taskId, mode, customInstructions);
  });

  ipcMain.handle('handoff-conversation', async (_event, baseDir: string, taskId: string, focus?: string) => {
    return await eventsHandler.handoffConversation(baseDir, taskId, focus);
  });

  ipcMain.on('run-code-inline-request', async (_, baseDir: string, taskId: string, filename: string, lineNumber: number, userComment: string) => {
    await eventsHandler.runCodeInlineRequest(baseDir, taskId, filename, lineNumber, userComment);
  });

  ipcMain.handle('scrape-web', async (_, baseDir: string, taskId: string, url: string, filePath?: string) => {
    await eventsHandler.scrapeWeb(baseDir, taskId, url, filePath);
  });

  ipcMain.handle('create-new-task', async (_, baseDir: string, params?: CreateTaskParams) => {
    return await eventsHandler.createNewTask(baseDir, params);
  });

  ipcMain.handle('update-task', async (_, baseDir: string, id: string, updates: Partial<TaskData>) => {
    return await eventsHandler.updateTask(baseDir, id, updates);
  });

  ipcMain.handle('delete-task', async (_, baseDir: string, id: string) => {
    return await eventsHandler.deleteTask(baseDir, id);
  });

  ipcMain.handle('duplicate-task', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.duplicateTask(baseDir, taskId);
  });

  ipcMain.handle('fork-task', async (_, baseDir: string, taskId: string, messageId: string) => {
    return await eventsHandler.forkTask(baseDir, taskId, messageId);
  });

  ipcMain.handle('get-tasks', async (_, baseDir: string) => {
    return await eventsHandler.getTasks(baseDir);
  });

  ipcMain.handle('load-task', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.loadTask(baseDir, taskId);
  });

  ipcMain.handle('load-mcp-server-tools', async (_, serverName: string, config?: McpServerConfig) => {
    return await eventsHandler.loadMcpServerTools(serverName, config);
  });

  ipcMain.handle('reload-mcp-servers', async (_, mcpServers: Record<string, McpServerConfig>, force = false) => {
    await eventsHandler.reloadMcpServers(mcpServers, force);
  });

  ipcMain.handle('reload-mcp-server', async (_, serverName: string, config: McpServerConfig) => {
    return await eventsHandler.reloadMcpServer(serverName, config);
  });

  ipcMain.handle('export-task-to-markdown', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.exportTaskToMarkdown(baseDir, taskId);
  });

  ipcMain.handle('set-zoom-level', (_, zoomLevel: number) => {
    eventsHandler.setZoomLevel(zoomLevel);
  });

  ipcMain.handle('get-versions', async (_, forceRefresh = false) => {
    return await eventsHandler.getVersions(forceRefresh);
  });

  ipcMain.handle('download-latest-aiderdesk', async () => {
    await eventsHandler.downloadLatestAiderDesk();
  });

  ipcMain.handle('get-release-notes', () => {
    return eventsHandler.getReleaseNotes();
  });

  ipcMain.handle('clear-release-notes', () => {
    eventsHandler.clearReleaseNotes();
  });

  ipcMain.handle('get-os', () => {
    return eventsHandler.getOS();
  });

  ipcMain.handle('init-project-rules-file', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.initProjectRulesFile(baseDir, taskId);
  });

  ipcMain.handle('get-todos', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.getTodos(baseDir, taskId);
  });

  ipcMain.handle('add-todo', async (_, baseDir: string, taskId: string, name: string) => {
    return await eventsHandler.addTodo(baseDir, taskId, name);
  });

  ipcMain.handle('update-todo', async (_, baseDir: string, taskId: string, name: string, updates: Partial<TodoItem>) => {
    return await eventsHandler.updateTodo(baseDir, taskId, name, updates);
  });

  ipcMain.handle('delete-todo', async (_, baseDir: string, taskId: string, name: string) => {
    return await eventsHandler.deleteTodo(baseDir, taskId, name);
  });

  ipcMain.handle('clear-all-todos', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.clearAllTodos(baseDir, taskId);
  });

  ipcMain.handle('query-usage-data', async (_, from: string, to: string) => {
    return eventsHandler.queryUsageData(new Date(from), new Date(to));
  });

  ipcMain.handle('get-effective-environment-variable', (_, key: string, baseDir?: string) => {
    return eventsHandler.getEffectiveEnvironmentVariable(key, baseDir);
  });

  ipcMain.handle('open-logs-directory', async () => {
    return eventsHandler.openLogsDirectory();
  });

  ipcMain.handle('open-path', async (_, path: string) => {
    return eventsHandler.openPath(path);
  });

  ipcMain.handle('get-commands', async (_, baseDir: string) => {
    return eventsHandler.getCommands(baseDir);
  });

  ipcMain.handle('run-custom-command', async (_, baseDir: string, taskId: string, commandName: string, args: string[], mode: Mode) => {
    await eventsHandler.runCustomCommand(baseDir, taskId, commandName, args, mode);
  });

  // Terminal handlers
  ipcMain.handle('terminal-create', async (_, baseDir: string, taskId: string, cols?: number, rows?: number) => {
    return await eventsHandler.createTerminal(baseDir, taskId, cols, rows);
  });

  ipcMain.handle('terminal-write', async (_, terminalId: string, data: string) => {
    return eventsHandler.writeToTerminal(terminalId, data);
  });

  ipcMain.handle('terminal-resize', async (_, terminalId: string, cols: number, rows: number) => {
    return eventsHandler.resizeTerminal(terminalId, cols, rows);
  });

  ipcMain.handle('terminal-close', async (_, terminalId: string) => {
    return eventsHandler.closeTerminal(terminalId);
  });

  ipcMain.handle('terminal-get-for-task', async (_, taskId: string) => {
    return eventsHandler.getTerminalForTask(taskId);
  });

  ipcMain.handle('terminal-get-all-for-task', async (_, taskId: string) => {
    return eventsHandler.getTerminalsForTask(taskId);
  });

  // Worktree merge handlers
  ipcMain.handle('merge-worktree-to-main', async (_, baseDir: string, taskId: string, squash: boolean, targetBranch?: string, commitMessage?: string) => {
    await eventsHandler.mergeWorktreeToMain(baseDir, taskId, squash, targetBranch, commitMessage);
  });

  ipcMain.handle('apply-uncommitted-changes', async (_, baseDir: string, taskId: string, targetBranch?: string) => {
    await eventsHandler.applyUncommittedChanges(baseDir, taskId, targetBranch);
  });

  ipcMain.handle('revert-last-merge', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.revertLastMerge(baseDir, taskId);
  });

  ipcMain.handle('restore-file', async (_, baseDir: string, taskId: string, filePath: string) => {
    await eventsHandler.restoreFile(baseDir, taskId, filePath);
  });

  ipcMain.handle('generate-commit-message', async (_, baseDir: string, taskId: string) => {
    return await eventsHandler.generateCommitMessage(baseDir, taskId);
  });

  ipcMain.handle('commit-changes', async (_, baseDir: string, taskId: string, message: string, amend: boolean) => {
    await eventsHandler.commitChanges(baseDir, taskId, message, amend);
  });

  ipcMain.handle('list-branches', async (_, baseDir: string) => {
    return await eventsHandler.listBranches(baseDir);
  });

  ipcMain.handle('get-worktree-integration-status', async (_, baseDir: string, taskId: string, targetBranch?: string) => {
    return await eventsHandler.getWorktreeIntegrationStatus(baseDir, taskId, targetBranch);
  });

  ipcMain.handle('rebase-worktree-from-branch', async (_, baseDir: string, taskId: string, fromBranch?: string) => {
    await eventsHandler.rebaseWorktreeFromBranch(baseDir, taskId, fromBranch);
  });

  ipcMain.handle('abort-worktree-rebase', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.abortWorktreeRebase(baseDir, taskId);
  });

  ipcMain.handle('continue-worktree-rebase', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.continueWorktreeRebase(baseDir, taskId);
  });

  ipcMain.handle('resolve-worktree-conflicts-with-agent', async (_, baseDir: string, taskId: string) => {
    await eventsHandler.resolveConflictsWithAgent(baseDir, taskId);
  });

  // Server control handlers
  ipcMain.handle('start-server', async (_, username?: string, password?: string) => {
    const started = await serverController.startServer();
    if (started) {
      eventsHandler.enableServer(username, password);
    }
    return started;
  });

  ipcMain.handle('stop-server', async () => {
    const stopped = await serverController.stopServer();
    if (stopped) {
      eventsHandler.disableServer();
    }
    return stopped;
  });

  // Cloudflare tunnel handlers
  ipcMain.handle('start-cloudflare-tunnel', async () => {
    return await eventsHandler.startCloudflareTunnel();
  });

  ipcMain.handle('stop-cloudflare-tunnel', async () => {
    eventsHandler.stopCloudflareTunnel();
  });

  ipcMain.handle('get-cloudflare-tunnel-status', () => {
    return eventsHandler.getCloudflareTunnelStatus();
  });

  ipcMain.handle('get-provider-models', async (_, reload = false) => {
    return await eventsHandler.getProviderModels(reload);
  });

  ipcMain.handle('get-providers', () => {
    return eventsHandler.getProviders();
  });

  ipcMain.handle('update-providers', async (_, providers: ProviderProfile[]) => {
    await eventsHandler.updateProviders(providers);
    return providers;
  });

  ipcMain.handle('upsert-model', async (_, providerId: string, modelId: string, model: Model) => {
    await eventsHandler.upsertModel(providerId, modelId, model);
    return await eventsHandler.getProviderModels();
  });

  ipcMain.handle('update-models', async (_, modelUpdates: Array<{ providerId: string; modelId: string; model: Model }>) => {
    await eventsHandler.updateModels(modelUpdates);
    return await eventsHandler.getProviderModels();
  });

  ipcMain.handle('delete-model', async (_, providerId: string, modelId: string) => {
    await eventsHandler.deleteModel(providerId, modelId);
    return await eventsHandler.getProviderModels();
  });

  // Agent profile handlers
  ipcMain.handle('get-agent-profiles', async () => {
    return await eventsHandler.getAllAgentProfiles();
  });

  ipcMain.handle('create-agent-profile', async (_, profile: AgentProfile, projectDir?: string) => {
    return await eventsHandler.createAgentProfile(profile, projectDir);
  });

  ipcMain.handle('update-agent-profile', async (_, profile: AgentProfile) => {
    return await eventsHandler.updateAgentProfile(profile);
  });

  ipcMain.handle('delete-agent-profile', async (_, profileId: string) => {
    return await eventsHandler.deleteAgentProfile(profileId);
  });

  ipcMain.handle('update-agent-profiles-order', async (_, agentProfiles: AgentProfile[]) => {
    return await eventsHandler.updateAgentProfilesOrder(agentProfiles);
  });

  // Memory handlers
  ipcMain.handle('list-all-memories', async () => {
    return await eventsHandler.listAllMemories();
  });

  ipcMain.handle('delete-memory', async (_, id: string) => {
    return await eventsHandler.deleteMemory(id);
  });

  ipcMain.handle('delete-project-memories', async (_, projectId: string) => {
    return await eventsHandler.deleteProjectMemories(projectId);
  });

  ipcMain.handle('get-memory-embedding-progress', async () => {
    return eventsHandler.getMemoryEmbeddingProgress();
  });

  // BMAD handlers
  ipcMain.handle('bmad-install', async (_, projectDir: string) => {
    return await eventsHandler.installBmad(projectDir);
  });

  ipcMain.handle('bmad-get-status', async (_, projectDir: string) => {
    return await eventsHandler.getBmadStatus(projectDir);
  });

  ipcMain.handle(
    'bmad-execute-workflow',
    async (_, projectDir: string, taskId: string, workflowId: string, options?: { asSubtask?: boolean; provider?: string; model?: string }) => {
      return await eventsHandler.executeWorkflow(projectDir, taskId, workflowId, options);
    },
  );

  ipcMain.handle('bmad-reset-workflow', async (_, projectDir: string) => {
    return await eventsHandler.resetBmadWorkflow(projectDir);
  });

  ipcMain.handle('clipboard-write-text', async (_, text: string) => {
    clipboard.writeText(text);
  });

  // Extension handlers
  ipcMain.handle('get-extensions', (): ExtensionInfo[] => {
    if (!extensionManager) {
      return [];
    }
    return extensionManager.getExtensions().map((ext) => ({
      metadata: ext.metadata,
      filePath: ext.filePath,
      initialized: ext.initialized,
    }));
  });
};
