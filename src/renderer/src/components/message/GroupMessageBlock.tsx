import { Accordion } from '@/components/common/Accordion';
import { GroupMessage, Message } from '@/types/message';
import { MessageBlock } from './MessageBlock';
import clsx from 'clsx';

type Props = {
  baseDir: string;
  message: GroupMessage;
  allFiles: string[];
  renderMarkdown: boolean;
  remove?: (message: Message) => void;
  redo?: () => void;
  edit?: (content: string) => void;
};

export const GroupMessageBlock = ({ baseDir, message, allFiles, renderMarkdown, remove, redo, edit }: Props) => {
  const getStripeColor = () => {
    switch (message.groupType) {
      case 'sub-agent':
        return 'bg-blue-500';
      case 'aider-run':
        return 'bg-green-500';
      default:
        return 'bg-neutral-500';
    }
  };

  const header = (
    <div className="flex items-center">
      <div className="flex flex-col">
        <span className="font-bold">{message.profile.name}</span>
        <span className="text-sm text-neutral-500 truncate">{message.prompt}</span>
      </div>
    </div>
  );

  return (
    <div className={clsx('bg-neutral-800 rounded-lg overflow-hidden border-l-4', getStripeColor())}>
      <Accordion header={header}>
        <div className="p-4 border-t border-neutral-700">
          {message.children.map((child, index) => (
            <MessageBlock
              key={child.id || index}
              baseDir={baseDir}
              message={child}
              allFiles={allFiles}
              renderMarkdown={renderMarkdown}
              remove={remove ? () => remove(child) : undefined}
              redo={redo}
              edit={edit}
            />
          ))}
        </div>
      </Accordion>
    </div>
  );
};
