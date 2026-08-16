/**
 * Catalog of static UI actions invokable from the command palette,
 * toolbar buttons, hotkeys, and (future) the extension system.
 *
 * Ids are stable contracts — persisted in palette recently-used localStorage
 * and reserved for external callers. Never rename existing ids.
 */
export interface UiActionInfo {
  /** Stable identifier (e.g. 'settings.mcpServers'). */
  id: string;
  /** i18n key for the action label */
  labelKey: string;
  /** Optional i18n key for the action description */
  descriptionKey?: string;
}

export const UI_ACTIONS = [
  // Project
  { id: 'project.close', labelKey: 'settings.hotkeys.closeProject' },
  { id: 'project.new', labelKey: 'settings.hotkeys.newProject' },
  { id: 'project.cycleNext', labelKey: 'settings.hotkeys.cycleNextProject' },
  { id: 'project.cyclePrev', labelKey: 'settings.hotkeys.cyclePrevProject' },

  // View
  { id: 'view.settings', labelKey: 'settings.hotkeys.settings' },
  { id: 'view.usageDashboard', labelKey: 'settings.hotkeys.usageDashboard' },
  { id: 'view.modelLibrary', labelKey: 'settings.hotkeys.modelLibrary' },
  { id: 'view.showLogs', labelKey: 'uiActions.showLogs' },

  // Task
  { id: 'task.new', labelKey: 'settings.hotkeys.newTask' },
  { id: 'task.focusPrompt', labelKey: 'settings.hotkeys.focusPrompt' },
  { id: 'task.archive', labelKey: 'uiActions.archiveTask' },
  { id: 'task.unarchive', labelKey: 'uiActions.unarchiveTask' },
  { id: 'task.delete', labelKey: 'uiActions.deleteTask' },
  { id: 'task.duplicate', labelKey: 'uiActions.duplicateTask' },
  { id: 'task.exportImage', labelKey: 'uiActions.exportTaskImage' },
  { id: 'task.exportMarkdown', labelKey: 'uiActions.exportTaskMarkdown' },
  { id: 'task.copyMarkdown', labelKey: 'uiActions.copyTaskMarkdown' },
  { id: 'task.interrupt', labelKey: 'uiActions.interruptResponse' },
  { id: 'task.restartConnector', labelKey: 'uiActions.restartConnector' },
  { id: 'task.togglePin', labelKey: 'uiActions.togglePin' },
  { id: 'task.moveToTop', labelKey: 'uiActions.moveToTop' },

  // Task: selectors
  { id: 'task.modelSelector', labelKey: 'uiActions.openModelSelector' },
  { id: 'task.agentProfileSelector', labelKey: 'uiActions.changeAgentProfile' },

  // Task: autonomy modes
  { id: 'task.autonomy.manual', labelKey: 'promptField.autonomyManual', descriptionKey: 'uiActions.setAutonomyMode' },
  { id: 'task.autonomy.guided', labelKey: 'promptField.autonomyGuided', descriptionKey: 'uiActions.setAutonomyMode' },
  { id: 'task.autonomy.autonomous', labelKey: 'promptField.autonomyAutonomous', descriptionKey: 'uiActions.setAutonomyMode' },

  // Task: working mode
  { id: 'task.workingMode.local', labelKey: 'uiActions.switchToLocal', descriptionKey: 'uiActions.switchWorkingMode' },
  { id: 'task.workingMode.worktree', labelKey: 'uiActions.switchToWorktree', descriptionKey: 'uiActions.switchWorkingMode' },

  // Editor
  { id: 'editor.open', labelKey: 'settings.hotkeys.openEditor' },

  // Settings navigation
  { id: 'settings.general', labelKey: 'settings.tabs.general', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.aider', labelKey: 'settings.tabs.aider', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.agents', labelKey: 'settings.tabs.agents', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.mcpServers', labelKey: 'settings.tabs.mcpServers', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.tasks', labelKey: 'settings.tabs.tasks', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.memory', labelKey: 'settings.tabs.memory', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.voice', labelKey: 'settings.tabs.voice', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.hotkeys', labelKey: 'settings.tabs.hotkeys', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.extensions', labelKey: 'settings.tabs.extensions', descriptionKey: 'uiActions.openSettingsPage' },
  { id: 'settings.about', labelKey: 'settings.tabs.about', descriptionKey: 'uiActions.openSettingsPage' },
] as const satisfies readonly UiActionInfo[];

export type UiActionId = (typeof UI_ACTIONS)[number]['id'];
