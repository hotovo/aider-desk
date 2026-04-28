import { memo, useMemo, type ReactNode } from 'react';
import { isGroupMessage, isAssistantGroupMessage, isUserMessage, Message } from '@common/types';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';
import { AssistantMessageBlock } from './AssistantMessageBlock';

import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { includeMessageProperty } from '@/components/message/utils';

type Props = {
  baseDir: string;
  taskId: string;
  message: Message;
  allFiles: string[];
  renderMarkdown: boolean;
  index: number;
  lastUserMessageIndex: number;
  inProgress: boolean;
  removeMessage: (message: Message) => void;
  redoUserPrompt: (messageId: string) => void;
  editLastUserMessage: (content: string) => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

export const MessageBlockWrapper = memo(
  ({
    baseDir,
    taskId,
    message,
    allFiles,
    renderMarkdown,
    index,
    lastUserMessageIndex,
    inProgress,
    removeMessage,
    redoUserPrompt,
    editLastUserMessage,
    onInterrupt,
    onForkFromMessage,
    onRemoveUpToMessage,
  }: Props) => {
    const additionalProps = useMemo(
      () => ({
        message: includeMessageProperty(message) ? message : null,
      }),
      [message],
    );

    let messageBlock: ReactNode;
    if (isGroupMessage(message)) {
      messageBlock = (
        <GroupMessageBlock
          baseDir={baseDir}
          taskId={taskId}
          message={message}
          allFiles={allFiles}
          renderMarkdown={renderMarkdown}
          remove={inProgress ? undefined : removeMessage}
          redo={inProgress ? undefined : () => redoUserPrompt(message.id)}
          edit={editLastUserMessage}
          onInterrupt={onInterrupt}
        />
      );
    } else if (isAssistantGroupMessage(message)) {
      messageBlock = (
        <AssistantMessageBlock
          baseDir={baseDir}
          taskId={taskId}
          message={message}
          allFiles={allFiles}
          renderMarkdown={renderMarkdown}
          remove={inProgress ? undefined : removeMessage}
          onFork={onForkFromMessage}
          onRemoveUpTo={onRemoveUpToMessage}
        />
      );
    } else {
      messageBlock = (
        <MessageBlock
          baseDir={baseDir}
          taskId={taskId}
          message={message}
          allFiles={allFiles}
          renderMarkdown={renderMarkdown}
          remove={inProgress ? undefined : () => removeMessage(message)}
          redo={!inProgress && isUserMessage(message) ? () => redoUserPrompt(message.id) : undefined}
          edit={index === lastUserMessageIndex ? editLastUserMessage : undefined}
          onInterrupt={onInterrupt}
          onFork={onForkFromMessage ? () => onForkFromMessage(message) : undefined}
          onRemoveUpTo={onRemoveUpToMessage ? () => onRemoveUpToMessage(message) : undefined}
        />
      );
    }

    return (
      <div>
        <ExtensionComponentWrapper placement="task-message-above" additionalProps={additionalProps} />
        {messageBlock}
        <ExtensionComponentWrapper placement="task-message-below" additionalProps={additionalProps} />
      </div>
    );
  },
);

MessageBlockWrapper.displayName = 'MessageBlockWrapper';
