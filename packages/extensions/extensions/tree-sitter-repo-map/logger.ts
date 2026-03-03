/* eslint-disable no-console */
const logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[TreeSitterRepoMap] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[TreeSitterRepoMap] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[TreeSitterRepoMap] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG_REPO_MAP) {
      console.debug(`[TreeSitterRepoMap] ${message}`, ...args);
    }
  },
};

export default logger;
