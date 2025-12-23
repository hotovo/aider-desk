import { HotkeyConfig } from '@common/types';

export const DEFAULT_HOTKEY_CONFIG: HotkeyConfig = {
  projectHotkeys: {
    closeProject: 'mod+w',
    newProject: 'mod+t',
    usageDashboard: 'mod+u',
    modelLibrary: 'mod+m',
    settings: 'mod+s',
    switchProject1: 'alt+1,meta+1',
    switchProject2: 'alt+2,meta+2',
    switchProject3: 'alt+3,meta+3',
    switchProject4: 'alt+4,meta+4',
    switchProject5: 'alt+5,meta+5',
    switchProject6: 'alt+6,meta+6',
    switchProject7: 'alt+7,meta+7',
    switchProject8: 'alt+8,meta+8',
    switchProject9: 'alt+9,meta+9',
    cycleNextProject: 'ctrl+tab,control+tab',
    cyclePrevProject: 'ctrl+shift+tab,control+shift+tab',
  },
  taskHotkeys: {
    switchTask1: 'ctrl+1',
    switchTask2: 'ctrl+2',
    switchTask3: 'ctrl+3',
    switchTask4: 'ctrl+4',
    switchTask5: 'ctrl+5',
    switchTask6: 'ctrl+6',
    switchTask7: 'ctrl+7',
    switchTask8: 'ctrl+8',
    switchTask9: 'ctrl+9',
    focusPrompt: 'mod+l',
    newTask: 'mod+shift+t',
    closeTask: 'mod+shift+w',
  },
  dialogHotkeys: {
    browseFolder: 'mod+b',
  },
};

export const getHotkeys = (config?: HotkeyConfig) => {
  const mergedConfig: HotkeyConfig = {
    ...DEFAULT_HOTKEY_CONFIG,
    ...config,
    projectHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.projectHotkeys,
      ...(config?.projectHotkeys ?? {}),
    },
    taskHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.taskHotkeys,
      ...(config?.taskHotkeys ?? {}),
    },
    dialogHotkeys: {
      ...DEFAULT_HOTKEY_CONFIG.dialogHotkeys,
      ...(config?.dialogHotkeys ?? {}),
    },
  };

  const pj = mergedConfig.projectHotkeys;
  const tk = mergedConfig.taskHotkeys;
  const dk = mergedConfig.dialogHotkeys;
  const pjDef = DEFAULT_HOTKEY_CONFIG.projectHotkeys;
  const tkDef = DEFAULT_HOTKEY_CONFIG.taskHotkeys;
  const dkDef = DEFAULT_HOTKEY_CONFIG.dialogHotkeys;

  return {
    PROJECT_HOTKEYS: {
      CLOSE_PROJECT: pj.closeProject || pjDef.closeProject,
      NEW_PROJECT: pj.newProject || pjDef.newProject,
      USAGE_DASHBOARD: pj.usageDashboard || pjDef.usageDashboard,
      MODEL_LIBRARY: pj.modelLibrary || pjDef.modelLibrary,
      SETTINGS: pj.settings || pjDef.settings,
      CYCLE_NEXT_PROJECT: pj.cycleNextProject || pjDef.cycleNextProject,
      CYCLE_PREV_PROJECT: pj.cyclePrevProject || pjDef.cyclePrevProject,
      SWITCH_PROJECT_1: pj.switchProject1 || pjDef.switchProject1,
      SWITCH_PROJECT_2: pj.switchProject2 || pjDef.switchProject2,
      SWITCH_PROJECT_3: pj.switchProject3 || pjDef.switchProject3,
      SWITCH_PROJECT_4: pj.switchProject4 || pjDef.switchProject4,
      SWITCH_PROJECT_5: pj.switchProject5 || pjDef.switchProject5,
      SWITCH_PROJECT_6: pj.switchProject6 || pjDef.switchProject6,
      SWITCH_PROJECT_7: pj.switchProject7 || pjDef.switchProject7,
      SWITCH_PROJECT_8: pj.switchProject8 || pjDef.switchProject8,
      SWITCH_PROJECT_9: pj.switchProject9 || pjDef.switchProject9,
    },
    TASK_HOTKEYS: {
      SWITCH_TASK_1: tk.switchTask1 || tkDef.switchTask1,
      SWITCH_TASK_2: tk.switchTask2 || tkDef.switchTask2,
      SWITCH_TASK_3: tk.switchTask3 || tkDef.switchTask3,
      SWITCH_TASK_4: tk.switchTask4 || tkDef.switchTask4,
      SWITCH_TASK_5: tk.switchTask5 || tkDef.switchTask5,
      SWITCH_TASK_6: tk.switchTask6 || tkDef.switchTask6,
      SWITCH_TASK_7: tk.switchTask7 || tkDef.switchTask7,
      SWITCH_TASK_8: tk.switchTask8 || tkDef.switchTask8,
      SWITCH_TASK_9: tk.switchTask9 || tkDef.switchTask9,
      FOCUS_PROMPT: tk.focusPrompt || tkDef.focusPrompt,
      NEW_TASK: tk.newTask || tkDef.newTask,
      CLOSE_TASK: tk.closeTask || tkDef.closeTask,
    },
    DIALOG_HOTKEYS: {
      BROWSE_FOLDER: dk.browseFolder || dkDef.browseFolder,
    },
  };
};
