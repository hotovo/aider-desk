import clsx from 'clsx';
import { TodoItem } from '@common/types';

import { Checkbox } from '../common/Checkbox';

type Props = {
  item: TodoItem;
  onToggle?: (name: string, completed: boolean) => void;
};

export const TodoListItem = ({ item, onToggle }: Props) => {
  const handleToggle = (checked: boolean) => {
    onToggle?.(item.name, checked);
  };

  return (
    <div className="flex items-start gap-2">
      <Checkbox checked={item.completed} onChange={handleToggle} size="sm" className={clsx(item.completed && 'opacity-40')} />
      <span className={clsx('text-2xs flex-1 transition-all duration-200', item.completed ? 'text-neutral-500 line-through' : 'text-neutral-200')}>
        {item.name}
      </span>
    </div>
  );
};
