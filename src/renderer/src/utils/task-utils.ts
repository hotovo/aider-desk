import { TaskData } from '@common/types';

import { getTaskDateGroup } from './date-utils';

export type VirtualTaskItem = { type: 'header'; id: string; title: string } | { type: 'task'; id: string; task: TaskData; level: number };

const getMostRecentUpdatedAt = (task: TaskData, allTasks: TaskData[]): string | undefined => {
  let mostRecent = task.updatedAt;

  const subtasks = allTasks.filter((t) => t.parentId === task.id);
  for (const subtask of subtasks) {
    const subtaskMostRecent = getMostRecentUpdatedAt(subtask, allTasks);
    if (subtaskMostRecent && (!mostRecent || subtaskMostRecent > mostRecent)) {
      mostRecent = subtaskMostRecent;
    }
  }

  return mostRecent;
};

export const getSortedVisibleTasks = (tasks: TaskData[], showArchived: boolean = false, searchQuery: string = ''): TaskData[] => {
  const filteredTasks = tasks
    .filter((task) => showArchived || !task.archived)
    .filter((task) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const searchText = searchQuery.toLowerCase();
      return task.name.toLowerCase().includes(searchText);
    });

  // When showArchived is false, exclude tasks whose parent is archived
  // Check each task's parent exists in the original tasks and is not archived
  const tasksWithValidParents = filteredTasks.filter((task) => {
    if (!task.parentId) {
      return true;
    }
    // Find the parent in the original tasks array
    const parentTask = tasks.find((t) => t.id === task.parentId);
    // Include the task if:
    // - showArchived is true (show everything), OR
    // - parent doesn't exist (orphan), OR
    // - parent exists and is not archived
    return showArchived || !parentTask || !parentTask.archived;
  });

  const topLevelTasks = tasksWithValidParents.filter((t) => !t.parentId || !tasksWithValidParents.some((p) => p.id === t.parentId));
  const subtasks = tasksWithValidParents.filter((t) => t.parentId && tasksWithValidParents.some((p) => p.id === t.parentId));

  const sortFn = (a: TaskData, b: TaskData) => {
    // Pinned tasks come first
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }
    // Then sort by most recent updatedAt (including subtasks, descending)
    const aMostRecent = getMostRecentUpdatedAt(a, filteredTasks);
    const bMostRecent = getMostRecentUpdatedAt(b, filteredTasks);
    if (aMostRecent && !bMostRecent) {
      return 1;
    } else if (!aMostRecent && bMostRecent) {
      return -1;
    } else if (!aMostRecent && !bMostRecent) {
      return 0;
    } else {
      return bMostRecent!.localeCompare(aMostRecent!);
    }
  };

  const sortedTopLevel = [...topLevelTasks].sort(sortFn);

  const addTaskWithChildren = (task: TaskData) => {
    result.push(task);
    const children = subtasks.filter((t) => t.parentId === task.id).sort(sortFn);
    children.forEach(addTaskWithChildren);
  };

  const result: TaskData[] = [];
  sortedTopLevel.forEach(addTaskWithChildren);

  return result;
};

export const flattenTasksForVirtualization = (
  tasks: TaskData[],
  expandedIds: Set<string>,
  showArchived: boolean = false,
  searchQuery: string = '',
): VirtualTaskItem[] => {
  const sortedTasks = getSortedVisibleTasks(tasks, showArchived, searchQuery);
  const topLevelTasks = sortedTasks.filter((task) => !task.parentId || !sortedTasks.some((t) => t.id === task.parentId));

  const pinnedTasks = topLevelTasks.filter((task) => task.pinned);
  const nonPinnedTasks = topLevelTasks.filter((task) => !task.pinned);

  const result: VirtualTaskItem[] = [];

  const addTaskWithSubtasks = (task: TaskData, level: number) => {
    result.push({ type: 'task', id: task.id, task, level });

    if (expandedIds.has(task.id)) {
      const subtasks = sortedTasks.filter((t) => t.parentId === task.id);
      subtasks.forEach((subtask) => addTaskWithSubtasks(subtask, level + 1));
    }
  };

  // Add pinned tasks first (without header)
  pinnedTasks.forEach((task) => addTaskWithSubtasks(task, 0));

  const groupedTasks = new Map<string, TaskData[]>();
  nonPinnedTasks.forEach((task) => {
    const group = getTaskDateGroup(task);
    if (!groupedTasks.has(group)) {
      groupedTasks.set(group, []);
    }
    groupedTasks.get(group)!.push(task);
  });

  groupedTasks.forEach((groupTasks, dateGroup) => {
    result.push({ type: 'header', id: `date-${dateGroup}`, title: dateGroup });
    groupTasks.forEach((task) => addTaskWithSubtasks(task, 0));
  });

  return result;
};
