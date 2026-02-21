import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import { MdKeyboardDoubleArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { DefaultTaskState, MessageViewMode, TaskData } from '@common/types';
import { TaskStateActions } from 'src/renderer/src/components/message/TaskStateActions';

import { MessageBlock } from './MessageBlock';
import { GroupMessageBlock } from './GroupMessageBlock';
import { AssistantMessageBlock } from './AssistantMessageBlock';

import { isAssistantGroupMessage, isGroupMessage, isLoadingMessage, isUserMessage, Message } from '@/types/message';
import { IconButton } from '@/components/common/IconButton';
import { groupAssistantMessages, groupMessagesByPromptContext } from '@/components/message/utils';
import { useScrollingPaused } from '@/hooks/useScrollingPaused';
import { useUserMessageNavigation } from '@/hooks/useUserMessageNavigation';
import { useSettings } from '@/contexts/SettingsContext';

export type MessagesRef = {
  exportToImage: () => void;
  container: HTMLDivElement | null;
  scrollToBottom: () => void;
};

type Props = {
  baseDir: string;
  taskId: string;
  task: TaskData;
  messages: Message[];
  allFiles?: string[];
  renderMarkdown: boolean;
  removeMessage: (message: Message) => void;
  resumeTask: () => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: (content: string) => void;
  onMarkAsDone: () => void;
  onRunPrompt?: (prompt: string) => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
  onInterrupt?: () => void;
  onForkFromMessage?: (message: Message) => void;
  onRemoveUpToMessage?: (message: Message) => void;
};

const MessagesComponent = forwardRef<MessagesRef, Props>(
  (
    {
      baseDir,
      taskId,
      task,
      messages,
      allFiles = [],
      renderMarkdown,
      removeMessage,
      resumeTask,
      redoLastUserPrompt,
      editLastUserMessage,
      onMarkAsDone,
      onRunPrompt,
      onArchiveTask,
      onUnarchiveTask,
      onDeleteTask,
      onInterrupt,
      onForkFromMessage,
      onRemoveUpToMessage,
    },
    ref,
  ) => {
    const { settings } = useSettings();
    const { t } = useTranslation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isCompactMode = settings?.messageViewMode === MessageViewMode.Compact;

    // Group messages by promptContext.group.id, then optionally group assistant messages for compact mode
    const processedMessages = useMemo(() => {
      const grouped = groupMessagesByPromptContext(messages);
      return isCompactMode ? groupAssistantMessages(grouped) : grouped;
    }, [messages, isCompactMode]);
    const lastUserMessageIndex = processedMessages.findLastIndex(isUserMessage);
    const isLastLoadingMessage = processedMessages.length > 0 && isLoadingMessage(processedMessages[processedMessages.length - 1]);
    const inProgress = task.state === DefaultTaskState.InProgress;

    const { scrollingPaused, setScrollingPaused, scrollToBottom, eventHandlers } = useScrollingPaused({
      onAutoScroll: () => messagesEndRef.current?.scrollIntoView(),
    });

    useEffect(() => {
      if (!scrollingPaused) {
        messagesEndRef.current?.scrollIntoView();
      }
    }, [processedMessages, scrollingPaused]);

    // Get all user message IDs
    const userMessageIds = useMemo(() => {
      return processedMessages.filter(isUserMessage).map((message) => message.id);
    }, [processedMessages]);

    const { hasPreviousUserMessage, hasNextUserMessage, renderGoToPrevious, renderGoToNext } = useUserMessageNavigation({
      containerRef: messagesContainerRef,
      userMessageIds,
      scrollToMessageByElement: (element: HTMLElement) => {
        setScrollingPaused(true);
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      buttonClassName: 'hidden group-hover:block',
    });

    const exportToImage = async () => {
      const messagesContainer = messagesContainerRef.current;
      if (messagesContainer === null) {
        return;
      }

      try {
        const dataUrl = await toPng(messagesContainer, {
          cacheBust: true,
          height: messagesContainer.scrollHeight,
        });
        const link = document.createElement('a');
        link.download = `session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.png`;
        link.href = dataUrl;
        link.click();
        link.remove();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to export chat as PNG', err);
      }
    };

    useImperativeHandle(ref, () => ({
      exportToImage,
      container: messagesContainerRef.current,
      scrollToBottom,
    }));

    return (
      <div className="relative flex flex-col h-full">
        <div
          ref={messagesContainerRef}
          className="flex flex-col flex-grow overflow-y-auto max-h-full p-4 scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth"
          {...eventHandlers}
        >
          {processedMessages.map((message, index) => {
            if (isGroupMessage(message)) {
              return (
                <GroupMessageBlock
                  key={message.id}
                  baseDir={baseDir}
                  taskId={taskId}
                  message={message}
                  allFiles={allFiles}
                  renderMarkdown={renderMarkdown}
                  remove={inProgress ? undefined : removeMessage}
                  redo={inProgress ? undefined : redoLastUserPrompt}
                  edit={editLastUserMessage}
                  onInterrupt={onInterrupt}
                />
              );
            }
            if (isAssistantGroupMessage(message)) {
              return (
                <AssistantMessageBlock
                  key={message.id}
                  baseDir={baseDir}
                  taskId={taskId}
                  message={message}
                  allFiles={allFiles}
                  renderMarkdown={renderMarkdown}
                  remove={inProgress ? undefined : () => removeMessage(message)}
                  onFork={onForkFromMessage ? () => onForkFromMessage(message) : undefined}
                  onRemoveUpTo={onRemoveUpToMessage ? () => onRemoveUpToMessage(message) : undefined}
                />
              );
            }
            return (
              <MessageBlock
                key={message.id}
                baseDir={baseDir}
                taskId={taskId}
                message={message}
                allFiles={allFiles}
                renderMarkdown={renderMarkdown}
                remove={inProgress ? undefined : () => removeMessage(message)}
                redo={index === lastUserMessageIndex && !inProgress ? redoLastUserPrompt : undefined}
                edit={index === lastUserMessageIndex ? editLastUserMessage : undefined}
                onInterrupt={onInterrupt}
                onFork={onForkFromMessage ? () => onForkFromMessage(message) : undefined}
                onRemoveUpTo={onRemoveUpToMessage ? () => onRemoveUpToMessage(message) : undefined}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="relative">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[140px] z-10 flex justify-center gap-1 pt-6 pb-1 group">
            {(hasPreviousUserMessage || hasNextUserMessage) && renderGoToPrevious()}
            {scrollingPaused && (
              <IconButton
                icon={<MdKeyboardDoubleArrowDown className="h-6 w-6" />}
                onClick={scrollToBottom}
                tooltip={t('messages.scrollToBottom')}
                className="bg-bg-primary-light border border-border-default shadow-lg hover:bg-bg-secondary transition-colors duration-200"
                aria-label={t('messages.scrollToBottom')}
              />
            )}
            {(hasPreviousUserMessage || hasNextUserMessage) && renderGoToNext()}
          </div>
        </div>
        {settings?.taskSettings?.showTaskStateActions && !inProgress && !isLastLoadingMessage && (
          <TaskStateActions
            state={task.state}
            mode={task.currentMode}
            isArchived={task.archived}
            task={task}
            projectDir={baseDir}
            taskId={taskId}
            onResumeTask={resumeTask}
            onMarkAsDone={onMarkAsDone}
            onRunPrompt={onRunPrompt}
            onArchiveTask={onArchiveTask}
            onUnarchiveTask={onUnarchiveTask}
            onDeleteTask={onDeleteTask}
          />
        )}
      </div>
    );
  },
);

MessagesComponent.displayName = 'Messages';

export const Messages = memo(MessagesComponent);
