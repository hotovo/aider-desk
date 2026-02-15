/**
 * Utility functions for error handling
 */

/**
 * Checks if an error is an AbortError (operation was cancelled)
 * In Node.js, AbortError has name === 'AbortError' and code === 'ABORT_ERR'
 */
export const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || (error as NodeJS.ErrnoException).code === 'ABORT_ERR';
};

/**
 * Checks if an error is a file not found error (ENOENT)
 */
export const isFileNotFoundError = (error: unknown): boolean => {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
};
