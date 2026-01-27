import { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { CommandOutputData } from '@common/types';
import type { CommandOutputMessage, Message } from '@/types/message';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

const isCommandOutputMessage = (message: Message): message is CommandOutputMessage => {
  return message.type === 'command-output';
};

export const useTaskCommandHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  const handleCommandOutput = useCallback(
    ({ command, output }: CommandOutputData) => {
      setMessages(taskId, (prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (lastMessage && isCommandOutputMessage(lastMessage) && lastMessage.command === command) {
          const updatedLastMessage: CommandOutputMessage = {
            ...lastMessage,
            content: lastMessage.content + output,
          };
          return prevMessages.slice(0, -1).concat(updatedLastMessage);
        } else {
          const commandOutputMessage: CommandOutputMessage = {
            id: uuidv4(),
            type: 'command-output',
            command,
            content: output,
          };
          return prevMessages.filter((message) => message.type !== 'loading').concat(commandOutputMessage);
        }
      });
    },
    [taskId, setMessages],
  );

  useEffect(() => {
    const removeListener = api.addCommandOutputListener(baseDir, taskId, handleCommandOutput);

    return () => {
      removeListener();
    };
  }, [api, baseDir, taskId, handleCommandOutput]);
};
