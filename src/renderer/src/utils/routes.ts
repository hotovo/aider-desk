export const ROUTES = {
  Onboarding: '/onboarding',
  Home: '/home',
} as const;

// URL parameter utilities for direct project/task navigation
export const URL_PARAMS = {
  PROJECT: 'project',
  TASK: 'task',
} as const;

/**
 * Encodes a baseDir for use in URL parameters
 * @param baseDir - The project base directory path
 * @returns URL-encoded baseDir
 */
export const encodeBaseDir = (baseDir: string): string => {
  return encodeURIComponent(baseDir);
};

/**
 * Decodes a baseDir from URL parameters
 * @param encodedBaseDir - The URL-encoded baseDir
 * @returns Decoded baseDir path
 */
export const decodeBaseDir = (encodedBaseDir: string): string => {
  return decodeURIComponent(encodedBaseDir);
};

/**
 * Builds a home URL with optional project and task parameters
 * @param projectBaseDir - Optional project base directory to include
 * @param taskId - Optional task ID to include
 * @returns URL hash string
 */
export const buildHomeUrl = (projectBaseDir?: string, taskId?: string): string => {
  const params: string[] = [];

  if (projectBaseDir) {
    params.push(`${URL_PARAMS.PROJECT}=${encodeBaseDir(projectBaseDir)}`);
  }

  if (taskId) {
    params.push(`${URL_PARAMS.TASK}=${taskId}`);
  }

  const queryString = params.length > 0 ? params.join('&') : '';
  return queryString ? `${ROUTES.Home}?${queryString}` : ROUTES.Home;
};

/**
 * Parses URL parameters from the current location
 * @param location - React Router location object
 * @returns Object containing decoded project and task parameters
 */
export const parseUrlParams = (location: Location): { projectBaseDir: string | null; taskId: string | null } => {
  const hashParts = location.hash.split('?');
  const queryString = hashParts.length > 1 ? hashParts[1].split('#')[0] : '';
  const params = new URLSearchParams(queryString);

  const projectParam = params.get(URL_PARAMS.PROJECT);
  const taskParam = params.get(URL_PARAMS.TASK);

  return {
    projectBaseDir: projectParam ? decodeBaseDir(projectParam) : null,
    taskId: taskParam || null,
  };
};
