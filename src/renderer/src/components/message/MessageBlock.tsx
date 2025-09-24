import { useTranslation } from 'react-i18next';
import {
  HELPERS_TOOL_GROUP_NAME,
  HELPERS_TOOL_INVALID_TOOL_ARGUMENTS,
  HELPERS_TOOL_NO_SUCH_TOOL,
  POWER_TOOL_BASH,
  POWER_TOOL_FETCH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
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

import {
  isCommandOutputMessage,
  isLoadingMessage,
  isLogMessage,
  isReflectedMessage,
  isResponseMessage,
  isToolMessage,
  isUserMessage,
  LogMessage,
  Message,
  ToolMessage,
} from '@/types/message';

type Props = {
  baseDir: string;
  message: Message;
  allFiles: string[];
  renderMarkdown: boolean;
  compact?: boolean;
  remove?: () => void;
  redo?: () => void;
  edit?: (content: string) => void;
};

export const MessageBlock = ({ baseDir, message, allFiles, renderMarkdown, compact = false, remove, redo, edit }: Props) => {
  const { t } = useTranslation();

  if (isLoadingMessage(message)) {
    return <LoadingMessageBlock message={message} />;
  }

  if (isLogMessage(message)) {
    return <LogMessageBlock message={message} onRemove={remove} compact={compact} />;
  }

  if (isReflectedMessage(message)) {
    return <ReflectedMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} compact={compact} />;
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
        compact={compact}
      />
    );
  }

  if (isResponseMessage(message)) {
    return <ResponseMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} renderMarkdown={renderMarkdown} onRemove={remove} compact={compact} />;
  }

  if (isToolMessage(message)) {
    const toolMessage = message as ToolMessage;

    switch (toolMessage.serverName) {
      case POWER_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case POWER_TOOL_FILE_WRITE:
            return <FileWriteToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_FILE_EDIT:
            return <FileEditToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_FILE_READ:
            return <FileReadToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_GLOB:
            return <GlobToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_GREP:
            return <GrepToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_BASH:
            return <BashToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_FETCH:
            return <FetchToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          case POWER_TOOL_SEMANTIC_SEARCH:
            return <SemanticSearchToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
          default:
            break;
        }
        break;
      case SUBAGENTS_TOOL_GROUP_NAME:
        switch (toolMessage.toolName) {
          case SUBAGENTS_TOOL_RUN_TASK:
            return <SubagentToolMessage message={toolMessage} onRemove={remove} compact={compact} />;
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
        return <LogMessageBlock message={logMessage} onRemove={remove} compact={compact} />;
      }
      default:
        break;
    }

    return <ToolMessageBlock message={toolMessage} onRemove={remove} compact={compact} />;
  }

  return null;
};
