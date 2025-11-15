import { TaskData } from '@common/types';

export const getSortedVisibleTasks = (tasks: TaskData[], showArchived: boolean = false, searchQuery: string = ''): TaskData[] => {
  return tasks
    .filter((task) => showArchived || !task.archived)
    .filter((task) => {
      if (!searchQuery.trim()) {
        return true;
      }
      const searchText = searchQuery.toLowerCase();
      return task.name.toLowerCase().includes(searchText);
    })
    .sort((a, b) => {
      if (a.updatedAt && !b.updatedAt) {
        return 1;
      } else if (!a.updatedAt && b.updatedAt) {
        return -1;
      } else if (!a.updatedAt && !b.updatedAt) {
        return 0;
      } else {
        return b.updatedAt!.localeCompare(a.updatedAt!);
      }
    });
};
