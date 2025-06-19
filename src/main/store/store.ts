import { v4 as uuidv4 } from 'uuid';
import { AgentProfile, ProjectData, ProjectSettings, SettingsData, StartupMode, SuggestionMode, WindowState } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { DEFAULT_AGENT_PROFILE, LlmProvider, LlmProviderName } from '@common/agent';
import { parseAiderEnv, readAiderConfProperty } from 'src/main/utils';
import { migrateSettingsV5toV6 } from 'src/main/store/migrations/v5-to-v6';

import logger from '../logger';

import { migrateV6ToV7 } from './migrations/v6-to-v7';
import { migrateV7ToV8 } from './migrations/v7-to-v8';
import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';
import { migrateSettingsV1toV2 } from './migrations/v1-to-v2';
import { migrateSettingsV2toV3 } from './migrations/v2-to-v3';
import { migrateOpenProjectsV3toV4, migrateSettingsV3toV4 } from './migrations/v3-to-v4';
import { migrateSettingsV4toV5 } from './migrations/v4-to-v5';

const SONNET_MODEL = 'anthropic/claude-sonnet-4-20250514';
const GEMINI_MODEL = 'gemini/gemini-2.5-pro-preview-06-05';
const OPEN_AI_DEFAULT_MODEL = 'gpt-4.1';
const DEEPSEEK_MODEL = 'deepseek/deepseek-chat';

export const DEFAULT_MAIN_MODEL = SONNET_MODEL;

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  startupMode: StartupMode.Empty,
  zoomLevel: 1,
  notificationsEnabled: false,
  theme: 'dark',
  aiderDeskAutoUpdate: true,
  aider: {
    options: '',
    environmentVariables: '',
    addRuleFiles: true,
    autoCommits: false,
    cachingEnabled: true,
    watchFiles: false,
  },
  models: {
    aiderPreferred: [SONNET_MODEL, GEMINI_MODEL, OPEN_AI_DEFAULT_MODEL, DEEPSEEK_MODEL],
    agentPreferred: [],
  },
  agentProfiles: [DEFAULT_AGENT_PROFILE],
  mcpServers: {},
  llmProviders: {} as Record<LlmProviderName, LlmProvider>,
  telemetryEnabled: true,
  promptBehavior: {
    suggestionMode: SuggestionMode.Automatically,
    suggestionDelay: 100,
    requireCommandConfirmation: {
      add: false,
      readOnly: false,
      model: false,
      modeSwitching: false,
    },
    useVimBindings: false,
  },
};

export const determineWeakModel = (baseDir: string): string | undefined => {
  return readAiderConfProperty(baseDir, 'weak-model');
};

export const determineMainModel = (settings: SettingsData, baseDir: string): string => {
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

  const projectModel = readAiderConfProperty(baseDir, 'model');
  if (projectModel) {
    return projectModel;
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
    return 'openrouter/google/gemini-2.5-pro-preview-06-05';
  }

  // Default model if no other condition is met
  return DEFAULT_MAIN_MODEL;
};

