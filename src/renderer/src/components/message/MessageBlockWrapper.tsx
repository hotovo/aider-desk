import { memo, useMemo, type ReactNode } from 'react';
import { isGroupMessage, isAssistantGroupMessage, isUserMessage, Message } from '@common/types';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';
import { AssistantMessageBlock } from './AssistantMessageBlock';

import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { useExtensionMessageComponent } from '@/components/extensions/useExtensionMessageComponent';
import { includeMessageProperty } from '@/components/message/utils';

type Props = {
  baseDir: string;
  taskId: string;
  message: Message;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  hideMessageBar?: boolean;
  inProgress?: boolean;
  removeMessage?: (message: Message) => void;
  redoUserPrompt?: (messageId: string) => void;
  editUserMessage?: (messageId: string, content: string, images?: string[]) => void;
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
    compact = false,
    hideMessageBar = false,
    inProgress = false,
    removeMessage,
    redoUserPrompt,
    editUserMessage,
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

    const { hasMatch, renderMatchingComponent } = useExtensionMessageComponent({
      message,
      projectDir: baseDir,
      taskId,
    });

    let messageBlock: ReactNode;
    if (hasMatch) {
      messageBlock = renderMatchingComponent();
    } else if (isGroupMessage(message)) {
      messageBlock = (
        <GroupMessageBlock
          baseDir={baseDir}
          taskId={taskId}
          message={message}
          allFiles={allFiles}
          renderMarkdown={renderMarkdown}
          remove={inProgress ? undefined : removeMessage}
          redo={inProgress ? undefined : redoUserPrompt ? () => redoUserPrompt(message.id) : undefined}
          editUserMessage={editUserMessage}
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
          compact={compact}
          hideMessageBar={hideMessageBar}
          remove={inProgress ? undefined : removeMessage ? () => removeMessage(message) : undefined}
          redo={!inProgress && isUserMessage(message) && redoUserPrompt ? () => redoUserPrompt(message.id) : undefined}
          edit={
            !inProgress && isUserMessage(message) && editUserMessage
              ? (content: string, images?: string[]) => editUserMessage(message.id, content, images)
              : undefined
          }
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
