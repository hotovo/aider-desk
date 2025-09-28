import { v4 as uuidv4 } from 'uuid';
import { AgentProfile, ProviderProfile, ProjectData, ProjectSettings, SettingsData, StartupMode, SuggestionMode, WindowState, Model } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { DEFAULT_AGENT_PROFILE, DEFAULT_AGENT_PROFILES, DEFAULT_PROVIDER_MODEL } from '@common/agent';

import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';
import { migrateSettingsV1toV2 } from './migrations/v1-to-v2';
import { migrateSettingsV2toV3 } from './migrations/v2-to-v3';
import { migrateOpenProjectsV3toV4, migrateSettingsV3toV4 } from './migrations/v3-to-v4';
import { migrateSettingsV4toV5 } from './migrations/v4-to-v5';
import { migrateSettingsV5toV6 } from './migrations/v5-to-v6';
import { migrateV6ToV7 } from './migrations/v6-to-v7';
import { migrateV7ToV8 } from './migrations/v7-to-v8';
import { migrateV8ToV9 } from './migrations/v8-to-v9';
import { migrateV9ToV10 } from './migrations/v9-to-v10';
import { migrateV10ToV11 } from './migrations/v10-to-v11';
import { migrateV11ToV12 } from './migrations/v11-to-v12';
import { migrateV12ToV13 } from './migrations/v12-to-v13';

import { determineMainModel, determineWeakModel } from '@/utils';
import logger from '@/logger';
import { migrateProvidersV13toV14 } from '@/store/migrations/v13-to-v14';
import { migrateSettingsV14toV15 } from '@/store/migrations/v14-to-v15';

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  startupMode: StartupMode.Empty,
  zoomLevel: 1,
  notificationsEnabled: false,
  theme: 'dark',
  font: 'Sono',
  aiderDeskAutoUpdate: true,
  aider: {
    options: '',
    environmentVariables: '',
    addRuleFiles: true,
    autoCommits: true,
    cachingEnabled: false,
    watchFiles: false,
    confirmBeforeEdit: false,
  },
  preferredModels: [],
  agentProfiles: DEFAULT_AGENT_PROFILES,
  mcpServers: {},
  llmProviders: {},
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
  server: {
    enabled: false,
    basicAuth: {
      enabled: false,
      username: '',
      password: '',
    },
  },
};

export const getDefaultProjectSettings = (store: Store, providerModels: Model[], baseDir: string): ProjectSettings => {
  return {
    mainModel: determineMainModel(store.getSettings(), store.getProviders(), providerModels, baseDir),
    weakModel: determineWeakModel(baseDir),
    modelEditFormats: {},
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
  providers: ProviderProfile[];
  settingsVersion: number;
  releaseNotes?: string | null;
  userId?: string;
}

const CURRENT_SETTINGS_VERSION = 15;

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
    const providers = this.store.get('providers');
    if (settings) {
      this.migrateSettings(settings, openProjects, providers);
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

  createDefaultSettings(): SettingsData {
    return {
      ...DEFAULT_SETTINGS,
    };
  }

  getSettings(): SettingsData {
    const settings = this.store.get('settings');

    if (!settings) {
      return this.createDefaultSettings();
    }

    const getAgentProfiles = () => {
      const mergeDefaultProperties = (agentProfile: AgentProfile) => ({
        ...DEFAULT_AGENT_PROFILE,
        ...agentProfile,
        toolApprovals: {
          ...DEFAULT_AGENT_PROFILE.toolApprovals,
          ...agentProfile.toolApprovals,
        },
        subagent: {
          ...DEFAULT_AGENT_PROFILE.subagent,
          ...agentProfile.subagent,
        },
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
      server: settings.server || DEFAULT_SETTINGS.server,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private migrateSettings(settings: any, openProjects: any, providers: any): SettingsData {
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

      if (settingsVersion === 8) {
        settings = migrateV8ToV9(settings);
        settingsVersion = 9;
      }

      if (settingsVersion === 9) {
        settings = migrateV9ToV10(settings);
        settingsVersion = 10;
      }

      if (settingsVersion === 10) {
        settings = migrateV10ToV11(settings);
        settingsVersion = 11;
      }

      if (settingsVersion === 11) {
        settings = migrateV11ToV12(settings);
        settingsVersion = 12;
      }

      if (settingsVersion === 12) {
        settings = migrateV12ToV13(settings);
        settingsVersion = 13;
      }

      if (settingsVersion === 13) {
        providers = migrateProvidersV13toV14(settings);
        settingsVersion = 14;
      }

      if (settingsVersion === 14) {
        settings = migrateSettingsV14toV15(settings);
        settingsVersion = 15;
      }

      this.store.set('settings', settings as SettingsData);
      this.store.set('openProjects', openProjects || []);
      this.store.set('providers', providers);
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

  async updateProviderModelInAgentProfiles(providerModels: Model[]) {
    const settings = this.getSettings();
    const providers = this.getProviders();

    const updatedAgentProfiles = settings.agentProfiles.map((agentProfile) => {
      const agentProviderModels = providerModels.filter((model) => model.providerId === agentProfile.provider);

      if (agentProviderModels.length === 0) {
        // Provider not configured, find the first available configured provider
        for (const provider of providers) {
          const models = providerModels.filter((model) => model.providerId === provider.id);
          const defaultModel = DEFAULT_PROVIDER_MODEL[provider.provider.name];
          if (defaultModel || models.length > 0) {
            return {
              ...agentProfile,
              provider: provider.id,
              model: defaultModel || models[0].id,
            };
          }
        }
      }
      return agentProfile;
    });

    // Update settings with modified agent profiles
    this.saveSettings({
      ...settings,
      agentProfiles: updatedAgentProfiles,
    });
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
    return project?.settings || getDefaultProjectSettings(this, [], baseDir);
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

  getProviders(): ProviderProfile[] {
    return this.store.get('providers') || [];
  }

  setProviders(providers: ProviderProfile[]): void {
    this.store.set('providers', providers);
  }
}

export const appStore = new Store();
