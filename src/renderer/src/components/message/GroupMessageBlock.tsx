import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { LocalizedString, UsageReportData } from '@common/types';

import { MessageBlock } from './MessageBlock';
import { MessageBar } from './MessageBar';

import { Accordion } from '@/components/common/Accordion';
import { GroupMessage, Message, ResponseMessage, ToolMessage, isResponseMessage, isToolMessage } from '@/types/message';

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

  const aggregateUsage = (messages: Message[]): UsageReportData | undefined => {
    const messagesWithUsage: (ResponseMessage | ToolMessage)[] = [];
    let lastMessageWithUsage: ResponseMessage | ToolMessage | undefined;

    // Find all messages with usageReport and the last one
    for (const msg of messages) {
      if ((isResponseMessage(msg) || isToolMessage(msg)) && msg.usageReport) {
        messagesWithUsage.push(msg);
        lastMessageWithUsage = msg;
      }
    }

    if (messagesWithUsage.length === 0) {
      return undefined;
    }

    // Use tokens from the last message with usage
    const lastUsage = lastMessageWithUsage!.usageReport!;

    // Sum costs from all messages with usage
    const totalCost = messagesWithUsage.reduce((sum, msg) => {
      if (isResponseMessage(msg) || isToolMessage(msg)) {
        return sum + (msg.usageReport?.messageCost || 0);
      }
      return sum;
    }, 0);

    return {
      model: lastUsage.model,
      sentTokens: lastUsage.sentTokens,
      receivedTokens: lastUsage.receivedTokens,
      messageCost: totalCost,
      cacheWriteTokens: lastUsage.cacheWriteTokens,
      cacheReadTokens: lastUsage.cacheReadTokens,
    };
  };

  const aggregatedUsage = aggregateUsage(message.children);

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
    <div className={clsx('w-full px-3 py-1 group', !message.group.finished && 'animate-pulse')}>
      <div className="text-xs text-left">{getGroupDisplayName(message.group.name)}</div>
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
      <Accordion title={header} chevronPosition="right" noMaxHeight={true} showCollapseButton={true}>
        <div className="p-2 pl-3 pb-0.5 bg-bg-primary-light">
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
      <div className="px-3 pb-3">
        <MessageBar className="mt-0" usageReport={aggregatedUsage} />
      </div>
    </div>
  );
};
