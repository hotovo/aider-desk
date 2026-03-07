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
