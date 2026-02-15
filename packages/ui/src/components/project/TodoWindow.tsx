import { useEffect, useState } from 'react';
import { MdAdd, MdExpandLess, MdOutlineChecklist, MdPlaylistRemove } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@aider-desk/common/types';
import { ResizableBox } from 'react-resizable';

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
  onHandoffTodo?: (name: string) => void;
  onClearAllTodos: () => void;
};

export const TodoWindow = ({ todos, onToggleTodo, onAddTodo, onUpdateTodo, onDeleteTodo, onHandoffTodo, onClearAllTodos }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoName, setNewTodoName] = useState('');
  const [height, setHeight] = useState(250);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(false);
    }
  }, [completedCount, totalCount]);

  return (
    <div className="absolute top-3 right-3 z-20 max-w-[360px]">
      {isExpanded ? (
        <ResizableBox
          width={Infinity}
          height={height}
          axis="y"
          resizeHandles={['s']}
          minConstraints={[Infinity, 250]}
          maxConstraints={[Infinity, (window.innerHeight * 2) / 3]}
          onResize={(_, data) => {
            setHeight(data.size.height);
          }}
          className="bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg select-none"
        >
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-0.5 pl-2 border-b border-border-default-dark flex-shrink-0">
              <div className="flex items-center gap-2 rounded-md transition-colors flex-1">
                <MdOutlineChecklist className="w-4 h-4 text-agent-todo-tools" />
                <span className="text-xs font-medium text-text-secondary">
                  {t('todo.title')} ({completedCount}/{totalCount})
                </span>
              </div>
              <div className="flex items-center">
                <IconButton
                  icon={<MdPlaylistRemove className="w-4 h-4" />}
                  onClick={onClearAllTodos}
                  tooltip={t('todo.clearAllTodos')}
                  className="text-text-muted-light hover:text-text-secondary hover:bg-bg-secondary-light rounded-md p-2 transition-colors"
                />
                <IconButton
                  icon={<MdAdd className="w-4 h-4" />}
                  onClick={handleAddTodo}
                  tooltip={t('todo.addTodo')}
                  className="text-text-muted-light hover:text-text-secondary hover:bg-bg-secondary-light rounded-md p-2 transition-colors"
                />
                <IconButton
                  icon={<MdExpandLess className="w-4 h-4" />}
                  onClick={handleToggleExpand}
                  className="text-text-muted-light hover:text-text-secondary hover:bg-bg-secondary-light rounded-md p-2 transition-colors"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="p-3 h-full overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                {/* Add Todo Input */}
                {isAddingTodo && (
                  <div className="mb-3 p-2 bg-bg-secondary-light rounded border border-border-default">
                    <Input
                      type="text"
                      value={newTodoName}
                      onChange={(e) => setNewTodoName(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder={t('todo.todoNamePlaceholder')}
                      className="bg-transparent text-xs text-text-secondary placeholder-text-muted border-none outline-none py-0 px-1"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <Button onClick={handleCancelAdd} variant="text" size="sm" className="text-xs h-6 px-2">
                        {t('todo.cancelTodo')}
                      </Button>
                      <Button onClick={handleSaveTodo} variant="contained" size="sm" className="text-xs h-6 px-2" disabled={!newTodoName.trim()}>
                        {t('todo.saveTodo')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Todo List */}
                {todos.length > 0 ? (
                  <div className="space-y-0.5">
                    {todos.map((todo, index) => (
                      <TodoListItem
                        key={`${todo.name}-${index}`}
                        item={todo}
                        onToggle={onToggleTodo}
                        onUpdate={onUpdateTodo}
                        onDelete={onDeleteTodo}
                        onHandoff={onHandoffTodo}
                      />
                    ))}
                  </div>
                ) : (
                  !isAddingTodo && <div className="text-sm text-text-muted text-center py-4">{t('todo.noTodos')}</div>
                )}
              </div>
            </div>
          </div>
        </ResizableBox>
      ) : (
        /* Collapsed state */
        <div className="bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg p-0.5">
          <IconButton
            icon={<MdOutlineChecklist className="w-4 h-4 text-agent-todo-tools" />}
            onClick={handleToggleExpand}
            tooltip={`${t('todo.title')} (${completedCount}/${totalCount})`}
            className="hover:bg-bg-secondary-light rounded-md p-2 transition-colors"
          />
        </div>
      )}
    </div>
  );
};
