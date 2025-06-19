import { useState, useEffect } from 'react';
import { MdExpandLess, MdOutlineChecklist } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@common/types';

import { IconButton } from '../common/IconButton';

import { TodoListItem } from './TodoListItem';

type Props = {
  todos: TodoItem[];
  onToggleTodo?: (name: string, completed: boolean) => void;
};

export const TodoWindow = ({ todos, onToggleTodo }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const completedCount = todos.filter((todo) => todo.completed).length;
  const totalCount = todos.length;

  // Auto-collapse when all todo items are completed
  useEffect(() => {
    if (totalCount > 0 && completedCount === totalCount) {
      setIsExpanded(false);
    }
  }, [completedCount, totalCount]);

  return (
    <div className="absolute top-3 right-3 z-20 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg max-w-[360px]">
      {isExpanded ? (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between p-0.5 pl-2 border-b border-neutral-700">
            <div className="flex items-center gap-2 rounded-md transition-colors flex-1">
              <MdOutlineChecklist className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-medium text-neutral-200">
                {t('tasks.title')} ({completedCount}/{totalCount})
              </span>
            </div>
            <IconButton
              icon={<MdExpandLess className="w-4 h-4" />}
              onClick={handleToggleExpand}
              className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md p-2 transition-colors"
            />
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            <div className="p-3 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-600">
              {todos.length > 0 ? (
                <div className="space-y-2">
                  {todos.map((todo, index) => (
                    <TodoListItem key={`${todo.name}-${index}`} item={todo} onToggle={onToggleTodo} />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500 text-center py-4">No todo items</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed state */
        <div className="p-0.5">
          <IconButton
            icon={<MdOutlineChecklist className="w-4 h-4 text-sky-400" />}
            onClick={handleToggleExpand}
            tooltip={`${t('tasks.title')} (${completedCount}/${totalCount})`}
            className="hover:bg-neutral-800 rounded-md p-2 transition-colors"
          />
        </div>
      )}
    </div>
  );
};
