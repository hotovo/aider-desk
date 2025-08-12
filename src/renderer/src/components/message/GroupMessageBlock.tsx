import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

import { MessageBlock } from './MessageBlock';

import { Accordion } from '@/components/common/Accordion';
import { GroupMessage, Message } from '@/types/message';

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
  const { t } = useTranslation();

  const header = (
    <div className={clsx('w-full flex items-center pl-2 py-1', !message.group.finished && 'animate-pulse')}>
      <span className="text-xs">{t(message.group.name || 'messages.group')}</span>
    </div>
  );

  return (
    <div className={clsx('bg-bg-secondary border border-border-darkLight rounded-md mb-2 relative')}>
      {/* Color Bar */}
      <div
        className={clsx('absolute left-0 top-0 h-full w-1 rounded-tl-md rounded-bl-md z-10', !message.group.finished && 'animate-pulse')}
        style={{
          backgroundColor: 'var(--color-bg-fourth)',
        }}
      ></div>
      {/* Content */}
      <Accordion title={header} chevronPosition="right" noMaxHeight={true}>
        <div className="p-2 pl-3 pb-0.5 bg-bg-primaryLight rounded-b-md">
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
