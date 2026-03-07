import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HELPERS_TOOL_GROUP_NAME,
  HELPERS_TOOL_INVALID_TOOL_ARGUMENTS,
  HELPERS_TOOL_NO_SUCH_TOOL,
  MEMORY_TOOL_GROUP_NAME,
  MEMORY_TOOL_STORE,
  MEMORY_TOOL_RETRIEVE,
  MEMORY_TOOL_DELETE,
  MEMORY_TOOL_LIST,
  MEMORY_TOOL_UPDATE,
  POWER_TOOL_BASH,
  POWER_TOOL_FETCH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SKILLS_TOOL_ACTIVATE_SKILL,
  SKILLS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_LIST_TASKS,
  TASKS_TOOL_GET_TASK,
  TASKS_TOOL_GET_TASK_MESSAGE,
  TASKS_TOOL_CREATE_TASK,
  TASKS_TOOL_DELETE_TASK,
  TASKS_TOOL_SEARCH_TASK,
  TASKS_TOOL_SEARCH_PARENT_TASK,
} from '@common/tools';

import { CommandOutputMessageBlock } from './CommandOutputMessageBlock';
import { LoadingMessageBlock } from './LoadingMessageBlock';
import { LogMessageBlock } from './LogMessageBlock';
import { UserMessageBlock } from './UserMessageBlock';
import { ReflectedMessageBlock } from './ReflectedMessageBlock';
import { ResponseMessageBlock } from './ResponseMessageBlock';
import { ToolMessageBlock } from './ToolMessageBlock';
import { FileWriteToolMessage } from './FileWriteToolMessage';
import { FileEditToolMessage } from './FileEditToolMessage';
import { FileReadToolMessage } from './FileReadToolMessage';
import { GlobToolMessage } from './GlobToolMessage';
import { GrepToolMessage } from './GrepToolMessage';
import { BashToolMessage } from './BashToolMessage';
import { FetchToolMessage } from './FetchToolMessage';
import { SemanticSearchToolMessage } from './SemanticSearchToolMessage';
import { SubagentToolMessage } from './SubagentToolMessage';
import { ListTasksToolMessage } from './ListTasksToolMessage';
import { GetTaskToolMessage } from './GetTaskToolMessage';
import { GetTaskMessageToolMessage } from './GetTaskMessageToolMessage';
import { CreateTaskToolMessage } from './CreateTaskToolMessage';
import { DeleteTaskToolMessage } from './DeleteTaskToolMessage';
import { SearchTaskToolMessage } from './SearchTaskToolMessage';
import { SearchParentTaskToolMessage } from './SearchParentTaskToolMessage';
import { StoreMemoryToolMessage } from './StoreMemoryToolMessage';
import { RetrieveMemoryToolMessage } from './RetrieveMemoryToolMessage';
import { DeleteMemoryToolMessage } from './DeleteMemoryToolMessage';
import { ListMemoriesToolMessage } from './ListMemoriesToolMessage';
import { UpdateMemoryToolMessage } from './UpdateMemoryToolMessage';
import { ActivateSkillToolMessage } from './ActivateSkillToolMessage';
import { TaskInfoMessage } from './TaskInfoMessage';
import { areMessagesEqual } from './utils';

import {
  isCommandOutputMessage,
  isLoadingMessage,
  isLogMessage,
  isReflectedMessage,
  isResponseMessage,
  isTaskInfoMessage,
  isToolMessage,
  isUserMessage,
  LogMessage,
  Message,
  ToolMessage,
} from '@/types/message';

type Props = {
  baseDir: string;
  taskId: string;
  message: Message;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  hideMessageBar?: boolean;
  remove?: () => void;
  redo?: () => void;
  edit?: (content: string) => void;
  onInterrupt?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
};

