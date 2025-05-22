import { ProjectData, ProjectSettings, SettingsData, StartupMode, WindowState } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { PROVIDER_MODELS } from '@common/llm-providers';
import { parseAiderEnv } from 'src/main/utils';

import logger from '../logger';

import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';
import { migrateSettingsV1toV2 } from './migrations/v1-to-v2';
import { migrateSettingsV2toV3 } from './migrations/v2-to-v3';

const SONNET_MODEL = 'claude-3-7-sonnet-20250219';
const GEMINI_MODEL = 'gemini/gemini-2.5-pro-preview-03-25';
const OPEN_AI_DEFAULT_MODEL = 'gpt-4.1';
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';

export const DEFAULT_MAIN_MODEL = SONNET_MODEL;

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  startupMode: StartupMode.Empty,
  zoomLevel: 1,
  notificationsEnabled: false,
  darkMode: true,
  aiderDeskAutoUpdate: true,
  aider: {
    options: '',
    environmentVariables: '',
  },
  models: {
    preferred: [SONNET_MODEL, GEMINI_MODEL, OPEN_AI_DEFAULT_MODEL, DEEPSEEK_MODEL],
  },
  agentConfig: {
    providers: [
      {
        name: 'anthropic',
        apiKey: '',
        model: Object.keys(PROVIDER_MODELS.anthropic.models)[0],
        active: true,
      },
    ],
    maxIterations: 10,
    maxTokens: 1000,
    minTimeBetweenToolCalls: 0,
    mcpServers: {},
    disabledServers: [],
    toolApprovals: {},
    includeContextFiles: false,
    includeRepoMap: false,
    usePowerTools: false,
    useAiderTools: true,
    customInstructions: '',
  },
};

export const determineMainModel = (settings: SettingsData): string => {
  // Check for --model in aider options
  const modelOptionIndex = settings.aider.options.indexOf('--model ');
  if (modelOptionIndex !== -1) {
    const modelStartIndex = modelOptionIndex + '--model '.length;
    let modelEndIndex = settings.aider.options.indexOf(' ', modelStartIndex);
    if (modelEndIndex === -1) {
      modelEndIndex = settings.aider.options.length;
    }
    const modelName = settings.aider.options.substring(modelStartIndex, modelEndIndex).trim();
    if (modelName) {
      return modelName;
    }
  }

  const env = {
    ...process.env,
    ...parseAiderEnv(settings),
  };
  // Check environment variables in order
  if (env.ANTHROPIC_API_KEY) {
    return SONNET_MODEL;
  } else if (env.GEMINI_API_KEY) {
    return GEMINI_MODEL;
  } else if (env.OPENAI_API_KEY && !env.OPENAI_API_BASE) {
    return OPEN_AI_DEFAULT_MODEL;
  } else if (env.DEEPSEEK_API_KEY) {
    return DEEPSEEK_MODEL;
  } else if (env.OPENROUTER_API_KEY) {
    return 'openrouter/google/gemini-2.5-pro-preview-03-25';
  }

  // Default model if no other condition is met
  return DEFAULT_MAIN_MODEL;
};

export const getDefaultProjectSettings = (store: Store): ProjectSettings => {
  return {
    mainModel: determineMainModel(store.getSettings()),
    currentMode: 'code',
    renderMarkdown: true,
  };
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
  releaseNotes?: string | null;
}

const CURRENT_SETTINGS_VERSION = 3;

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
      agentConfig: {
        ...DEFAULT_SETTINGS.agentConfig,
        ...settings?.agentConfig,
      },
    };
  }

  private migrate(settings: SettingsData): SettingsData {
    let settingsVersion = this.store.get('settingsVersion') ?? CURRENT_SETTINGS_VERSION;

    if (settingsVersion < CURRENT_SETTINGS_VERSION) {
      logger.info(`Migrating settings from version ${settingsVersion} to ${CURRENT_SETTINGS_VERSION}`);

      if (settingsVersion === 0) {
        settings = migrateSettingsV0toV1(settings);
        settingsVersion = 1;
      }

      if (settingsVersion === 1) {
        settings = migrateSettingsV1toV2(settings);
        settingsVersion = 2;
      }

      if (settingsVersion === 2) {
        settings = migrateSettingsV2toV3(settings);
        settingsVersion = 3;
      }

      // Add more migration steps as needed

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
      ...getDefaultProjectSettings(this),
      ...project?.settings,
    };
  }

  saveProjectSettings(baseDir: string, settings: ProjectSettings): ProjectSettings {
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
      return settings;
    } else {
      logger.warn(`No project found for baseDir: ${baseDir}`, {
        baseDir,
        settings,
      });

      return settings;
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

  getReleaseNotes(): string | null {
    return this.store.get('releaseNotes') || null;
  }

  clearReleaseNotes(): void {
    this.store.set('releaseNotes', null);
  }

  setReleaseNotes(releaseNotes: string) {
    this.store.set('releaseNotes', releaseNotes);
  }
}

export const appStore = new Store();
