import { TaskData } from '@common/types';

export const isToday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
};

export const isYesterday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate();
};

export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
};

export const getTaskDateGroup = (task: TaskData): string => {
  const dateStr = task.updatedAt || task.createdAt;
  if (!dateStr) {
    return 'unknown';
  }

  if (isToday(dateStr)) {
    return 'today';
  }
  if (isYesterday(dateStr)) {
    return 'yesterday';
  }
  return formatDateShort(dateStr);
};

export const groupTasksByDate = (tasks: TaskData[]): Map<string, TaskData[]> => {
  const groups = new Map<string, TaskData[]>();

  tasks.forEach((task) => {
    const group = getTaskDateGroup(task);
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(task);
  });

  return groups;
};
