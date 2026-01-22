import { normalizeBaseDir } from '@common/utils';
import { ProjectData } from '@common/types';

import logger from '@/logger';
import { initManagers } from '@/managers';
import { performStartUp } from '@/start-up';
import { extractEmbeddedResources } from '@/bun-resources';
import { Store } from '@/store';
import { AIDER_DESK_DATA_DIR } from '@/constants';
import { getDefaultProjectSettings } from '@/utils';
import { ModelManager } from '@/models';
import { AgentProfileManager } from '@/agent';

export const addProjectsFromEnv = async (store: Store, modelManager: ModelManager, agentProfileManager: AgentProfileManager): Promise<void> => {
  const aiderDeskProjectsEnv = process.env.AIDER_DESK_PROJECTS;
  if (!aiderDeskProjectsEnv) {
    return;
  }

  const projectPaths = aiderDeskProjectsEnv
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (projectPaths.length === 0) {
    return;
  }

  logger.info('AIDER_DESK_PROJECTS environment variable found', { projectPaths });

  const openProjects = store.getOpenProjects();

  // Create all projects from the env var
  const projectsFromEnv: ProjectData[] = [];

  for (const projectPath of projectPaths) {
    logger.info('Creating project from AIDER_DESK_PROJECTS', {
      projectPath,
    });

    const providerModels = await modelManager.getProviderModels();
    const defaultAgentProfileId = agentProfileManager.getDefaultAgentProfileId();

    const newProject: ProjectData = {
      baseDir: projectPath.endsWith('/') ? projectPath.slice(0, -1) : projectPath,
      settings: getDefaultProjectSettings(store, providerModels.models || [], projectPath, defaultAgentProfileId),
      active: false,
    };

    projectsFromEnv.push(newProject);
  }

  // Override open projects with the ones from env var
  if (projectsFromEnv.length > 0) {
    // Preserve active state from existing projects if they match
    const normalizedOpenProjects = openProjects.map((p) => normalizeBaseDir(p.baseDir));

    projectsFromEnv.forEach((project) => {
      const normalizedPath = normalizeBaseDir(project.baseDir);
      const existingIndex = normalizedOpenProjects.indexOf(normalizedPath);
      if (existingIndex >= 0) {
        project.active = openProjects[existingIndex].active;
      }
    });

    // Set the first project as active if none are active
    if (!projectsFromEnv.some((p) => p.active)) {
      projectsFromEnv[0].active = true;
    }

    store.setOpenProjects(projectsFromEnv);
    logger.info(`Overridden open projects with ${projectsFromEnv.length} project(s) from AIDER_DESK_PROJECTS`);
  }
};

const main = async (): Promise<void> => {
  // Force headless mode for node-runner
  if (!process.env.AIDER_DESK_HEADLESS) {
    process.env.AIDER_DESK_HEADLESS = 'true';
  }

  logger.info('------------ Starting AiderDesk Node Runner... ------------');

  const updateProgress = ({ step, message, info, progress }: { step: string; message: string; info?: string; progress?: number }) => {
    logger.info(`[${step}] ${message}${info ? ` (${info})` : ''}${progress !== undefined ? ` [${Math.round(progress)}%]` : ''}`);
  };

  try {
    await extractEmbeddedResources();
    await performStartUp(updateProgress);
    logger.info('Startup complete');

    const store = new Store();
    await store.init(AIDER_DESK_DATA_DIR);

    // Initialize managers first
    const { modelManager, agentProfileManager } = await initManagers(store);

    // Check for AIDER_DESK_PROJECTS environment variable and add projects
    await addProjectsFromEnv(store, modelManager, agentProfileManager);

    logger.info('AiderDesk Node Runner is ready!');
    logger.info('API server is running. You can now interact with AiderDesk via HTTP API or Socket.IO clients.');
  } catch (error) {
    logger.error('Failed to start AiderDesk Node Runner:', error);
    process.exit(1);
  }
};

// Only run main if this file is being executed directly (not imported for testing)
if (!process.env.VITEST) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
