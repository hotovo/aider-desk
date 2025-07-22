import { useEffect, useState } from 'react';
import { MdAdd, MdExpandLess, MdOutlineChecklist, MdPlaylistRemove } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@common/types';

import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';

import { TodoListItem } from './TodoListItem';

import { Input } from '@/components/common/Input';

type Props = {
  todos: TodoItem[];
  onToggleTodo?: (name: string, completed: boolean) => void;
  onAddTodo?: (name: string) => void;
  onUpdateTodo?: (name: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (name: string) => void;
  onClearDoneTodos: () => void;
};

export const TodoWindow = ({ todos, onToggleTodo, onAddTodo, onUpdateTodo, onDeleteTodo, onClearDoneTodos }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoName, setNewTodoName] = useState('');

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleAddTodo = () => {
    setIsAddingTodo(true);
  };

  const handleSaveTodo = () => {
    if (newTodoName.trim() && onAddTodo) {
      onAddTodo(newTodoName.trim());
      setNewTodoName('');
      setIsAddingTodo(false);
    }
  };

  const handleCancelAdd = () => {
    setNewTodoName('');
    setIsAddingTodo(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTodo();
    } else if (e.key === 'Escape') {
      handleCancelAdd();
    }
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
            <div className="flex items-center">
              <IconButton
                icon={<MdPlaylistRemove className="w-4 h-4" />}
                onClick={onClearDoneTodos}
                tooltip={t('tasks.clearDoneTodos')}
                className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md p-2 transition-colors"
              />
              <IconButton
                icon={<MdAdd className="w-4 h-4" />}
                onClick={handleAddTodo}
                tooltip={t('tasks.addTodo')}
                className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md p-2 transition-colors"
              />
              <IconButton
                icon={<MdExpandLess className="w-4 h-4" />}
                onClick={handleToggleExpand}
                className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-md p-2 transition-colors"
              />
            </div>
          </div>

          {/* Content */}
          <div className="overflow-hidden">
            <div className="p-3 max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-600">
              {/* Add Todo Input */}
              {isAddingTodo && (
                <div className="mb-3 p-2 bg-neutral-800 rounded border border-neutral-600">
                  <Input
                    type="text"
                    value={newTodoName}
                    onChange={(e) => setNewTodoName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={t('tasks.todoNamePlaceholder')}
                    className="bg-transparent text-xs text-neutral-200 placeholder-neutral-500 border-none outline-none py-0 px-1"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button onClick={handleCancelAdd} variant="text" size="sm" className="text-xs h-6 px-2">
                      {t('tasks.cancelTodo')}
                    </Button>
                    <Button onClick={handleSaveTodo} variant="contained" size="sm" className="text-xs h-6 px-2" disabled={!newTodoName.trim()}>
                      {t('tasks.saveTodo')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Todo List */}
              {todos.length > 0 ? (
                <div className="space-y-2">
                  {todos.map((todo, index) => (
                    <TodoListItem key={`${todo.name}-${index}`} item={todo} onToggle={onToggleTodo} onUpdate={onUpdateTodo} onDelete={onDeleteTodo} />
                  ))}
                </div>
              ) : (
                !isAddingTodo && <div className="text-sm text-neutral-500 text-center py-4">{t('tasks.noTodos')}</div>
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
