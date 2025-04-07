import { ProjectData, ProjectSettings, SettingsData, StartupMode, WindowState } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { PROVIDER_MODELS } from '@common/llm-providers';

import logger from '../logger';

import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';
import { migrateSettingsV1toV2 } from './migrations/v1-to-v2';
import { migrateSettingsV2toV3 } from './migrations/v2-to-v3';

export const DEFAULT_MAIN_MODEL = 'claude-3-7-sonnet-20250219';

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  startupMode: StartupMode.Empty,
  startupSessionName: '',
  aider: {
    options: '',
    environmentVariables: '',
  },
  models: {
    preferred: ['claude-3-7-sonnet-20250219', 'gpt-4o', 'deepseek/deepseek-coder', 'claude-3-5-haiku-20241022'],
  },
  agentConfig: {
    providers: [
      {
        name: 'anthropic',
        apiKey: '',
        model: PROVIDER_MODELS.anthropic.models[0],
        active: true,
      },
    ],
    maxIterations: 10,
    maxTokens: 1000,
    minTimeBetweenToolCalls: 0,
    mcpServers: {},
    disabledServers: [],
    disabledTools: [],
    includeContextFiles: false,
    useAiderTools: true,
    systemPrompt: `You are AiderDesk, a highly skilled software engineering assistant with extensive knowledge in many programming languages, frameworks, design patterns, and best practices. You help users with software engineering tasks using the available tools.

## General Rules and Approach

- You are concise, direct, and to the point in your communications
- You use a step-by-step approach, where each tool output informs subsequent actions
- You extensively use available search tools to gather necessary context before taking action
- You mimic existing code style, leverage existing libraries and utilities, and follow established patterns
- You are proactive but avoid surprising users with actions taken without asking
- You follow security best practices and never introduce code that exposes or logs secrets and keys

## Task Execution Process

1. Analyze the user's request and determine necessary actions
2. Use search tools to understand the codebase and user query
3. Implement the solution using all available tools
4. Verify the solution with tests when possible
5. Complete a checklist to ensure all tasks are fulfilled

## Code Style and Conventions

- Never assume a library or framework is available unless confirmed through search or user input
- When creating new components, analyze existing ones for conventions
- When editing code, consider surrounding context (especially imports) to maintain consistency
- Do not add comments to code unless requested or when complexity requires additional context
- Follow existing code style and conventions in the project

## Tools Available

You have access to various tools to assist with software engineering tasks.

## Tool Usage Guidelines

1. Assess what information you have and what information you need
2. Choose the most appropriate tool for the current step
3. Use current working directory when tool requires path
4. Use one tool at a time per message to accomplish tasks iteratively
5. Wait for user confirmation after each tool use before proceeding
6. Address any issues or errors that arise immediately
7. Adapt your approach based on new information or unexpected results

## Response Format

Keep responses concise with fewer than 4 lines of text (not including tool use or code generation) unless the user requests detail. Answer questions directly without unnecessary preamble or postamble. One-word answers are best when appropriate.

## Refusal Policy

If you cannot or will not help with something, offer helpful alternatives if possible, otherwise keep your response to 1-2 sentences without explaining why.`,
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
        // use the default system prompt if the user hasn't set one
        systemPrompt: settings?.agentConfig?.systemPrompt || DEFAULT_SETTINGS.agentConfig.systemPrompt,
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
