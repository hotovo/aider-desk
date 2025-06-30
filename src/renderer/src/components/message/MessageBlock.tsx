import { useTranslation } from 'react-i18next';
import {
  HELPERS_TOOL_GROUP_NAME,
  HELPERS_TOOL_INVALID_TOOL_ARGUMENTS,
  HELPERS_TOOL_NO_SUCH_TOOL,
  POWER_TOOL_AGENT,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GROUP_NAME,
} from '@common/tools';

import { CommandOutputMessageBlock } from './CommandOutputMessageBlock';
import { LoadingMessageBlock } from './LoadingMessageBlock';
import { LogMessageBlock } from './LogMessageBlock';
import { UserMessageBlock } from './UserMessageBlock';
import { ReflectedMessageBlock } from './ReflectedMessageBlock';
import { ResponseMessageBlock } from './ResponseMessageBlock';

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
import { ToolMessageBlock } from '@/components/message/ToolMessageBlock';
import { FileWriteToolMessage } from '@/components/message/FileWriteToolMessage';
import { EditFileToolMessage } from '@/components/message/EditFileToolMessage';
import { AgentToolMessage } from '@/components/message/AgentToolMessage';

type Props = {
  baseDir: string;
  message: Message;
  allFiles: string[];
  renderMarkdown: boolean;
  remove?: () => void;
  redo?: () => void;
  edit?: (content: string) => void;
};

export const MessageBlock = ({ baseDir, message, allFiles, renderMarkdown, remove, redo, edit }: Props) => {
  const { t } = useTranslation();

  if (isLoadingMessage(message)) {
    return <LoadingMessageBlock message={message} />;
  }

  if (isLogMessage(message)) {
    return <LogMessageBlock message={message} onRemove={remove} />;
  }

  if (isReflectedMessage(message)) {
    return <ReflectedMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} />;
  }

  if (isCommandOutputMessage(message)) {
    return <CommandOutputMessageBlock message={message} />;
  }

  if (isUserMessage(message)) {
    return (
      <UserMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} renderMarkdown={renderMarkdown} onRemove={remove} onRedo={redo} onEdit={edit} />
    );
  }

  if (isResponseMessage(message)) {
    return <ResponseMessageBlock baseDir={baseDir} message={message} allFiles={allFiles} renderMarkdown={renderMarkdown} onRemove={remove} />;
  }

  if (isToolMessage(message)) {
    const toolMessage = message as ToolMessage;

    if (toolMessage.serverName === POWER_TOOL_GROUP_NAME) {
      if (toolMessage.toolName === POWER_TOOL_FILE_WRITE) {
        return <FileWriteToolMessage message={toolMessage} onRemove={remove} />;
      }
      if (toolMessage.toolName === POWER_TOOL_FILE_EDIT) {
        return <EditFileToolMessage message={toolMessage} onRemove={remove} />;
      }
      if (toolMessage.toolName === POWER_TOOL_AGENT) {
        return <AgentToolMessage message={toolMessage} onRemove={remove} />;
      }
    }

    if (toolMessage.serverName === HELPERS_TOOL_GROUP_NAME) {
      let logMessageContent = toolMessage.content;

      if (toolMessage.toolName === HELPERS_TOOL_NO_SUCH_TOOL) {
        logMessageContent = t('toolMessage.errors.noSuchTool', { toolName: toolMessage.args.toolName });
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
      return <LogMessageBlock message={logMessage} onRemove={remove} />;
    }

    return <ToolMessageBlock message={toolMessage} onRemove={remove} />;
  }

  return null;
};
