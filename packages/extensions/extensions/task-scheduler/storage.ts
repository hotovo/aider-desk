import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import type { ScheduleMap } from './types';

const SCHEDULES_DIR = '.aider-desk';
const SCHEDULES_FILE = 'schedules.json';

const getSchedulesPath = (baseDir: string): string => join(baseDir, SCHEDULES_DIR, SCHEDULES_FILE);

export const loadSchedules = (baseDir: string): ScheduleMap => {
  const path = getSchedulesPath(baseDir);
  try {
    if (!existsSync(path)) {
      return {};
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as ScheduleMap;
  } catch {
    return {};
  }
};

export const saveSchedules = (baseDir: string, schedules: ScheduleMap): void => {
  const path = getSchedulesPath(baseDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(schedules, null, 2), 'utf-8');
};

export const saveSchedule = (baseDir: string, taskId: string, schedule: ScheduleMap[string]): void => {
  const schedules = loadSchedules(baseDir);
  schedules[taskId] = schedule;
  saveSchedules(baseDir, schedules);
};

export const deleteSchedule = (baseDir: string, taskId: string): void => {
  const schedules = loadSchedules(baseDir);
  delete schedules[taskId];
  saveSchedules(baseDir, schedules);
};
