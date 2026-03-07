/* eslint-disable no-console */

export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

const defaultLogger: Logger = {
  info: (message: string, ...args: unknown[]) => console.log(`[TreeSitterUtils] ${message}`, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(`[TreeSitterUtils] ${message}`, ...args),
  error: (message: string, ...args: unknown[]) => console.error(`[TreeSitterUtils] ${message}`, ...args),
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.DEBUG_TREE_SITTER) {
      console.debug(`[TreeSitterUtils] ${message}`, ...args);
    }
  },
};

let currentLogger = defaultLogger;

export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

export function getLogger(): Logger {
  return currentLogger;
}

export default currentLogger;
