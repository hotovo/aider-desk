import { clsx } from 'clsx';
import { RiRobot2Line } from 'react-icons/ri';

import { MessageBar } from './MessageBar';

import { useParsedContent } from '@/hooks/useParsedContent';
import { ResponseMessage } from '@/types/message';

type Props = {
  baseDir: string;
  message: ResponseMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  onRemove?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
};

export const ResponseMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, compact = false, onRemove, onFork, onRemoveUpTo }: Props) => {
  const baseClasses = 'rounded-md max-w-full text-xs bg-bg-secondary text-text-primary';

  const parsedContent = useParsedContent(baseDir, message.content, allFiles, renderMarkdown, !compact);

  if (!parsedContent || (Array.isArray(parsedContent) && parsedContent.length === 0)) {
    return null;
  }

  return (
    <div
      className={clsx(
        baseClasses,
        'relative flex flex-col group',
        !renderMarkdown && 'break-words whitespace-pre-wrap',
        !compact && 'p-3 mb-2 border border-border-dark-light',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-[1px] relative">
          <RiRobot2Line className="text-text-muted w-4 h-4" />
        </div>
        <div className="flex-grow-1 w-full overflow-hidden">{parsedContent}</div>
      </div>
      {!compact && <MessageBar content={message.content} usageReport={message.usageReport} remove={onRemove} onFork={onFork} onRemoveUpTo={onRemoveUpTo} />}
    </div>
  );
};
