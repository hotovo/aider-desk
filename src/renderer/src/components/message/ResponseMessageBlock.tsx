import clsx from 'clsx';
import { RiRobot2Line } from 'react-icons/ri';

import { MessageBar } from './MessageBar';

import { useParsedContent } from '@/hooks/useParsedContent';
import { ResponseMessage } from '@/types/message';

type Props = {
  baseDir: string;
  message: ResponseMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  onRemove?: () => void;
};

export const ResponseMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, onRemove }: Props) => {
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full text-xs border';

  const parsedContent = useParsedContent(baseDir, message.content, allFiles, renderMarkdown);

  if (!message.content) {
    return null;
  }

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
        <div className="mt-[1px]">
          <RiRobot2Line className="w-4 h-4" style={{ color: 'var(--theme-foreground-tertiary)' }} />
        </div>
        <div className="flex-grow-1 w-full overflow-hidden">{parsedContent}</div>
      </div>
      <MessageBar content={message.content} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
