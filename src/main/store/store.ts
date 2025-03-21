import { ProjectData, ProjectSettings, SettingsData, WindowState } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { PROVIDER_MODELS } from '@common/llm-providers';

import logger from '../logger';

import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';

export const DEFAULT_MAIN_MODEL = 'claude-3-7-sonnet-20250219';

const DEFAULT_SETTINGS: SettingsData = {
  aider: {
    options: '',
    environmentVariables: '',
  },
  models: {
    preferred: ['claude-3-7-sonnet-20250219', 'gpt-4o', 'deepseek/deepseek-coder', 'claude-3-5-haiku-20241022'],
  },
  mcpConfig: {
    providers: [
      {
        name: 'anthropic',
        apiKey: '',
        model: PROVIDER_MODELS.anthropic.models[0],
        active: true,
      },
    ],
    maxIterations: 10,
    minTimeBetweenToolCalls: 0,
    mcpServers: {},
    disabledServers: [],
    agentEnabled: false,
    systemPrompt: `You can use tools available to get context related to the user input. Do NOT force any tools, if not specifically mentioned to use some tool.

IMPORTANT RULE FOR 'aider' TOOL:
- The 'aider' tool is SPECIFICALLY for performing coding tasks on various programming languages.
- STRICTLY FORBIDDEN: Do NOT mention ANY programming language names (like Python, JavaScript, Java, C++, etc.) in the prompt.
- Do NOT reference language-specific features, libraries, or syntax in the prompt.
- When a coding task is required, use the Aider tool as the FINAL response, when no other tool is available to perform such task.
- Do NOT use Aider tool when there is other tool that can perform the coding task.
- After using the Aider tool, NO further responses are allowed.
- The Aider tool's prompt should contain the complete instructions for the coding task based on the user input.
- Do NOT suggest implementation details specific to any programming language.
- Do NOT post any code with the task - use only natural language to describe task if not mentioned in the user input.

Never ask any additional questions.`,
  },
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  mainModel: DEFAULT_MAIN_MODEL,
};

const compareBaseDirs = (baseDir1: string, baseDir2: string): boolean => {
  return normalizeBaseDir(baseDir1) === normalizeBaseDir(baseDir2);
};

interface StoreSchema {
  windowState: WindowState;
  openProjects: ProjectData[];
  recentProjects: string[]; // baseDir paths of recently closed projects
  settings: SettingsData;
  settingsVersion: number;
}

const CURRENT_SETTINGS_VERSION = 1;

interface CustomStore<T> {
  get<K extends keyof T>(key: K): T[K] | undefined;
  set<K extends keyof T>(key: K, value: T[K]): void;
}

export class Store {
  // @ts-expect-error expected to be initialized
  private store: CustomStore<StoreSchema>;

  async init(): Promise<void> {
    const ElectronStore = (await import('electron-store')).default;
    this.store = new ElectronStore<StoreSchema>() as unknown as CustomStore<StoreSchema>;
  }

  getSettings(): SettingsData {
    let settings = this.store.get('settings');

    if (settings) {
      settings = this.migrate(settings);
    }

    if (!settings) {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      aider: {
        ...DEFAULT_SETTINGS.aider,
        ...settings?.aider,
      },
      models: {
        ...DEFAULT_SETTINGS.models,
        ...settings?.models,
      },
      mcpConfig: {
        ...DEFAULT_SETTINGS.mcpConfig,
        ...settings?.mcpConfig,
        // use the default system prompt if the user hasn't set one
        systemPrompt: settings?.mcpConfig?.systemPrompt || DEFAULT_SETTINGS.mcpConfig.systemPrompt,
      },
    };
  }

  private migrate(settings: SettingsData): SettingsData {
    let settingsVersion = this.store.get('settingsVersion') || 0;

    if (settingsVersion < CURRENT_SETTINGS_VERSION) {
      logger.info(`Migrating settings from version ${settingsVersion} to ${CURRENT_SETTINGS_VERSION}`);

      if (settingsVersion === 0) {
        settings = migrateSettingsV0toV1(settings);
        settingsVersion = 1;
      }

      // Add more migration steps as needed (e.g., migrateSettingsV1toV2)

      this.store.set('settings', settings);
      this.store.set('settingsVersion', CURRENT_SETTINGS_VERSION);
    }

    return settings;
  }

  saveSettings(settings: SettingsData): void {
    this.store.set('settings', settings);
  }

  getOpenProjects(): ProjectData[] {
    return this.store.get('openProjects') || [];
  }

  setOpenProjects(projects: ProjectData[]): void {
    this.store.set('openProjects', projects);
  }

  getRecentProjects(): string[] {
    const recentProjects = this.store.get('recentProjects') || [];
    const openProjectBaseDirs = this.getOpenProjects().map((p) => p.baseDir);

    return recentProjects.filter((baseDir) => !openProjectBaseDirs.some((openProjectBaseDir) => compareBaseDirs(openProjectBaseDir, baseDir)));
  }

  addRecentProject(baseDir: string): void {
    const recentProjects = this.store.get('recentProjects') || [];
    const filtered = recentProjects.filter((recentProject) => !compareBaseDirs(recentProject, baseDir));

    filtered.unshift(baseDir);

    this.store.set('recentProjects', filtered.slice(0, 10));
  }

  removeRecentProject(baseDir: string): void {
    const recent = this.getRecentProjects();
    this.store.set(
      'recentProjects',
      recent.filter((p) => !compareBaseDirs(p, baseDir)),
    );
  }

  getProjectSettings(baseDir: string): ProjectSettings {
    const projects = this.getOpenProjects();
    const project = projects.find((p) => compareBaseDirs(p.baseDir, baseDir));
    return {
      ...DEFAULT_PROJECT_SETTINGS,
      ...project?.settings,
    };
  }

  saveProjectSettings(baseDir: string, settings: ProjectSettings): void {
    const projects = this.getOpenProjects();

    logger.info('Projects', {
      projects,
    });

    const projectIndex = projects.findIndex((project) => compareBaseDirs(project.baseDir, baseDir));
    if (projectIndex >= 0) {
      projects[projectIndex] = {
        ...projects[projectIndex],
        settings,
      };
      this.setOpenProjects(projects);
      logger.info(`Project settings saved for baseDir: ${baseDir}`, {
        baseDir,
        settings,
      });
    } else {
      logger.warn(`No project found for baseDir: ${baseDir}`, {
        baseDir,
        settings,
      });
    }
  }

  getWindowState(): StoreSchema['windowState'] {
    return this.store.get('windowState') || this.getDefaultWindowState();
  }

  private getDefaultWindowState(): WindowState {
    return {
      width: 900,
      height: 670,
      x: undefined,
      y: undefined,
      isMaximized: false,
    };
  }

  setWindowState(windowState: WindowState): void {
    this.store.set('windowState', windowState);
  }
}

export const appStore = new Store();
