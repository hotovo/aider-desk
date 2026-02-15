export const getPathBasename = (inputPath: string): string => {
  if (!inputPath) {
    return inputPath;
  }

  const normalized = inputPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || inputPath;
};
