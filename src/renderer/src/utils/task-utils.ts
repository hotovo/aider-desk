import { DEFAULT_TASK_STATES, TaskData } from '@common/types';

import { getTaskDateGroup } from './date-utils';

export type VirtualTaskItem = { type: 'header'; id: string; title: string } | { type: 'task'; id: string; task: TaskData; level: number };

export const getTaskDir = (task: TaskData): string => task.worktree?.path ?? task.baseDir;

export const countAllSubtasks = (taskId: string, allTasks: TaskData[]): number =>
  allTasks.filter((t) => t.parentId === taskId).reduce((count, subtask) => count + 1 + countAllSubtasks(subtask.id, allTasks), 0);

const groupByParentId = (tasks: TaskData[]): Map<string, TaskData[]> => {
  const childrenByParentId = new Map<string, TaskData[]>();
  for (const task of tasks) {
    if (!task.parentId) {
      continue;
    }
    const children = childrenByParentId.get(task.parentId);
    if (children) {
      children.push(task);
    } else {
      childrenByParentId.set(task.parentId, [task]);
    }
  }
  return childrenByParentId;
};

// Returns a memoized resolver of the most recent updatedAt of a task including all its subtasks within allTasks
const createMostRecentUpdatedAtResolver = (allTasks: TaskData[]): ((task: TaskData) => string | undefined) => {
  const childrenByParentId = groupByParentId(allTasks);
  const cache = new Map<string, string | undefined>();
  const visiting = new Set<string>();

  const resolve = (task: TaskData): string | undefined => {
    if (cache.has(task.id)) {
      return cache.get(task.id);
    }
    if (visiting.has(task.id)) {
      return task.updatedAt;
    }

    visiting.add(task.id);
    let mostRecent = task.updatedAt;
    for (const subtask of childrenByParentId.get(task.id) ?? []) {
      const subtaskMostRecent = resolve(subtask);
      if (subtaskMostRecent && (!mostRecent || subtaskMostRecent > mostRecent)) {
        mostRecent = subtaskMostRecent;
      }
    }
    visiting.delete(task.id);

    cache.set(task.id, mostRecent);
    return mostRecent;
  };

  return resolve;
};

export const getSortedVisibleTasks = (tasks: TaskData[], selectedStates: Set<string>, showArchived: boolean = false, searchQuery: string = ''): TaskData[] => {
  const filteredTasks = tasks
    .filter((task) => {
      if (task.archived && !showArchived) {
        return false;
      }
      if (task.state && DEFAULT_TASK_STATES.has(task.state) && !selectedStates.has(task.state)) {
        return false;
      }
      return true;
    })
    .filter((task) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const searchText = searchQuery.toLowerCase();
      return task.name.toLowerCase().includes(searchText);
    });

  const tasksById = new Map<string, TaskData>();
  for (const task of tasks) {
    if (!tasksById.has(task.id)) {
      tasksById.set(task.id, task);
    }
  }

  const isAnyAncestorArchived = (task: TaskData): boolean => {
    const visited = new Set<string>();
    let current = task;
    while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parentTask = tasksById.get(current.parentId);
      if (!parentTask) {
        return false;
      }
      if (parentTask.archived) {
        return true;
      }
      current = parentTask;
    }
    return false;
  };

  const tasksWithValidParents = showArchived ? filteredTasks : filteredTasks.filter((task) => !isAnyAncestorArchived(task));

  const validTaskIds = new Set(tasksWithValidParents.map((t) => t.id));
  const topLevelTasks = tasksWithValidParents.filter((t) => !t.parentId || !validTaskIds.has(t.parentId));
  const subtasks = tasksWithValidParents.filter((t) => t.parentId && validTaskIds.has(t.parentId));
  const subtasksByParentId = groupByParentId(subtasks);
  const getMostRecentUpdatedAt = createMostRecentUpdatedAtResolver(filteredTasks);

  const sortFn = (a: TaskData, b: TaskData) => {
    // Pinned tasks come first
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }
    // Then sort by most recent updatedAt (including subtasks, descending)
    const aMostRecent = getMostRecentUpdatedAt(a);
    const bMostRecent = getMostRecentUpdatedAt(b);
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
    const children = [...(subtasksByParentId.get(task.id) ?? [])].sort(sortFn);
    children.forEach(addTaskWithChildren);
  };

  const result: TaskData[] = [];
  sortedTopLevel.forEach(addTaskWithChildren);

  return result;
};

export const flattenTasksForVirtualization = (
  tasks: TaskData[],
  expandedIds: Set<string>,
  selectedStates: Set<string>,
  showArchived: boolean = false,
  searchQuery: string = '',
): VirtualTaskItem[] => {
  const sortedTasks = getSortedVisibleTasks(tasks, selectedStates, showArchived, searchQuery);
  const sortedTaskIds = new Set(sortedTasks.map((task) => task.id));
  const topLevelTasks = sortedTasks.filter((task) => !task.parentId || !sortedTaskIds.has(task.parentId));
  const subtasksByParentId = groupByParentId(sortedTasks);
  const getMostRecentUpdatedAt = createMostRecentUpdatedAtResolver(sortedTasks);

  const pinnedTasks = topLevelTasks.filter((task) => task.pinned);
  const nonPinnedTasks = topLevelTasks.filter((task) => !task.pinned);

  const result: VirtualTaskItem[] = [];

  const addTaskWithSubtasks = (task: TaskData, level: number) => {
    result.push({ type: 'task', id: task.id, task, level });

    if (expandedIds.has(task.id)) {
      subtasksByParentId.get(task.id)?.forEach((subtask) => addTaskWithSubtasks(subtask, level + 1));
    }
  };

  // Add pinned tasks first (without header)
  pinnedTasks.forEach((task) => addTaskWithSubtasks(task, 0));

  const groupedTasks = new Map<string, TaskData[]>();
  nonPinnedTasks.forEach((task) => {
    const mostRecent = getMostRecentUpdatedAt(task);
    const group = mostRecent ? getTaskDateGroup({ ...task, updatedAt: mostRecent }) : getTaskDateGroup(task);
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
