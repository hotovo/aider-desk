import {
  isCommandOutputMessage,
  isLogMessage,
  isLoadingMessage,
  isModelsMessage,
  isPromptMessage,
  isReflectedMessage,
  isResponseMessage,
  Message,
} from 'types/message';
import { CommandOutputMessageBlock } from './CommandOutputMessageBlock';
import { LoadingMessageBlock } from './LoadingMessageBlock';
import { ModelsMessageBlock } from './ModelsMessageBlock';
import { PromptMessageBlock } from './PromptMessageBlock';
import { ReflectedMessageBlock } from './ReflectedMessageBlock';
import { ResponseMessageBlock } from './ResponseMessageBlock';
import { LogMessageBlock } from './LogMessageBlock';

type Props = {
  message: Message;
  allFiles: string[];
};

export const MessageBlock = ({ message, allFiles }: Props) => {
  if (isLoadingMessage(message)) {
    return <LoadingMessageBlock message={message} />;
  }

  if (isLogMessage(message)) {
    return <LogMessageBlock message={message} />;
  }

  if (isModelsMessage(message)) {
    return <ModelsMessageBlock message={message} />;
  }

  if (isReflectedMessage(message)) {
    return <ReflectedMessageBlock message={message} allFiles={allFiles} />;
  }

  if (isCommandOutputMessage(message)) {
    return <CommandOutputMessageBlock message={message} />;
  }

  if (isPromptMessage(message)) {
    return <PromptMessageBlock message={message} allFiles={allFiles} />;
  }

  if (isResponseMessage(message)) {
    return <ResponseMessageBlock message={message} allFiles={allFiles} />;
  }

  return null;
};
