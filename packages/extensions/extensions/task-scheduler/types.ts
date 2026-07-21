export interface TaskSchedule {
  cron?: string;
  delayMinutes?: number;
  maxRuns?: number;
  runsCompleted: number;
  isActive: boolean;
  paused: boolean;
  initialized?: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  awaitingSubtaskCompletion?: boolean;
}

export interface ScheduleEntry {
  taskId: string;
  schedule: TaskSchedule;
}

export type ScheduleMap = Record<string, TaskSchedule>;

export const SCHEDULED_STATE = 'SCHEDULED';
export const TODO_STATE = 'TODO';
