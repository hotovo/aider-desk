import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';

import type { ExtensionContext } from '@aiderdesk/extensions';

import { calculateNextRun, calculateNextDelayRun } from './schedule-parser';
import { loadSchedules, saveSchedule, deleteSchedule } from './storage';
import type { TaskSchedule } from './types';
import { SCHEDULED_STATE, TODO_STATE } from './types';

type ScheduledEntry = {
  timer: NodeJS.Timeout | null;
  cronJob: ScheduledTask | null;
};

const key = (baseDir: string, taskId: string): string => `${baseDir}:${taskId}`;

export class TaskScheduler {
  private readonly entries = new Map<string, ScheduledEntry>();

  syncProject(baseDir: string, context: ExtensionContext): void {
    const schedules = loadSchedules(baseDir);
    const projectContext = context.getProjectContext();

    projectContext
      .getTasks()
      .then((tasks) => {
        const taskIds = new Set(tasks.map((t) => t.id));

        for (const [taskId, schedule] of Object.entries(schedules)) {
          if (!taskIds.has(taskId)) {
            context.log(`Task ${taskId} no longer exists, removing schedule`, 'warn');
            deleteSchedule(baseDir, taskId);
            this.unschedule(baseDir, taskId);
            continue;
          }

          if (schedule.isActive && !schedule.paused) {
            const taskContext = projectContext.getTask(taskId);
            if (taskContext) {
              const currentState = taskContext.data.state;
              if (currentState !== SCHEDULED_STATE) {
                void taskContext.updateTask({ state: SCHEDULED_STATE });
              }
            }
            this.scheduleTask(baseDir, taskId, schedule, context);
          }
        }
      })
      .catch((error) => {
        context.log(
          `Failed to sync schedules: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      });
  }

  stopProject(baseDir: string): void {
    for (const [k, entry] of this.entries) {
      if (k.startsWith(`${baseDir}:`)) {
        this.clearEntry(entry);
        this.entries.delete(k);
      }
    }
  }

  scheduleTask(baseDir: string, taskId: string, schedule: TaskSchedule, context: ExtensionContext): void {
    if (!schedule.isActive || schedule.paused) {
      this.unschedule(baseDir, taskId);
      return;
    }

    const k = key(baseDir, taskId);
    const existing = this.entries.get(k);
    if (existing) {
      this.clearEntry(existing);
    }

    const entry: ScheduledEntry = { timer: null, cronJob: null };

    if (schedule.cron) {
      try {
        const nextRun = calculateNextRun(schedule.cron);
        if (nextRun) {
          schedule.nextRunAt = nextRun;
          saveSchedule(baseDir, taskId, schedule);
        }
        entry.cronJob = cron.schedule(schedule.cron, () => {
          void this.executeScheduledTask(baseDir, taskId, context);
        });
        context.log(`Scheduled task with cron: ${schedule.cron} (next: ${nextRun})`, 'info');
      } catch (error) {
        context.log(
          `Failed to schedule cron task: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      }
    } else if (schedule.delayMinutes) {
      const nextRunIsStale = schedule.nextRunAt && new Date(schedule.nextRunAt).getTime() <= Date.now();
      if (!schedule.awaitingSubtaskCompletion && (!schedule.nextRunAt || nextRunIsStale)) {
        const nextRunAt = calculateNextDelayRun(schedule.delayMinutes)!;
        schedule.nextRunAt = nextRunAt;
        saveSchedule(baseDir, taskId, schedule);
        entry.timer = setTimeout(() => {
          void this.executeScheduledTask(baseDir, taskId, context);
        }, schedule.delayMinutes * 60_000);
        context.log(`Scheduled periodic task: every ${schedule.delayMinutes}min (next: ${nextRunAt})`, 'info');
      } else if (schedule.awaitingSubtaskCompletion) {
        context.log(`Periodic task ${taskId} awaiting subtask completion`, 'info');
      }
    }

    this.entries.set(k, entry);
  }

  unschedule(baseDir: string, taskId: string): void {
    const k = key(baseDir, taskId);
    const entry = this.entries.get(k);
    if (entry) {
      this.clearEntry(entry);
      this.entries.delete(k);
    }
  }

  private clearEntry(entry: ScheduledEntry): void {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    if (entry.cronJob) {
      entry.cronJob.stop();
      entry.cronJob = null;
    }
  }

  async executeScheduledTask(baseDir: string, taskId: string, context: ExtensionContext): Promise<void> {
    try {
      const projectContext = context.getProjectContext();
      const sourceTaskContext = projectContext.getTask(taskId);

      if (!sourceTaskContext) {
        context.log(`Scheduled task ${taskId} not found, removing schedule`, 'warn');
        deleteSchedule(baseDir, taskId);
        this.unschedule(baseDir, taskId);
        return;
      }

      const schedules = loadSchedules(baseDir);
      const schedule = schedules[taskId];
      if (!schedule || !schedule.isActive || schedule.paused) {
        this.unschedule(baseDir, taskId);
        return;
      }

      if (schedule.maxRuns !== undefined && schedule.runsCompleted >= schedule.maxRuns) {
        context.log(`Task ${taskId} reached max runs, unscheduling`, 'info');
        schedule.isActive = false;
        saveSchedule(baseDir, taskId, schedule);
        await sourceTaskContext.updateTask({ state: TODO_STATE });
        this.unschedule(baseDir, taskId);
        context.triggerUIDataRefresh(undefined, taskId);
        return;
      }

      context.log(`Executing scheduled task ${taskId}`, 'info');

      const duplicatedTask = await projectContext.duplicateTask(taskId);
      const newTaskContext = projectContext.getTask(duplicatedTask.id);
      if (newTaskContext) {
        await newTaskContext.updateTask({
          state: TODO_STATE,
          parentId: taskId,
        });
        void newTaskContext.resumeTask();
      }

      const updatedSchedule: TaskSchedule = {
        ...schedule,
        runsCompleted: schedule.runsCompleted + 1,
        lastRunAt: new Date().toISOString(),
      };

      if (updatedSchedule.cron) {
        updatedSchedule.nextRunAt = calculateNextRun(updatedSchedule.cron);
        updatedSchedule.awaitingSubtaskCompletion = false;
      } else if (updatedSchedule.delayMinutes) {
        updatedSchedule.awaitingSubtaskCompletion = true;
        updatedSchedule.nextRunAt = undefined;
      }

      if (updatedSchedule.maxRuns !== undefined && updatedSchedule.runsCompleted >= updatedSchedule.maxRuns) {
        updatedSchedule.isActive = false;
      }

      saveSchedule(baseDir, taskId, updatedSchedule);

      if (!updatedSchedule.isActive) {
        await sourceTaskContext.updateTask({ state: TODO_STATE });
        this.unschedule(baseDir, taskId);
      }

      context.triggerUIDataRefresh(undefined, taskId);
    } catch (error) {
      context.log(
        `Failed to execute scheduled task: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }

  async runNow(baseDir: string, taskId: string, context: ExtensionContext): Promise<void> {
    await this.executeScheduledTask(baseDir, taskId, context);
  }

  async checkSubtaskCompletion(baseDir: string, taskId: string, context: ExtensionContext): Promise<void> {
    const schedules = loadSchedules(baseDir);
    const schedule = schedules[taskId];
    if (!schedule || !schedule.isActive || schedule.paused || !schedule.awaitingSubtaskCompletion) {
      return;
    }

    const projectContext = context.getProjectContext();
    const allTasks = await projectContext.getTasks();
    const subtasks = allTasks.filter((t) => t.parentId === taskId);
    if (subtasks.length === 0) {
      return;
    }

    const latestSubtask = subtasks.sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    )[0];

    if (latestSubtask.state !== 'IN_PROGRESS' && latestSubtask.state !== 'TODO') {
      context.log(`Subtask completed for ${taskId}, scheduling next periodic run`, 'info');

      const nextRunAt = calculateNextDelayRun(schedule.delayMinutes || 0)!;
      schedule.awaitingSubtaskCompletion = false;
      schedule.nextRunAt = nextRunAt;
      saveSchedule(baseDir, taskId, schedule);

      const k = key(baseDir, taskId);
      const entry = this.entries.get(k);
      if (entry) {
        entry.timer = setTimeout(() => {
          void this.executeScheduledTask(baseDir, taskId, context);
        }, (schedule.delayMinutes || 0) * 60_000);
      }

      context.triggerUIDataRefresh(undefined, taskId);
    }
  }

  destroy(): void {
    for (const entry of this.entries.values()) {
      this.clearEntry(entry);
    }
    this.entries.clear();
  }
}