const MessageBlockComponent = ({
  baseDir,
  taskId,
  message,
  allFiles,
  renderMarkdown,
  compact = false,
  hideMessageBar = false,
  remove,
  redo,
  edit,
  onInterrupt,
  onFork,
  onRemoveUpTo,
}: Props) => {
  const { t } = useTranslation();

  if (isLoadingMessage(message)) {
    return <LoadingMessageBlock key={message.content} message={message} baseDir={baseDir} taskId={taskId} onInterrupt={onInterrupt} />;
  }

  if (isLogMessage(message)) {
    return <LogMessageBlock baseDir={baseDir} taskId={taskId} message={message} onRemove={remove} compact={compact} onInterrupt={onInterrupt} />;
  }

  if (isReflectedMessage(message)) {
    return <ReflectedMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} compact={compact} />;
  }

  if (isTaskInfoMessage(message)) {
    return <TaskInfoMessage message={message} onRemove={remove} />;
  }

  if (isCommandOutputMessage(message)) {
    return <CommandOutputMessageBlock message={message} compact={compact} />;
  }

  if (isUserMessage(message)) {
    return (
      <UserMessageBlock
        baseDir={baseDir}
        message={message}
        allFiles={allFiles}
        renderMarkdown={renderMarkdown}
        onRemove={remove}
        onRedo={redo}
        onEdit={edit}
        onFork={onFork}
        onRemoveUpTo={onRemoveUpTo}
        compact={compact}
      />
    );
  }

  if (isResponseMessage(message)) {
    return (
      <ResponseMessageBlock
        baseDir={baseDir}
        message={message}
        allFiles={allFiles}
        renderMarkdown={renderMarkdown}
        onRemove={remove}
        onFork={onFork}
        onRemoveUpTo={onRemoveUpTo}
        compact={compact}
      />
    );
  }

  if (isToolMessage(message)) {
    const toolMessage = message as ToolMessage;

    switch (toolMessage.serverName) {
      case POWER_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case POWER_TOOL_FILE_WRITE:
            return (
              <FileWriteToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_FILE_EDIT:
            return (
              <FileEditToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_FILE_READ:
            return (
              <FileReadToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_GLOB:
            return (
              <GlobToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_GREP:
            return (
              <GrepToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_BASH:
            return (
              <BashToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_FETCH:
            return (
              <FetchToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case POWER_TOOL_SEMANTIC_SEARCH:
            return (
              <SemanticSearchToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          default:
            break;
        }
        break;
      case SUBAGENTS_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case SUBAGENTS_TOOL_RUN_TASK:
            return (
              <SubagentToolMessage message={toolMessage} onRemove={remove} compact={compact} hideMessageBar={hideMessageBar} onRemoveUpTo={onRemoveUpTo} />
            );
          default:
            break;
        }
        break;
      case TASKS_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case TASKS_TOOL_LIST_TASKS:
            return (
              <ListTasksToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_GET_TASK:
            return (
              <GetTaskToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_GET_TASK_MESSAGE:
            return (
              <GetTaskMessageToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_CREATE_TASK:
            return (
              <CreateTaskToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_DELETE_TASK:
            return (
              <DeleteTaskToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_SEARCH_TASK:
            return (
              <SearchTaskToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case TASKS_TOOL_SEARCH_PARENT_TASK:
            return (
              <SearchParentTaskToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          default:
            break;
        }
        break;
      case MEMORY_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case MEMORY_TOOL_STORE:
            return (
              <StoreMemoryToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case MEMORY_TOOL_RETRIEVE:
            return (
              <RetrieveMemoryToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case MEMORY_TOOL_DELETE:
            return (
              <DeleteMemoryToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case MEMORY_TOOL_LIST:
            return (
              <ListMemoriesToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          case MEMORY_TOOL_UPDATE:
            return (
              <UpdateMemoryToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          default:
            break;
        }
        break;
      case SKILLS_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case SKILLS_TOOL_ACTIVATE_SKILL:
            return (
              <ActivateSkillToolMessage
                message={toolMessage}
                onRemove={remove}
                compact={compact}
                hideMessageBar={hideMessageBar}
                onFork={onFork}
                onRemoveUpTo={onRemoveUpTo}
              />
            );
          default:
            break;
        }
        break;
      case HELPERS_TOOL_GROUP_NAME: {
        let logMessageContent = toolMessage.content;

        if (toolMessage.toolName === HELPERS_TOOL_NO_SUCH_TOOL) {
          logMessageContent = t('toolMessage.errors.noSuchTool', {
            toolName: toolMessage.args.toolName,
          });
        } else if (toolMessage.toolName === HELPERS_TOOL_INVALID_TOOL_ARGUMENTS) {
          logMessageContent = t('toolMessage.errors.invalidToolArguments', {
            toolName: toolMessage.args.toolName,
          });
        }

        const logMessage: LogMessage = {
          type: 'log',
          level: 'info',
          id: toolMessage.id,
          content: logMessageContent,
        };
        return <LogMessageBlock baseDir={baseDir} taskId={taskId} message={logMessage} onRemove={remove} compact={compact} onInterrupt={onInterrupt} />;
      }
      default:
        break;
    }

    return (
      <ToolMessageBlock message={toolMessage} onRemove={remove} compact={compact} hideMessageBar={hideMessageBar} onFork={onFork} onRemoveUpTo={onRemoveUpTo} />
    );
  }

  return null;
};

const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  if (
    prevProps.baseDir !== nextProps.baseDir ||
    prevProps.taskId !== nextProps.taskId ||
    prevProps.allFiles.length !== nextProps.allFiles.length ||
    prevProps.renderMarkdown !== nextProps.renderMarkdown ||
    prevProps.compact !== nextProps.compact ||
    prevProps.hideMessageBar !== nextProps.hideMessageBar ||
    (prevProps.remove !== nextProps.remove && (prevProps.remove === undefined) !== (nextProps.remove === undefined)) ||
    (prevProps.redo !== nextProps.redo && (prevProps.redo === undefined) !== (nextProps.redo === undefined)) ||
    (prevProps.edit !== nextProps.edit && (prevProps.edit === undefined) !== (nextProps.edit === undefined))
  ) {
    return false;
  }

  return areMessagesEqual(prevProps.message, nextProps.message);
};

export const MessageBlock = memo(MessageBlockComponent, arePropsEqual);
