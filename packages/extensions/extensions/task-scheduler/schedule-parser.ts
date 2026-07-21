import { CronExpressionParser } from 'cron-parser';

import type { TaskSchedule } from './types';

export const calculateNextRun = (cronExpression: string): string | undefined => {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    const next = interval.next().toISOString();
    return next ?? undefined;
  } catch {
    return undefined;
  }
};

export const calculateNextDelayRun = (delayMinutes: number): string | undefined => {
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
};

export const isCronExpression = (text: string): boolean => {
  const trimmed = text.trim();
  const cronFields = trimmed.split(/\s+/);
  return cronFields.length === 5 && cronFields.every((f) => /^[\d*/,-]+$/.test(f));
};

export const parseScheduleFromText = async (text: string): Promise<TaskSchedule> => {
  const trimmed = text.trim();

  if (isCronExpression(trimmed)) {
    return {
      cron: trimmed,
      runsCompleted: 0,
      isActive: true,
      paused: false,
    };
  }

  let chrono: typeof import('chrono-node');
  try {
    chrono = await import('chrono-node');
  } catch {
    throw new Error(
      `Could not parse schedule from: "${trimmed}". Use a cron expression (e.g. "*/5 * * * *") or a time description (e.g. "in 30 minutes", "tomorrow at 9am").`,
    );
  }

  const parsedDate = chrono.parseDate(trimmed);
  if (!parsedDate || parsedDate.getTime() <= Date.now()) {
    throw new Error(
      `Could not parse schedule from: "${trimmed}". Use a cron expression (e.g. "*/5 * * * *") or a time description (e.g. "in 30 minutes", "tomorrow at 9am").`,
    );
  }

  const delayMs = parsedDate.getTime() - Date.now();
  const delayMinutes = Math.max(1, Math.round(delayMs / 60_000));

  return {
    delayMinutes,
    runsCompleted: 0,
    isActive: true,
    paused: false,
  };
};
