import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UI_ACTIONS } from '@common/ui-actions';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { invokeAction, registerAction, unregisterAction } from '@/stores/actionsStore';
import { openSettingsPage } from '@/stores/settingsNavigationStore';
import { PaletteItem, PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';

export const GLOBAL_PALETTE_SCOPE = 'global';

const buildShortcuts = (hotkeys: ReturnType<typeof useConfiguredHotkeys>): Record<string, string> => ({
  'project.close': hotkeys.PROJECT_HOTKEYS.CLOSE_PROJECT,
  'project.new': hotkeys.PROJECT_HOTKEYS.NEW_PROJECT,
  'project.cycleNext': hotkeys.PROJECT_HOTKEYS.CYCLE_NEXT_PROJECT,
  'project.cyclePrev': hotkeys.PROJECT_HOTKEYS.CYCLE_PREV_PROJECT,
  'view.settings': hotkeys.PROJECT_HOTKEYS.SETTINGS,
  'view.usageDashboard': hotkeys.PROJECT_HOTKEYS.USAGE_DASHBOARD,
  'view.modelLibrary': hotkeys.PROJECT_HOTKEYS.MODEL_LIBRARY,
  'task.new': hotkeys.TASK_HOTKEYS.NEW_TASK,
  'task.focusPrompt': hotkeys.TASK_HOTKEYS.FOCUS_PROMPT,
  'editor.open': hotkeys.PROJECT_HOTKEYS.OPEN_EDITOR,
});

const MODULE_ACTIONS: Record<string, () => void> = {
  'view.settings': () => openSettingsPage('general'),
  'settings.general': () => openSettingsPage('general'),
  'settings.aider': () => openSettingsPage('aider'),
  'settings.agents': () => openSettingsPage('agents'),
  'settings.mcpServers': () => openSettingsPage('mcpServers'),
  'settings.tasks': () => openSettingsPage('tasks'),
  'settings.memory': () => openSettingsPage('memory'),
  'settings.voice': () => openSettingsPage('voice'),
  'settings.hotkeys': () => openSettingsPage('hotkeys'),
  'settings.extensions': () => openSettingsPage('extensions'),
  'settings.about': () => openSettingsPage('about'),
};

export const usePaletteCommands = () => {
  const { t, i18n } = useTranslation();
  const hotkeys = useConfiguredHotkeys();
  const replaceItems = useCommandPaletteStore((state) => state.replaceItems);
  const clearItems = useCommandPaletteStore((state) => state.clearItems);

  useEffect(() => {
    const shortcuts = buildShortcuts(hotkeys);

    for (const [id, handler] of Object.entries(MODULE_ACTIONS)) {
      registerAction(id, handler);
    }

    replaceItems(
      GLOBAL_PALETTE_SCOPE,
      UI_ACTIONS.map(
        (info): PaletteItem => ({
          id: info.id,
          label: t(info.labelKey),
          description: 'descriptionKey' in info && info.descriptionKey ? t(info.descriptionKey) : undefined,
          shortcut: shortcuts[info.id],
          type: PaletteItemType.Action,
          action: () => invokeAction(info.id),
        }),
      ),
    );

    return () => {
      for (const id of Object.keys(MODULE_ACTIONS)) {
        unregisterAction(id);
      }
      clearItems(GLOBAL_PALETTE_SCOPE);
    };
  }, [t, i18n.language, hotkeys, replaceItems, clearItems]);
};
