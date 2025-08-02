import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Message,
  ResponseMessage,
  ReflectedMessage,
  LoadingMessage,
  LogMessage,
  CommandOutputMessage,
  ToolMessage,
  UserMessage,
  GroupMessage,
  isCommandOutputMessage,
  isLoadingMessage,
} from '@/types/message';
import { AgentProfile, ResponseCompletedData } from '@common/types';

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentGroupIdRef = useRef<string | null>(null);
  const processingMessageRef = useRef<ResponseMessage | null>(null);

  const addMessage = (newMessage: Message, reflectedMessage?: string) => {
    const messagesToAdd: Message[] = [];
    if (reflectedMessage) {
      const reflected: ReflectedMessage = {
        id: uuidv4(),
        type: 'reflected-message',
        content: reflectedMessage,
        responseMessageId: newMessage.id,
      };
      messagesToAdd.push(reflected);
    }
    messagesToAdd.push(newMessage);

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            const newChildren = [...msg.children];
            // remove loading message if it exists
            const loadingIndex = newChildren.findIndex(isLoadingMessage);
            if (loadingIndex !== -1) {
              newChildren.splice(loadingIndex, 1);
            }
            return {
              ...msg,
              children: [...newChildren, ...messagesToAdd],
            };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => [...prevMessages.filter((m) => !isLoadingMessage(m)), ...messagesToAdd]);
    }
  };

  const updateMessage = (messageId: string, chunk: string) => {
    if (processingMessageRef.current && processingMessageRef.current.id === messageId) {
      processingMessageRef.current.content += chunk;
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return {
              ...msg,
              children: msg.children.map((child) => (child.id === messageId ? processingMessageRef.current! : child)),
            };
          } else if (msg.id === messageId) {
            return processingMessageRef.current!;
          }
          return msg;
        }),
      );
    }
  };

  const completeMessage = (messageId: string, usageReport?: ResponseCompletedData['usageReport'], content?: string) => {
    const complete = (message: Message) => {
      if (message.id === messageId && message.type === 'response') {
        const responseMessage = message as ResponseMessage;
        return {
          ...responseMessage,
          content: content || responseMessage.content,
          processing: false,
          usageReport,
        };
      }
      return message;
    };

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return {
              ...msg,
              children: msg.children.map(complete),
            };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => prevMessages.map(complete));
    }
    if (processingMessageRef.current?.id === messageId) {
      processingMessageRef.current = null;
    }
  };

  const addCommandOutput = (command: string, output: string) => {
    const processMessages = (messageList: Message[]) => {
      const lastMessage = messageList[messageList.length - 1];
      if (lastMessage && isCommandOutputMessage(lastMessage) && lastMessage.command === command) {
        const updatedLastMessage: CommandOutputMessage = {
          ...lastMessage,
          content: lastMessage.content + output,
        };
        return messageList.slice(0, -1).concat(updatedLastMessage);
      } else {
        const commandOutputMessage: CommandOutputMessage = {
          id: uuidv4(),
          type: 'command-output',
          command,
          content: output,
        };
        return messageList.filter((m) => !isLoadingMessage(m)).concat(commandOutputMessage);
      }
    };

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return { ...msg, children: processMessages(msg.children) };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => processMessages(prevMessages));
    }
  };

  const addToolMessage = (toolData: ToolMessage) => {
    const createNewToolMessage = () => toolData;

    const processMessages = (messageList: Message[]) => {
      const loadingMessages = messageList.filter(isLoadingMessage);
      const nonLoadingMessages = messageList.filter((message) => !isLoadingMessage(message) && message.id !== toolData.id);
      const toolMessageIndex = messageList.findIndex((message) => message.id === toolData.id);
      const toolMessage = messageList[toolMessageIndex];

      if (toolMessage) {
        const updatedMessages = [...messageList];
        updatedMessages[toolMessageIndex] = {
          ...createNewToolMessage(),
          ...toolMessage,
          content: toolData.content || '',
          usageReport: toolData.usageReport,
        } as ToolMessage;
        return updatedMessages;
      } else {
        return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
      }
    };

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return { ...msg, children: processMessages(msg.children) };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => processMessages(prevMessages));
    }
  };

  const addLogMessage = (log: Omit<LogMessage, 'id' | 'type'>) => {
    const logMessage: LogMessage = { ...log, id: uuidv4(), type: 'log' };
    addMessage(logMessage);
  };

  const addLoadingMessage = (content: string) => {
    const loadingMessage: LoadingMessage = {
      id: uuidv4(),
      type: 'loading',
      content,
    };

    const processMessages = (messageList: Message[]) => {
      const existingLoadingIndex = messageList.findIndex(isLoadingMessage);
      if (existingLoadingIndex !== -1) {
        const updatedMessages = [...messageList];
        updatedMessages[existingLoadingIndex] = {
          ...updatedMessages[existingLoadingIndex],
          content: loadingMessage.content,
        };
        return updatedMessages;
      } else {
        return [...messageList, loadingMessage];
      }
    };

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return { ...msg, children: processMessages(msg.children) };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => processMessages(prevMessages));
    }
  };

  const removeLoadingMessage = () => {
    const processMessages = (messageList: Message[]) => messageList.filter((m) => !isLoadingMessage(m));

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return { ...msg, children: processMessages(msg.children) };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => processMessages(prevMessages));
    }
  };

  const addUserMessage = (userMessage: Omit<UserMessage, 'id' | 'type'>) => {
    const fullUserMessage: UserMessage = { ...userMessage, id: uuidv4(), type: 'user' };
    addMessage(fullUserMessage);
  };

  const startGroup = (id: string, prompt: string, profile: AgentProfile, groupType: GroupType) => {
    const groupMessage: GroupMessage = {
      id,
      type: 'group',
      prompt,
      profile,
      content: '',
      children: [],
      groupType,
    };
    currentGroupIdRef.current = id;
    setMessages((prevMessages) => [...prevMessages, groupMessage]);
  };

  const endGroup = () => {
    currentGroupIdRef.current = null;
  };

  const clearMessages = () => {
    setMessages([]);
    processingMessageRef.current = null;
    currentGroupIdRef.current = null;
  };

  const removeMessageById = (messageId: string) => {
    const processMessages = (messageList: Message[]) => messageList.filter((msg) => msg.id !== messageId);

    if (currentGroupIdRef.current) {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          if (msg.id === currentGroupIdRef.current && msg.children) {
            return { ...msg, children: processMessages(msg.children) };
          }
          return msg;
        }),
      );
    } else {
      setMessages((prevMessages) => processMessages(prevMessages));
    }
  };

  const truncateMessages = (index: number) => {
    setMessages((prevMessages) => prevMessages.slice(0, index));
  };

  const setProcessingMessage = (message: ResponseMessage | null) => {
    processingMessageRef.current = message;
  };

  return {
    messages,
    setMessages,
    addMessage,
    updateMessage,
    completeMessage,
    addCommandOutput,
    addToolMessage,
    addLogMessage,
    addLoadingMessage,
    removeLoadingMessage,
    addUserMessage,
    startGroup,
    endGroup,
    clearMessages,
    removeMessageById,
    setProcessingMessage,
    truncateMessages,
  };
};
