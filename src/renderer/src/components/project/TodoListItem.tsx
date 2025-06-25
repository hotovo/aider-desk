import { useState } from 'react';
import clsx from 'clsx';
import { MdEdit, MdDelete, MdCheck, MdClose } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@common/types';

import { Checkbox } from '../common/Checkbox';
import { IconButton } from '../common/IconButton';

type Props = {
  item: TodoItem;
  onToggle?: (name: string, completed: boolean) => void;
  onUpdate?: (name: string, updates: Partial<TodoItem>) => void;
  onDelete?: (name: string) => void;
};

export const TodoListItem = ({ item, onToggle, onUpdate, onDelete }: Props) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  const handleToggle = (checked: boolean) => {
    onToggle?.(item.name, checked);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditName(item.name);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== item.name && onUpdate) {
      onUpdate(item.name, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(item.name);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(item.name);
    }
  };

  return (
    <div className="group flex items-center gap-2 hover:bg-neutral-800/50 rounded p-1 -m-1">
      <Checkbox checked={item.completed} onChange={handleToggle} size="sm" className={clsx(item.completed && 'opacity-40')} />

      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 bg-neutral-700 text-2xs text-neutral-200 px-1 py-0.5 rounded border border-neutral-600 outline-none focus:border-sky-500"
            autoFocus
          />
          <IconButton
            icon={<MdCheck className="w-3 h-3" />}
            onClick={handleSaveEdit}
            className="text-green-400 hover:text-green-300 hover:bg-green-400/10 rounded p-1"
            disabled={!editName.trim()}
          />
          <IconButton
            icon={<MdClose className="w-3 h-3" />}
            onClick={handleCancelEdit}
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded p-1"
          />
        </div>
      ) : (
        <>
          <span className={clsx('text-2xs flex-1 transition-all duration-200', item.completed ? 'text-neutral-500 line-through' : 'text-neutral-200')}>
            {item.name}
          </span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <IconButton
              icon={<MdEdit className="w-3 h-3" />}
              onClick={handleEdit}
              tooltip={t('tasks.editTodo')}
              className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded p-1"
            />
            <IconButton
              icon={<MdDelete className="w-3 h-3" />}
              onClick={handleDelete}
              tooltip={t('tasks.deleteTodo')}
              className="text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded p-1"
            />
          </div>
        </>
      )}
    </div>
  );
};
