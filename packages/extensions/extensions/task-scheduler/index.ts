import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CommandDefinition,
  Extension,
  ExtensionContext,
  ProjectStartedEvent,
  ProjectStoppedEvent,
  TaskClosedEvent,
  UIComponentDefinition,
} from '@aiderdesk/extensions';

import { TaskScheduler } from './scheduler';
import { loadSchedules, saveSchedule, deleteSchedule } from './storage';
import { parseScheduleFromText, calculateNextRun, calculateNextDelayRun } from './schedule-parser';
import { SCHEDULED_STATE, TODO_STATE } from './types';
import type { TaskSchedule } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PANEL_COMPONENT_ID = 'schedule-panel';
const BADGE_COMPONENT_ID = 'schedule-badge';
const SET_BUTTON_COMPONENT_ID = 'set-schedule-button';

export default class TaskSchedulerExtension implements Extension {
  static metadata = {
    name: 'Task Scheduler',
    version: '1.0.0',
    description: 'Schedule tasks to run automatically on a cron or periodic basis',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/task-scheduler/icon.png',
    capabilities: ['ui', 'commands', 'events'],
  };

  private readonly scheduler = new TaskScheduler();

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Task Scheduler extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    this.scheduler.destroy();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    this.scheduler.syncProject(event.baseDir, context);
  }

  async onProjectStopped(event: ProjectStoppedEvent, _context: ExtensionContext): Promise<void> {
    this.scheduler.stopProject(event.baseDir);
  }

  async onTaskClosed(event: TaskClosedEvent, context: ExtensionContext): Promise<void> {
    const projectDir = context.getProjectDir();
    if (!projectDir) return;

    const closedTask = event.task;
    if (closedTask.parentId) {
      const schedules = loadSchedules(projectDir);
      const parentSchedule = schedules[closedTask.parentId];
      if (parentSchedule && parentSchedule.isActive && parentSchedule.awaitingSubtaskCompletion) {
        await this.scheduler.checkSubtaskCompletion(projectDir, closedTask.parentId, context);
      }
    }

    if (closedTask.state === SCHEDULED_STATE) {
      this.scheduler.unschedule(projectDir, closedTask.id);
    }
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [
      {
        name: 'schedule',
        description: 'Schedule this task to run automatically. Usage: /schedule [cron expression | time description]',
        arguments: [],
        execute: async (args: string[], context: ExtensionContext): Promise<void> => {
          const taskContext = context.getTaskContext();
          if (!taskContext) {
            context.log('No active task context available', 'error');
            return;
          }

          const projectDir = context.getProjectDir();
          if (!projectDir) {
            context.log('No project directory available', 'error');
            return;
          }

          const text = args.join(' ').trim();

          if (!text) {
            const defaultSchedule: TaskSchedule = {
              cron: '0 * * * *',
              runsCompleted: 0,
              isActive: true,
              paused: false,
              initialized: false,
            };
            const nextRun = calculateNextRun(defaultSchedule.cron!);
            if (nextRun) defaultSchedule.nextRunAt = nextRun;
            saveSchedule(projectDir, taskContext.data.id, defaultSchedule);
            await taskContext.updateTask({ state: SCHEDULED_STATE });
            this.scheduler.scheduleTask(projectDir, taskContext.data.id, defaultSchedule, context);
            context.triggerUIDataRefresh(undefined, taskContext.data.id);
            return;
          }

          try {
            const schedule = await parseScheduleFromText(text);
            if (schedule.cron) {
              schedule.nextRunAt = calculateNextRun(schedule.cron);
            } else if (schedule.delayMinutes) {
              schedule.nextRunAt = calculateNextDelayRun(schedule.delayMinutes);
            }
            saveSchedule(projectDir, taskContext.data.id, schedule);
            await taskContext.updateTask({ state: SCHEDULED_STATE });
            this.scheduler.scheduleTask(projectDir, taskContext.data.id, schedule, context);
            context.triggerUIDataRefresh(undefined, taskContext.data.id);
            taskContext.addLogMessage('info', `Task scheduled: ${schedule.cron || `every ${schedule.delayMinutes} minutes`}`);
          } catch (error) {
            taskContext.addLogMessage('error', error instanceof Error ? error.message : String(error));
          }
        },
      },
    ];
  }

  getUIComponentsLibraries(): Record<string, string> {
    return {
      cronstrue: 'cronstrue@^3.2.0',
    };
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    const panelJsx = readFileSync(join(__dirname, 'SchedulePanel.jsx'), 'utf-8');
    const badgeJsx = readFileSync(join(__dirname, 'ScheduleBadge.jsx'), 'utf-8');
    const setButtonJsx = readFileSync(join(__dirname, 'SetScheduleButton.jsx'), 'utf-8');

    return [
      {
        id: PANEL_COMPONENT_ID,
        placement: 'task-state-actions-all',
        jsx: panelJsx,
        loadData: true,
        noDataCache: true,
      },
      {
        id: BADGE_COMPONENT_ID,
        placement: 'task-sidebar-item-badges',
        jsx: badgeJsx,
        loadData: true,
        noDataCache: true,
      },
      {
        id: SET_BUTTON_COMPONENT_ID,
        placement: 'task-state-actions',
        jsx: setButtonJsx,
        loadData: true,
        noDataCache: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    const projectDir = context.getProjectDir();
    if (!projectDir) return null;

    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;
    if (!taskId) return null;

    if (componentId === SET_BUTTON_COMPONENT_ID) {
      const schedules = loadSchedules(projectDir);
      return {
        schedule: schedules[taskId] || null,
        taskId,
      };
    }

    if (componentId !== PANEL_COMPONENT_ID && componentId !== BADGE_COMPONENT_ID && componentId !== SET_BUTTON_COMPONENT_ID) {
      return null;
    }

    const schedules = loadSchedules(projectDir);
    const schedule = schedules[taskId];

    return {
      schedule: schedule || null,
      taskId,
    };
  }

  async executeUIExtensionAction(
    componentId: string,
    action: string,
    args: unknown[],
    context: ExtensionContext,
  ): Promise<unknown> {
    if (componentId !== PANEL_COMPONENT_ID && componentId !== BADGE_COMPONENT_ID && componentId !== SET_BUTTON_COMPONENT_ID) {
      return null;
    }

    const projectDir = context.getProjectDir();
    if (!projectDir) return null;

    const taskContext = context.getTaskContext();
    const taskId = taskContext?.data?.id;
    if (!taskId) return null;

    switch (action) {
      case 'add': {
        const defaultSchedule: TaskSchedule = {
          cron: '0 * * * *',
          runsCompleted: 0,
          isActive: true,
          paused: false,
          initialized: false,
        };
        const nextRun = calculateNextRun(defaultSchedule.cron!);
        if (nextRun) defaultSchedule.nextRunAt = nextRun;
        saveSchedule(projectDir, taskId, defaultSchedule);
        await taskContext!.updateTask({ state: SCHEDULED_STATE });
        this.scheduler.scheduleTask(projectDir, taskId, defaultSchedule, context);
        context.triggerUIDataRefresh(undefined, taskId);
        return { success: true };
      }

      case 'set': {
        const schedule = args[0] as TaskSchedule;
        if (!schedule) return null;

        schedule.runsCompleted = schedule.runsCompleted ?? 0;
        schedule.isActive = schedule.isActive ?? true;
        schedule.paused = schedule.paused ?? false;
        schedule.initialized = true;

        if (schedule.cron) {
          schedule.nextRunAt = calculateNextRun(schedule.cron);
        } else if (schedule.delayMinutes) {
          schedule.nextRunAt = calculateNextDelayRun(schedule.delayMinutes);
        }

        saveSchedule(projectDir, taskId, schedule);

        await taskContext!.updateTask({ state: SCHEDULED_STATE });

        if (schedule.isActive && !schedule.paused) {
          this.scheduler.scheduleTask(projectDir, taskId, schedule, context);
        } else {
          this.scheduler.unschedule(projectDir, taskId);
        }

        context.triggerUIDataRefresh(undefined, taskId);
        return { success: true };
      }

      case 'cancel': {
        deleteSchedule(projectDir, taskId);
        this.scheduler.unschedule(projectDir, taskId);
        await taskContext!.updateTask({ state: TODO_STATE });
        context.triggerUIDataRefresh(undefined, taskId);
        return { success: true };
      }

      case 'pause': {
        const schedules = loadSchedules(projectDir);
        const schedule = schedules[taskId];
        if (schedule) {
          schedule.paused = true;
          saveSchedule(projectDir, taskId, schedule);
          this.scheduler.unschedule(projectDir, taskId);
          context.triggerUIDataRefresh(undefined, taskId);
        }
        return { success: true };
      }

      case 'resume': {
        const schedules = loadSchedules(projectDir);
        const schedule = schedules[taskId];
        if (schedule) {
          schedule.paused = false;
          if (schedule.cron) {
            schedule.nextRunAt = calculateNextRun(schedule.cron);
          } else if (schedule.delayMinutes) {
            schedule.nextRunAt = calculateNextDelayRun(schedule.delayMinutes);
            schedule.awaitingSubtaskCompletion = false;
          }
          saveSchedule(projectDir, taskId, schedule);
          this.scheduler.scheduleTask(projectDir, taskId, schedule, context);
          context.triggerUIDataRefresh(undefined, taskId);
        }
        return { success: true };
      }

      case 'run-now': {
        await this.scheduler.runNow(projectDir, taskId, context);
        return { success: true };
      }

      default:
        return null;
    }
  }
}
