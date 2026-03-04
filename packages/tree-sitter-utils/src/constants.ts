import * as path from 'path';
import { fileURLToPath } from 'url';

// Support both CommonJS and ESM
const getDirname = (): string => {
  // @ts-ignore - __dirname is defined in CommonJS
  if (typeof __dirname !== 'undefined') {
    // @ts-ignore
    return __dirname;
  }
  return path.dirname(fileURLToPath(import.meta.url));
};

const dirName = getDirname();

export const RESOURCES_DIR = path.join(dirName, '..', 'resources');
export const QUERIES_DIR = path.join(RESOURCES_DIR, 'queries');
export const WASM_DIR = path.join(RESOURCES_DIR, 'wasm');
