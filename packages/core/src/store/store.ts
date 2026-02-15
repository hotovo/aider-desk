import { v4 as uuidv4 } from 'uuid';
import {
  ContextCompactionType,
  DiffViewMode,
  MemoryEmbeddingProvider,
  MessageViewMode,
  ProjectData,
  ProjectSettings,
  ProjectStartMode,
  ProviderProfile,
  SettingsData,
  SuggestionMode,
  WindowState,
} from '@aider-desk/common/types';
import { normalizeBaseDir } from '@aider-desk/common/utils';

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

import { getDefaultProjectSettings } from '@/utils';
import logger from '@/logger';
import { migrateProvidersV13toV14 } from '@/store/migrations/v13-to-v14';
import { migrateSettingsV14toV15 } from '@/store/migrations/v14-to-v15';
import { migrateSettingsV15toV16 } from '@/store/migrations/v15-to-v16';
import { migrateSettingsV16toV17 } from '@/store/migrations/v16-to-v17';

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  startupMode: ProjectStartMode.Empty,
  zoomLevel: 1,
  notificationsEnabled: false,
  theme: 'dark',
  font: 'Sono',
  renderMarkdown: true,
  virtualizedRendering: false,
  aiderDeskAutoUpdate: true,
  messageViewMode: MessageViewMode.Compact,
  diffViewMode: DiffViewMode.SideBySide,
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
  memory: {
    enabled: true,
    provider: MemoryEmbeddingProvider.SentenceTransformers,
    model: 'Xenova/all-MiniLM-L6-v2',
    maxDistance: 1.5,
  },
  taskSettings: {
    smartTaskState: true,
    autoGenerateTaskName: true,
    showTaskStateActions: true,
    worktreeSymlinkFolders: ['node_modules', 'vendor', '__pycache__', '.venv', 'venv'],
    contextCompactingThreshold: 0,
    contextCompactionType: ContextCompactionType.Compact,
  },
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

const CURRENT_SETTINGS_VERSION = 17;

export class Store {
  // @ts-expect-error expected to be initialized
  private store: Conf<StoreSchema>;

  async init(path?: string): Promise<void> {
    const { default: Conf } = await import('conf');
    this.store = new Conf<StoreSchema>({
      cwd: path,
    });

    const settings = this.store.get('settings');
    const openProjects = this.store.get('openProjects');
    const providers = this.store.get('providers');
    if (settings) {
      await this.migrateSettings(settings, openProjects, providers);
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
      mcpServers: settings.mcpServers || DEFAULT_SETTINGS.mcpServers,
      server: settings.server || DEFAULT_SETTINGS.server,
      memory: {
        ...DEFAULT_SETTINGS.memory,
        ...settings?.memory,
      },
      taskSettings: {
        ...DEFAULT_SETTINGS.taskSettings,
        ...settings?.taskSettings,
        worktreeSymlinkFolders: settings?.taskSettings?.worktreeSymlinkFolders || DEFAULT_SETTINGS.taskSettings.worktreeSymlinkFolders,
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async migrateSettings(settings: any, openProjects: any, providers: any): Promise<SettingsData> {
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

      if (settingsVersion === 15) {
        settings = migrateSettingsV15toV16(settings);
        settingsVersion = 16;
      }

      if (settingsVersion === 16) {
        settings = await migrateSettingsV16toV17(settings);
        settingsVersion = 17;
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
    if (!settings.llmProviders) {
      return 3;
    }
    // Check if agentProfiles still exists in settings (pre-v17)
    if (settings.agentProfiles) {
      return 16;
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
    const recentProjects: string[] = this.store.get('recentProjects') || [];
    const openProjectBaseDirs = this.getOpenProjects().map((p) => p.baseDir);

    return recentProjects.filter((baseDir) => !openProjectBaseDirs.some((openProjectBaseDir) => compareBaseDirs(openProjectBaseDir, baseDir)));
  }

  addRecentProject(baseDir: string): void {
    const recentProjects: string[] = this.store.get('recentProjects') || [];
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

  getProviders(): ProviderProfile[] {
    return this.store.get('providers') || [];
  }

  setProviders(providers: ProviderProfile[]): void {
    this.store.set('providers', providers);
  }
}

export const appStore = new Store();
