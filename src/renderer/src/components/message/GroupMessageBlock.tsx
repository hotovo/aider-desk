import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { LocalizedString } from '@common/types';

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

  const getGroupDisplayName = (name?: string | LocalizedString) => {
    if (!name) {
      return t('messages.group');
    }

    if (typeof name === 'string') {
      return t(name || 'messages.group');
    }

    // name is LocalizedString
    return t(name.key, name.params || {});
  };

  const header = (
    <div className={clsx('w-full flex items-center pl-2 py-1', !message.group.finished && 'animate-pulse')}>
      <span className="text-xs">{getGroupDisplayName(message.group.name)}</span>
    </div>
  );

  return (
    <div className={clsx('bg-bg-secondary border border-border-dark-light rounded-md mb-2 relative')}>
      {/* Color Bar */}
      <div
        className={clsx('absolute left-0 top-0 h-full w-1 rounded-tl-md rounded-bl-md z-10', !message.group.finished && 'animate-pulse')}
        style={{
          backgroundColor: message.group.color,
        }}
      />
      {/* Content */}
      <Accordion title={header} chevronPosition="right" noMaxHeight={true}>
        <div className="p-2 pl-3 pb-0.5 bg-bg-primary-light rounded-b-md">
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
