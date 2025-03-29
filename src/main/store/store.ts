import { ProjectData, ProjectSettings, SettingsData, WindowState } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { PROVIDER_MODELS } from '@common/llm-providers';

import logger from '../logger';

import { migrateSettingsV0toV1 } from './migrations/v0-to-v1';
import { migrateSettingsV1toV2 } from './migrations/v1-to-v2';

export const DEFAULT_MAIN_MODEL = 'claude-3-7-sonnet-20250219';

export const DEFAULT_SETTINGS: SettingsData = {
  language: 'en',
  aider: {
    options: '',
    environmentVariables: '',
  },
  models: {
    preferred: ['claude-3-7-sonnet-20250219', 'gpt-4o', 'deepseek/deepseek-coder', 'claude-3-5-haiku-20241022'],
  },
  mcpAgent: {
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
    agentEnabled: false,
    includeContextFiles: false,
    useAiderTools: true,
    systemPrompt: `You are an AI agent specializing in software engineering. You have access to multiple tools, including an advanced coding assistant, to assist with not only coding tasks dynamically.

# **General Rules**
- Use **any available tools** to retrieve context and assist with user requests.
- Follow a **step-by-step approach**, where tool outputs inform subsequent actions.
- Keep responses **concise and precise** unless the user explicitly requests more detail.
- You can ALWAYS assume to continue with the task when you have tools available to perform the task (e.g. search tool, grep tool, etc. for searching files).
- Never assume a library or framework is available unless confirmed through a search tool or user input.
- ALWAYS prefer the \`aider\` run_prompt tool before other tools for when creating, updating files and coding tasks.
- Before final completion do a checklist to ensure all tasks are completed.

# **Contextual Understanding:**
- Prioritize understanding the existing codebase and user intent. Use available search tools extensively to gather necessary context.
- Mimic existing code style, leverage existing libraries and utilities, and follow established patterns.
- Never assume the availability of a library. Always verify its presence within the project.
- When creating new components, analyze existing ones for conventions.
- When editing code, consider the surrounding context, especially imports, to maintain consistency.

# **Aider Tools Usage**
If present in the list of tools, the \`aider\` tools are for **coding assistant** and can be used **at any stage** of a task.
- **Rules:**
    - Writing, modifying, refactoring, or explaining code.
    - Debugging, improving performance, and implementing new features.
    - \`aider\` knows content of all the files you see in your context.
    - \`aider\` should be prompted in natural language and the instructions should be clear and complete.
    - before run_prompt tool, make sure all the necessary files are added to the it's context using add_context_file tool.
    - treat \`aider\` as Junior Level programmer, ready to fulfill your requests.
    - ALWAYS prefer the \`aider\` run_prompt tool before other available tools for when creating, updating files and coding tasks.
- **Restrictions:**
    - **Do NOT mention specific programming languages** (e.g., Python, JavaScript, Java, C++).
    - **Do NOT reference language-specific features, syntax, or libraries** in natural language prompts.
    - If \`aider\` is used, ensure instructions are **complete, clear, and standalone**.

# **Task Execution:**
- Perform software engineering tasks such as bug fixing, feature implementation, code refactoring, and code explanation.
- Always proceed automatically, do not ask if you should proceed. You can assume that the user wants to proceed.
- Follow these steps:
1. Analyze the user's request and determine the necessary actions.
2. Use search tools to understand the codebase and user query.
3. Use any other tools to find out information required to complete the task.
4. Ask user for any clarifications if necessary.
5. Implement the solution using aider run_prompt tool if possible. If not possible, use other tools.
6. Do a checklist to ensure all tasks are completed.

## **Best Practices for Code Changes**
- **Maintain Consistency:** Follow the project’s existing conventions, libraries, and patterns.
- **Search Before Assuming:** Check imports, package files, and project structure before assuming dependencies.

## **Efficient Tool Usage**
- **Parallel & Sequential Execution:** If multiple tools are needed, call them efficiently.
- **Search First:** If a tool can provide relevant context (e.g., retrieving project info), use it **before** generating code.

# Output Format
- Responses should be concise and precise, expanding only on explicit user requests.

# Notes
- Always proceed with tasks autonomously unless user direction suggests otherwise.`,
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

const CURRENT_SETTINGS_VERSION = 2;

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
      mcpAgent: {
        ...DEFAULT_SETTINGS.mcpAgent,
        ...settings?.mcpAgent,
        // use the default system prompt if the user hasn't set one
        systemPrompt: settings?.mcpAgent?.systemPrompt || DEFAULT_SETTINGS.mcpAgent.systemPrompt,
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

      // Add more migration steps as needed (e.g., migrateSettingsV2toV3)

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
