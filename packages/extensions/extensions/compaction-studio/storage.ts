import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { CompactionStudioStateMap, CompactionStudioTaskState } from './types';

const STATE_DIR = '.aider-desk';
const STATE_FILE = 'compaction-studio.json';

const getStatePath = (baseDir: string): string => join(baseDir, STATE_DIR, STATE_FILE);

export const loadStates = (baseDir: string): CompactionStudioStateMap => {
  const path = getStatePath(baseDir);
  try {
    if (!existsSync(path)) {
      return {};
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as CompactionStudioStateMap;
  } catch {
    return {};
  }
};

export const getTaskState = (baseDir: string, taskId: string): CompactionStudioTaskState => {
  return loadStates(baseDir)[taskId] ?? {};
};

export const saveTaskState = (baseDir: string, taskId: string, updates: Partial<CompactionStudioTaskState>): void => {
  const path = getStatePath(baseDir);
  const states = loadStates(baseDir);
  states[taskId] = { ...states[taskId], ...updates };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(states, null, 2), 'utf-8');
};
