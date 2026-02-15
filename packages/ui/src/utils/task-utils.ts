import { TaskData } from '@aider-desk/common/types';

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
