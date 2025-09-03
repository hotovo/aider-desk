import { EditFormat, FileEdit, McpServerConfig, Mode, ProjectSettings, SettingsData, StartupMode, TodoItem } from '@common/types';
import { ipcMain } from 'electron';

import { EventsHandler } from './events-handler';

export const setupIpcHandlers = (eventsHandler: EventsHandler) => {
  ipcMain.handle('load-settings', () => {
    return eventsHandler.loadSettings();
  });

  ipcMain.handle('save-settings', (_, newSettings: SettingsData) => {
    return eventsHandler.saveSettings(newSettings);
  });

  ipcMain.on('run-prompt', async (_, baseDir: string, prompt: string, mode?: Mode) => {
    eventsHandler.runPrompt(baseDir, prompt, mode);
  });

  ipcMain.on('answer-question', (_, baseDir: string, answer: string) => {
    eventsHandler.answerQuestion(baseDir, answer);
  });

  ipcMain.on('drop-file', (_, baseDir: string, filePath: string) => {
    void eventsHandler.dropFile(baseDir, filePath);
  });

  ipcMain.on('add-file', (_, baseDir: string, filePath: string, readOnly = false) => {
    void eventsHandler.addFile(baseDir, filePath, readOnly);
  });

  ipcMain.on('start-project', (_, baseDir: string) => {
    eventsHandler.startProject(baseDir);
  });

  ipcMain.on('stop-project', async (_, baseDir: string) => {
    await eventsHandler.stopProject(baseDir);
  });

  ipcMain.on('restart-project', async (_, baseDir: string, startupMode?: StartupMode) => {
    await eventsHandler.restartProject(baseDir, startupMode);
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

  ipcMain.handle('get-addable-files', async (_, baseDir: string) => {
    return await eventsHandler.getAddableFiles(baseDir);
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

  ipcMain.on('update-main-model', (_, baseDir: string, mainModel: string) => {
    eventsHandler.updateMainModel(baseDir, mainModel);
  });

  ipcMain.on('update-weak-model', (_, baseDir: string, weakModel: string) => {
    eventsHandler.updateWeakModel(baseDir, weakModel);
  });

  ipcMain.on('update-architect-model', (_, baseDir: string, architectModel: string) => {
    eventsHandler.updateArchitectModel(baseDir, architectModel);
  });

  ipcMain.on('update-edit-formats', (_, baseDir: string, updatedFormats: Record<string, EditFormat>) => {
    eventsHandler.updateEditFormats(baseDir, updatedFormats);
  });

  ipcMain.on('run-command', (_, baseDir: string, command: string) => {
    eventsHandler.runCommand(baseDir, command);
  });

  ipcMain.on('paste-image', async (_, baseDir: string) => {
    await eventsHandler.pasteImage(baseDir);
  });

  ipcMain.on('interrupt-response', (_, baseDir: string) => {
    eventsHandler.interruptResponse(baseDir);
  });

  ipcMain.on('apply-edits', (_, baseDir: string, edits: FileEdit[]) => {
    eventsHandler.applyEdits(baseDir, edits);
  });

  ipcMain.on('clear-context', (_, baseDir: string) => {
    eventsHandler.clearContext(baseDir);
  });

  ipcMain.on('remove-last-message', (_, baseDir: string) => {
    void eventsHandler.removeLastMessage(baseDir);
  });

  ipcMain.on('redo-last-user-prompt', (_, baseDir: string, mode: Mode, updatedPrompt?: string) => {
    void eventsHandler.redoLastUserPrompt(baseDir, mode, updatedPrompt);
  });

  ipcMain.handle('compact-conversation', async (_event, baseDir, mode: Mode, customInstructions?: string) => {
    return await eventsHandler.compactConversation(baseDir, mode, customInstructions);
  });

  ipcMain.handle('scrape-web', async (_, baseDir: string, url: string, filePath?: string) => {
    await eventsHandler.scrapeWeb(baseDir, url, filePath);
  });

  ipcMain.handle('save-session', async (_, baseDir: string, name: string) => {
    return await eventsHandler.saveSession(baseDir, name);
  });

  ipcMain.handle('load-session-messages', async (_, baseDir: string, name: string) => {
    return await eventsHandler.loadSessionMessages(baseDir, name);
  });

  ipcMain.handle('load-session-files', async (_, baseDir: string, name: string) => {
    return await eventsHandler.loadSessionFiles(baseDir, name);
  });

  ipcMain.handle('delete-session', async (_, baseDir: string, name: string) => {
    return await eventsHandler.deleteSession(baseDir, name);
  });

  ipcMain.handle('list-sessions', async (_, baseDir: string) => {
    return await eventsHandler.listSessions(baseDir);
  });

  ipcMain.handle('load-mcp-server-tools', async (_, serverName: string, config?: McpServerConfig) => {
    return await eventsHandler.loadMcpServerTools(serverName, config);
  });

  ipcMain.handle('reload-mcp-servers', async (_, mcpServers: Record<string, McpServerConfig>, force = false) => {
    await eventsHandler.reloadMcpServers(mcpServers, force);
  });

  ipcMain.handle('export-session-to-markdown', async (_, baseDir: string) => {
    return await eventsHandler.exportSessionToMarkdown(baseDir);
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

  ipcMain.handle('load-models-info', async () => {
    return await eventsHandler.loadModelsInfo();
  });

  ipcMain.handle('init-project-rules-file', async (_, baseDir: string) => {
    return await eventsHandler.initProjectRulesFile(baseDir);
  });

  ipcMain.handle('get-todos', async (_, baseDir: string) => {
    return await eventsHandler.getTodos(baseDir);
  });

  ipcMain.handle('add-todo', async (_, baseDir: string, name: string) => {
    return await eventsHandler.addTodo(baseDir, name);
  });

  ipcMain.handle('update-todo', async (_, baseDir: string, name: string, updates: Partial<TodoItem>) => {
    return await eventsHandler.updateTodo(baseDir, name, updates);
  });

  ipcMain.handle('delete-todo', async (_, baseDir: string, name: string) => {
    return await eventsHandler.deleteTodo(baseDir, name);
  });

  ipcMain.handle('clear-all-todos', async (_, baseDir: string) => {
    return await eventsHandler.clearAllTodos(baseDir);
  });

  ipcMain.handle('query-usage-data', async (_, from: string, to: string) => {
    return eventsHandler.queryUsageData(new Date(from), new Date(to));
  });

  ipcMain.handle('get-effective-environment-variable', (_, key: string, baseDir?: string) => {
    return eventsHandler.getEffectiveEnvironmentVariable(key, baseDir);
  });

  ipcMain.handle('open-logs-directory', async () => {
    return await eventsHandler.openLogsDirectory();
  });

  ipcMain.handle('get-custom-commands', async (_, baseDir: string) => {
    return eventsHandler.getCustomCommands(baseDir);
  });

  ipcMain.handle('run-custom-command', async (_, baseDir: string, commandName: string, args: string[], mode: Mode) => {
    await eventsHandler.runCustomCommand(baseDir, commandName, args, mode);
  });

  // Terminal handlers
  ipcMain.handle('terminal-create', async (_, baseDir: string, cols?: number, rows?: number) => {
    return await eventsHandler.createTerminal(baseDir, cols, rows);
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

  ipcMain.handle('terminal-get-for-project', async (_, baseDir: string) => {
    return eventsHandler.getTerminalForProject(baseDir);
  });

  ipcMain.handle('terminal-get-all-for-project', async (_, baseDir: string) => {
    return eventsHandler.getTerminalsForProject(baseDir);
  });
};
