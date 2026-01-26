import { FaRegUser } from 'react-icons/fa';
import { clsx } from 'clsx';

import { MessageBar } from './MessageBar';

import { useParsedContent } from '@/hooks/useParsedContent';
import { UserMessage } from '@/types/message';

type Props = {
  baseDir: string;
  message: UserMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  onRemove?: () => void;
  onRedo?: () => void;
  onEdit?: (content: string) => void;
  onFork?: () => void;
};

export const UserMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, compact = false, onRemove, onRedo, onEdit, onFork }: Props) => {
  const baseClasses =
    'rounded-md p-3 mb-2 max-w-full text-xs bg-bg-secondary border border-border-dark-light text-text-primary border-l-4 border-l-border-accent';
  const parsedContent = useParsedContent(baseDir, message.content, allFiles, renderMarkdown);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(message.content);
    }
  };

  return (
    <div id={`user-message-${message.id}`} className={clsx(baseClasses, 'relative flex flex-col group', !renderMarkdown && 'break-words whitespace-pre-wrap')}>
      <div className="flex items-start gap-2">
        <div className="mt-[3px]">
          <FaRegUser className="text-text-tertiary w-3.5 h-3.5" />
        </div>
        <div className="flex-grow-1 w-full overflow-hidden">{parsedContent}</div>
      </div>
      {!compact && <MessageBar content={message.content} remove={onRemove} redo={onRedo} edit={onEdit ? handleEdit : undefined} onFork={onFork} />}
    </div>
  );
};
