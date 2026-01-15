import { TaskData } from '@common/types';

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

  const topLevelTasks = filteredTasks.filter((t) => !t.parentId || !filteredTasks.some((p) => p.id === t.parentId));
  const subtasks = filteredTasks.filter((t) => t.parentId && filteredTasks.some((p) => p.id === t.parentId));

  const sortFn = (a: TaskData, b: TaskData) => {
    // Pinned tasks come first
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }
    // Then sort by updatedAt (descending)
    if (a.updatedAt && !b.updatedAt) {
      return 1;
    } else if (!a.updatedAt && b.updatedAt) {
      return -1;
    } else if (!a.updatedAt && !b.updatedAt) {
      return 0;
    } else {
      return b.updatedAt!.localeCompare(a.updatedAt!);
    }
  };

  const sortedTopLevel = [...topLevelTasks].sort(sortFn);

  const result: TaskData[] = [];
  sortedTopLevel.forEach((parent) => {
    result.push(parent);
    const children = subtasks.filter((t) => t.parentId === parent.id).sort(sortFn);
    result.push(...children);
  });

  return result;
};
