import { FaRegUser } from 'react-icons/fa';
import clsx from 'clsx';

import { MessageBar } from './MessageBar';

import { useParsedContent } from '@/hooks/useParsedContent';
import { UserMessage } from '@/types/message';

type Props = {
  baseDir: string;
  message: UserMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  onRemove?: () => void;
  onRedo?: () => void;
  onEdit?: (content: string) => void;
};

export const UserMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, onRemove, onRedo, onEdit }: Props) => {
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full text-xs border';

  const parsedContent = useParsedContent(baseDir, message.content, allFiles, renderMarkdown);

  const handleEdit = () => {
    if (onEdit) {
      onEdit(message.content);
    }
  };

  return (
    <div 
      className={clsx(baseClasses, 'relative flex flex-col group', !renderMarkdown && 'break-words whitespace-pre-wrap')}
      style={{
        backgroundColor: 'var(--theme-background-secondary)',
        borderColor: 'var(--theme-border-primary)',
        color: 'var(--theme-foreground-primary)'
      }}
    >
      <div className="flex items-start gap-2">
        <div className="mt-[3px]">
          <FaRegUser className="w-4 h-3" style={{ color: 'var(--theme-foreground-tertiary)' }} />
        </div>
        <div className="flex-grow-1 w-full overflow-hidden">{parsedContent}</div>
      </div>
      <MessageBar content={message.content} remove={onRemove} redo={onRedo} edit={onEdit ? handleEdit : undefined} />
    </div>
  );
};