export const getDefaultProjectSettings = (store: Store, baseDir: string): ProjectSettings => {
  return {
    mainModel: determineMainModel(store.getSettings(), baseDir),
    weakModel: determineWeakModel(baseDir),
    currentMode: 'code',
    renderMarkdown: true,
    agentProfileId: DEFAULT_AGENT_PROFILE.id,
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
  userId?: string;
}

const CURRENT_SETTINGS_VERSION = 8;

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

    const settings = this.store.get('settings');
    const openProjects = this.store.get('openProjects');
    if (settings) {
      this.migrateSettings(settings, openProjects);
    }
  }

  getUserId(): string {
    let userId = this.store.get('userId');
    if (!userId) {
      userId = uuidv4();
      this.store.set('userId', userId);
    }
    return userId;
  }

  getSettings(): SettingsData {
    const settings = this.store.get('settings');

    if (!settings) {
      return {
        ...DEFAULT_SETTINGS,
      };
    }

    const getAgentProfiles = () => {
      const mergeDefaultProperties = (agentProfile: AgentProfile) => ({
        ...DEFAULT_AGENT_PROFILE,
        ...agentProfile,
      });

      const defaultProfile = settings.agentProfiles?.find((profile) => profile.id === DEFAULT_AGENT_PROFILE.id);
      if (!defaultProfile) {
        return [DEFAULT_AGENT_PROFILE, ...(settings.agentProfiles || []).map(mergeDefaultProperties)];
      }

      return settings.agentProfiles.map(mergeDefaultProperties);
    };

    // Ensure proper merging for nested objects
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
      promptBehavior: {
        ...DEFAULT_SETTINGS.promptBehavior,
        ...settings?.promptBehavior,
        requireCommandConfirmation: {
          ...DEFAULT_SETTINGS.promptBehavior.requireCommandConfirmation,
          ...settings?.promptBehavior?.requireCommandConfirmation,
        },
      },
      agentProfiles: getAgentProfiles(),
      mcpServers: settings.mcpServers || DEFAULT_SETTINGS.mcpServers,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private migrateSettings(settings: any, openProjects: any): SettingsData {
    let settingsVersion = this.store.get('settingsVersion') ?? this.findOutCurrentVersion(settings);

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

      if (settingsVersion === 3) {
        settings = migrateSettingsV3toV4(settings);
        openProjects = migrateOpenProjectsV3toV4(openProjects);
        settingsVersion = 4;
      }

      if (settingsVersion === 4) {
        settings = migrateSettingsV4toV5(settings);
        settingsVersion = 5;
      }

      if (settingsVersion === 5) {
        settings = migrateSettingsV5toV6(settings);
        settingsVersion = 6;
      }

      if (settingsVersion === 6) {
        settings = migrateV6ToV7(settings);
        settingsVersion = 7;
      }

      if (settingsVersion === 7) {
        settings = migrateV7ToV8(settings);
        settingsVersion = 8;
      }

      this.store.set('settings', settings as SettingsData);
      this.store.set('openProjects', openProjects || []);
    }

    this.store.set('settingsVersion', CURRENT_SETTINGS_VERSION);
    return settings as SettingsData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private findOutCurrentVersion(settings: any): number {
    if (!settings) {
      return CURRENT_SETTINGS_VERSION;
    }
    if (settings.mcpAgent && !settings.agentConfig) {
      return 2;
    }
    if (!settings.agentProfiles || !settings.llmProviders) {
      return 3;
    }
    return CURRENT_SETTINGS_VERSION;
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

  updateOpenProjectsOrder(baseDirs: string[]): ProjectData[] {
    const currentProjects = this.getOpenProjects();
    const orderedProjects: ProjectData[] = [];
    const currentProjectsMap = new Map(currentProjects.map((project) => [normalizeBaseDir(project.baseDir), project]));

    for (const baseDir of baseDirs) {
      const project = currentProjectsMap.get(normalizeBaseDir(baseDir));
      if (project) {
        orderedProjects.push(project);
      } else {
        // This case should ideally not happen if baseDirs comes from the existing open projects.
        // If it can happen, we might need to decide how to handle it (e.g., log a warning).
        logger.warn(`Project with baseDir ${baseDir} not found in current open projects during reorder.`);
      }
    }

    this.setOpenProjects(orderedProjects);
    return orderedProjects;
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
      ...getDefaultProjectSettings(this, baseDir),
      ...project?.settings,
    };
  }

  saveProjectSettings(baseDir: string, settings: ProjectSettings): ProjectSettings {
    const projects = this.getOpenProjects();

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

  getAgentProfile(profileId: string): AgentProfile | undefined {
    const settings = this.getSettings();
    return settings.agentProfiles.find((profile) => profile.id === profileId);
  }
}

export const appStore = new Store();
