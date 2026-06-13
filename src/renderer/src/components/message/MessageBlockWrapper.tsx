import { memo, useMemo, type ReactNode } from 'react';
import { isGroupMessage, isAssistantGroupMessage, isUserMessage, Message } from '@common/types';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';
import { AssistantMessageBlock } from './AssistantMessageBlock';
import { areMessagesEqual } from './utils';

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

const MessageBlockWrapperInner = ({
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
      <ExtensionComponentWrapper placement="task-message-above" additionalProps={additionalProps} projectDir={baseDir} taskId={taskId} />
      {messageBlock}
      <ExtensionComponentWrapper placement="task-message-below" additionalProps={additionalProps} projectDir={baseDir} taskId={taskId} />
    </div>
  );
};

MessageBlockWrapperInner.displayName = 'MessageBlockWrapper';

const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    prevProps.baseDir !== nextProps.baseDir ||
    prevProps.taskId !== nextProps.taskId ||
    prevProps.allFiles.length !== nextProps.allFiles.length ||
    prevProps.renderMarkdown !== nextProps.renderMarkdown ||
    prevProps.compact !== nextProps.compact ||
    prevProps.hideMessageBar !== nextProps.hideMessageBar ||
    prevProps.inProgress !== nextProps.inProgress
  ) {
    return false;
  }

  if (
    prevProps.removeMessage !== nextProps.removeMessage ||
    prevProps.redoUserPrompt !== nextProps.redoUserPrompt ||
    prevProps.editUserMessage !== nextProps.editUserMessage ||
    prevProps.onInterrupt !== nextProps.onInterrupt ||
    prevProps.onForkFromMessage !== nextProps.onForkFromMessage ||
    prevProps.onRemoveUpToMessage !== nextProps.onRemoveUpToMessage
  ) {
    return false;
  }

  return areMessagesEqual(prevProps.message, nextProps.message);
};

export const MessageBlockWrapper = memo(MessageBlockWrapperInner, arePropsEqual);
