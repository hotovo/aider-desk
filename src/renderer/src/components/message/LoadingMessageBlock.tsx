import { LoadingMessage } from '@/types/message';
import { useTypingAnimation } from '@/hooks/useTypingAnimation';
import { MessageActions } from '@/components/message/MessageActions';

type Props = {
  message: LoadingMessage;
  baseDir: string;
  taskId: string;
  onInterrupt?: () => void;
};

export const LoadingMessageBlock = ({ message, baseDir, taskId, onInterrupt }: Props) => {
  const displayedText = useTypingAnimation(message.content, 60, 3000);

  const baseClasses =
    'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-bg-secondary border border-border-dark-light text-text-primary';

  return (
    <div className={`${baseClasses} text-text-secondary relative group flex items-center`}>
      <span className="flex-grow">{displayedText || ' '}</span>
      {message.actionIds && (
        <div className="flex flex-wrap justify-end">
          <MessageActions actionIds={message.actionIds} baseDir={baseDir} taskId={taskId} onInterrupt={onInterrupt} />
        </div>
      )}
    </div>
  );
};
