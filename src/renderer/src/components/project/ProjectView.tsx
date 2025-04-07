import {
  AutocompletionData,
  CommandOutputData,
  InputHistoryData,
  LogData,
  Mode,
  ModelsData,
  ProjectData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  TokensInfoData,
  ToolData,
  UserMessageData,
} from '@common/types';
import { useTranslation } from 'react-i18next';
import { IpcRendererEvent } from 'electron';
import { useEffect, useRef, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ResizableBox } from 'react-resizable';
import { v4 as uuidv4 } from 'uuid';

import {
  CommandOutputMessage,
  isCommandOutputMessage,
  isLoadingMessage,
  LoadingMessage,
  LogMessage,
  Message,
  ResponseMessage,
  ToolMessage,
  UserMessage,
} from '@/types/message';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ContextFiles } from '@/components/ContextFiles';
import { Messages } from '@/components/message/Messages';
import { AddFileDialog } from '@/components/project/AddFileDialog';
import { ProjectBar, ProjectTopBarRef } from '@/components/project/ProjectBar';
import { PromptField, PromptFieldRef } from '@/components/PromptField';
import { SessionInfo } from '@/components/SessionInfo';
import 'react-resizable/css/styles.css';

type AddFileDialogOptions = {
  readOnly: boolean;
};

type Props = {
  project: ProjectData;
  isActive?: boolean;
};

export const ProjectView = ({ project, isActive = false }: Props) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const [addFileDialogOptions, setAddFileDialogOptions] = useState<AddFileDialogOptions | null>(null);
  const [autocompletionData, setAutocompletionData] = useState<AutocompletionData | null>(null);
  const [modelsData, setModelsData] = useState<ModelsData | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiderTotalCost, setAiderTotalCost] = useState(0);
  const [lastMessageCost, setLastMessageCost] = useState<undefined | number>(undefined);
  const [agentTotalCost, setAgentTotalCost] = useState(0);
  const [tokensInfo, setTokensInfo] = useState<TokensInfoData | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [mode, setMode] = useState<Mode>('code');
  const [showFrozenDialog, setShowFrozenDialog] = useState(false);
  const processingMessageRef = useRef<ResponseMessage | null>(null);
  const promptFieldRef = useRef<PromptFieldRef>(null);
  const projectTopBarRef = useRef<ProjectTopBarRef>(null);
  const frozenTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('aider-desk-mode');
    setMode(savedMode === 'code' || savedMode === 'agent' ? savedMode : 'code');
  }, []);

  useEffect(() => {
    window.api.startProject(project.baseDir);

    return () => {
      window.api.stopProject(project.baseDir);
    };
  }, [project.baseDir]);

  useEffect(() => {
    if (modelsData) {
      setLoading(false);
    }
  }, [messages, modelsData]);

  useEffect(() => {
    if (!processing && frozenTimeoutRef.current) {
      clearTimeout(frozenTimeoutRef.current);
      frozenTimeoutRef.current = null;
    }
  }, [processing]);

  useEffect(() => {
    const handleResponseChunk = (_: IpcRendererEvent, { messageId, chunk, reflectedMessage }: ResponseChunkData) => {
      const processingMessage = processingMessageRef.current;
      if (!processingMessage || processingMessage.id !== messageId) {
        const newMessages: Message[] = [];

        if (reflectedMessage) {
          newMessages.push({
            id: uuidv4(),
            type: 'reflected-message',
            content: reflectedMessage,
          });
        }

        const newResponseMessage: ResponseMessage = {
          id: messageId,
          type: 'response',
          content: chunk,
          processing: true,
        };
        processingMessageRef.current = newResponseMessage;
        newMessages.push(newResponseMessage);
        setMessages((prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)).concat(...newMessages));
        setProcessing(true);
      } else {
        processingMessage.content += chunk;
        setMessages((prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
      }
    };

    const handleResponseCompleted = (_: IpcRendererEvent, { messageId, usageReport, content }: ResponseCompletedData) => {
      const processingMessage = processingMessageRef.current;

      if (content) {
        setMessages((prevMessages) => {
          // If no processing message exists, find the last response message
          const responseMessage = prevMessages.find((message) => message.id === messageId) as ResponseMessage | undefined;
          if (responseMessage) {
            responseMessage.content = content;
            responseMessage.processing = false;
            responseMessage.usageReport = usageReport;
            return prevMessages.map((message) => (message.id === messageId ? responseMessage : message));
          } else {
            // If no response message exists, create a new one
            const newResponseMessage: ResponseMessage = {
              id: messageId,
              type: 'response',
              content,
              processing: false,
              usageReport,
            };
            return prevMessages.filter((message) => !isLoadingMessage(message)).concat(newResponseMessage);
          }
        });
      } else if (processingMessage && processingMessage.id === messageId) {
        processingMessage.processing = false;
        processingMessage.usageReport = usageReport;
        processingMessage.content = content || processingMessage.content;
        setMessages((prevMessages) => prevMessages.map((message) => (message.id === messageId ? processingMessage : message)));
      } else {
        setMessages((prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
      }

      if (usageReport) {
        setLastMessageCost(usageReport.messageCost);
        if (usageReport.aiderTotalCost !== undefined) {
          setAiderTotalCost(usageReport.aiderTotalCost);
        }
        if (usageReport.mcpAgentTotalCost !== undefined) {
          setAgentTotalCost(usageReport.mcpAgentTotalCost);
        }
      }

      setProcessing(false);
    };

    const handleCommandOutput = (_: IpcRendererEvent, { command, output }: CommandOutputData) => {
      setMessages((prevMessages) => {
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
          return prevMessages.filter((message) => !isLoadingMessage(message)).concat(commandOutputMessage);
        }
      });
    };

    const handleTool = (_: IpcRendererEvent, { id, serverName, toolName, args, response, usageReport }: ToolData) => {
      const createNewToolMessage = () => {
        const toolMessage: ToolMessage = {
          id,
          type: 'tool',
          serverName,
          toolName,
          args: args || {},
          content: response || '',
        };
        return toolMessage;
      };

      setMessages((prevMessages) => {
        const loadingMessages = prevMessages.filter(isLoadingMessage);
        const nonLoadingMessages = prevMessages.filter((message) => !isLoadingMessage(message) && message.id !== id);
        const toolMessageIndex = prevMessages.findIndex((message) => message.id === id);
        const toolMessage = prevMessages[toolMessageIndex];

        if (toolMessage) {
          const updatedMessages = [...prevMessages];
          updatedMessages[toolMessageIndex] = {
            ...createNewToolMessage(),
            ...toolMessage,
            content: response || '',
          };
          return updatedMessages;
        } else {
          return [...nonLoadingMessages, createNewToolMessage(), ...loadingMessages];
        }
      });

      if (usageReport?.aiderTotalCost !== undefined) {
        setAiderTotalCost(usageReport.aiderTotalCost);
      }
      if (usageReport?.mcpAgentTotalCost !== undefined) {
        setAgentTotalCost(usageReport.mcpAgentTotalCost);
      }
    };

    const handleLog = (_: IpcRendererEvent, { level, message }: LogData) => {
      if (level === 'loading') {
        const loadingMessage: LoadingMessage = {
          id: uuidv4(),
          type: 'loading',
          content: message || t('messages.thinking'),
        };
        setMessages((prevMessages) => {
          const existingLoadingIndex = prevMessages.findIndex(isLoadingMessage);
          if (existingLoadingIndex !== -1) {
            // Update existing loading message
            const updatedMessages = [...prevMessages];
            updatedMessages[existingLoadingIndex] = {
              ...updatedMessages[existingLoadingIndex],
              content: loadingMessage.content,
            };

            return updatedMessages;
          } else {
            // Add new loading message
            return [...prevMessages, loadingMessage];
          }
        });
        setProcessing(true);
      } else {
        const logMessage: LogMessage = {
          id: uuidv4(),
          type: 'log',
          level,
          content: message || '',
        };
        setMessages((prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), logMessage]);
      }
    };

    const handleUpdateAutocompletion = (_: IpcRendererEvent, data: AutocompletionData) => {
      setAutocompletionData(data);
    };

    const handleSetCurrentModels = (_: IpcRendererEvent, data: ModelsData) => {
      setModelsData(data);

      if (data.error) {
        const errorMessage: LogMessage = {
          id: uuidv4(),
          type: 'log',
          level: 'error',
          content: data.error,
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      }
    };

    const handleTokensInfo = (_: IpcRendererEvent, data: TokensInfoData) => {
      setTokensInfo(data);
    };

    const handleQuestion = (_: IpcRendererEvent, data: QuestionData) => {
      setQuestion(data);
    };

    const handleInputHistoryUpdate = (_: IpcRendererEvent, data: InputHistoryData) => {
      setInputHistory(data.messages);
    };

    const handleUserMessage = (_: IpcRendererEvent, data: UserMessageData) => {
      const userMessage: UserMessage = {
        id: uuidv4(),
        type: 'user',
        mode: data.mode || 'code',
        content: data.content,
      };

      setMessages((prevMessages) => {
        const loadingMessages = prevMessages.filter(isLoadingMessage);
        const nonLoadingMessages = prevMessages.filter((message) => !isLoadingMessage(message));
        return [...nonLoadingMessages, userMessage, ...loadingMessages];
      });
    };

    const handleClearMessages = () => {
      clearMessages(false);
    };

    const autocompletionListenerId = window.api.addUpdateAutocompletionListener(project.baseDir, handleUpdateAutocompletion);
    const currentModelsListenerId = window.api.addSetCurrentModelsListener(project.baseDir, handleSetCurrentModels);
    const commandOutputListenerId = window.api.addCommandOutputListener(project.baseDir, handleCommandOutput);
    const responseChunkListenerId = window.api.addResponseChunkListener(project.baseDir, handleResponseChunk);
    const responseCompletedListenerId = window.api.addResponseCompletedListener(project.baseDir, handleResponseCompleted);
    const logListenerId = window.api.addLogListener(project.baseDir, handleLog);
    const tokensInfoListenerId = window.api.addTokensInfoListener(project.baseDir, handleTokensInfo);
    const questionListenerId = window.api.addAskQuestionListener(project.baseDir, handleQuestion);
    const toolListenerId = window.api.addToolListener(project.baseDir, handleTool);
    const inputHistoryListenerId = window.api.addInputHistoryUpdatedListener(project.baseDir, handleInputHistoryUpdate);
    const userMessageListenerId = window.api.addUserMessageListener(project.baseDir, handleUserMessage);
    const clearMessagesListenerId = window.api.addClearMessagesListener(project.baseDir, handleClearMessages);

    return () => {
      window.api.removeUpdateAutocompletionListener(autocompletionListenerId);
      window.api.removeSetCurrentModelsListener(currentModelsListenerId);
      window.api.removeCommandOutputListener(commandOutputListenerId);
      window.api.removeResponseChunkListener(responseChunkListenerId);
      window.api.removeResponseCompletedListener(responseCompletedListenerId);
      window.api.removeLogListener(logListenerId);
      window.api.removeTokensInfoListener(tokensInfoListenerId);
      window.api.removeAskQuestionListener(questionListenerId);
      window.api.removeToolListener(toolListenerId);
      window.api.removeInputHistoryUpdatedListener(inputHistoryListenerId);
      window.api.removeUserMessageListener(userMessageListenerId);
      window.api.removeClearMessagesListener(clearMessagesListenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.baseDir]);

  const handleAddFile = (filePath: string, readOnly = false) => {
    window.api.addFile(project.baseDir, filePath, readOnly);
    setAddFileDialogOptions(null);
    promptFieldRef.current?.focus();
  };

  const onSubmitted = () => {
    if (question) {
      if (question.answerFunction) {
        question.answerFunction('n');
      }
      setQuestion(null);
    }
  };

  const showFileDialog = (readOnly: boolean) => {
    setAddFileDialogOptions({
      readOnly,
    });
  };

  const clearMessages = (clearContext = true) => {
    const lastModelsMessage = messages.filter((message) => message.type === 'models').pop();
    setMessages(lastModelsMessage ? [lastModelsMessage] : []);
    setProcessing(false);
    processingMessageRef.current = null;

    if (clearContext) {
      window.api.clearContext(project.baseDir);
    }
  };

  const runCommand = (command: string) => {
    window.api.runCommand(project.baseDir, command);
  };

  const runTests = (testCmd?: string) => {
    runCommand(`test ${testCmd || ''}`);
  };

  const answerQuestion = (answer: string) => {
    if (question) {
      if (question.answerFunction) {
        question.answerFunction(answer);
      } else {
        window.api.answerQuestion(project.baseDir, answer);
      }
      setQuestion(null);
    }
  };

  const scrapeWeb = async (url: string) => {
    setProcessing(true);
    const loadingMessage: LoadingMessage = {
      id: uuidv4(),
      type: 'loading',
      content: `Scraping ${url}...`,
    };
    setMessages((prevMessages) => [...prevMessages, loadingMessage]);

    try {
      await window.api.scrapeWeb(project.baseDir, url);
      const infoMessage: LogMessage = {
        id: uuidv4(),
        level: 'info',
        type: 'log',
        content: `Content from ${url} has been added to the chat.`,
      };
      setMessages((prevMessages) => [...prevMessages, infoMessage]);
    } catch (error) {
      if (error instanceof Error) {
        const getMessage = () => {
          if (error.message.includes('Cannot navigate to invalid URL')) {
            return `Invalid URL: ${url}`;
          } else if (error.message.includes('npx playwright install')) {
            return 'Playwright is not installed. Run `npx playwright install` in the terminal to install it and try again.';
          } else {
            return `Error during scraping: ${error.message}`;
          }
        };

        const errorMessage: LogMessage = {
          id: uuidv4(),
          level: 'error',
          type: 'log',
          content: getMessage(),
        };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      }
    } finally {
      setMessages((prevMessages) => prevMessages.filter((message) => message !== loadingMessage));
      setProcessing(false);
    }
  };

  const handleInterruptResponse = () => {
    window.api.interruptResponse(project.baseDir);
    const interruptMessage: LogMessage = {
      id: uuidv4(),
      type: 'log',
      level: 'warning',
      content: t('messages.interrupted'),
    };
    setMessages((prevMessages) => [...prevMessages.filter((message) => !isLoadingMessage(message)), interruptMessage]);

    if (!frozenTimeoutRef.current) {
      frozenTimeoutRef.current = setTimeout(() => {
        if (processing) {
          setShowFrozenDialog(true);
        }
        frozenTimeoutRef.current = null;
      }, 10000);
    }
  };

  const handleModelChange = () => {
    promptFieldRef.current?.focus();
    setModelsData(null);
  };

  const handleModeChange = (mode: Mode) => {
    setMode(mode);
    if (mode === 'code' || mode === 'agent') {
      localStorage.setItem('aider-desk-mode', mode);
    }
  };

  const restartProject = () => {
    setShowFrozenDialog(false);
    setLoading(true);
    setMessages([]);
    setLastMessageCost(0);
    setAiderTotalCost(0);
    setAgentTotalCost(0);
    setProcessing(false);
    setTokensInfo(null);
    setQuestion(null);
    setModelsData(null);
    processingMessageRef.current = null;
    void window.api.restartProject(project.baseDir);
  };

  return (
    <div className="flex h-full bg-gradient-to-b from-neutral-950 to-neutral-900 relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-950 to-neutral-900 z-10">
          <CgSpinner className="animate-spin w-10 h-10" />
          <div className="mt-2 text-sm text-center text-white">{t('common.startingUp')}</div>
        </div>
      )}
      <div className="flex flex-col flex-grow overflow-hidden">
        <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900">
          <ProjectBar
            ref={projectTopBarRef}
            baseDir={project.baseDir}
            modelsData={modelsData}
            allModels={autocompletionData?.models}
            architectMode={mode === 'architect'}
            onModelChange={handleModelChange}
          />
        </div>
        <div className="flex-grow overflow-y-auto">
          <Messages baseDir={project.baseDir} messages={messages} allFiles={autocompletionData?.allFiles} />
        </div>
        <div className="relative bottom-0 w-full p-4 pb-2 flex-shrink-0 flex border-t border-neutral-800">
          <PromptField
            ref={promptFieldRef}
            baseDir={project.baseDir}
            inputHistory={inputHistory}
            processing={processing}
            mode={mode}
            onModeChanged={handleModeChange}
            isActive={isActive}
            words={autocompletionData?.words}
            clearMessages={clearMessages}
            scrapeWeb={scrapeWeb}
            showFileDialog={showFileDialog}
            question={question}
            answerQuestion={answerQuestion}
            interruptResponse={handleInterruptResponse}
            runCommand={runCommand}
            runTests={runTests}
            openModelSelector={() => projectTopBarRef.current?.openMainModelSelector()}
            disabled={!modelsData}
            onSubmitted={onSubmitted}
          />
        </div>
      </div>
      <ResizableBox
        width={300}
        height={Infinity}
        minConstraints={[100, Infinity]}
        maxConstraints={[window.innerWidth - 300, Infinity]}
        axis="x"
        resizeHandles={['w']}
        className="border-l border-neutral-800 flex flex-col flex-shrink-0"
      >
        <div className="flex flex-col h-full">
          <div className="flex-grow flex flex-col overflow-y-hidden">
            <ContextFiles
              baseDir={project.baseDir}
              showFileDialog={() =>
                setAddFileDialogOptions({
                  readOnly: false,
                })
              }
            />
          </div>
          <SessionInfo
            tokensInfo={tokensInfo}
            aiderTotalCost={aiderTotalCost}
            lastMessageCost={lastMessageCost}
            agentTotalCost={agentTotalCost}
            clearMessages={clearMessages}
            refreshRepoMap={() => runCommand('map-refresh')}
            restartProject={restartProject}
          />
        </div>
      </ResizableBox>
      {showFrozenDialog && (
        <ConfirmDialog
          title={t('errors.frozenTitle')}
          onConfirm={restartProject}
          onCancel={() => setShowFrozenDialog(false)}
          confirmButtonText="Restart"
          cancelButtonText="Wait"
          closeOnEscape={false}
        >
          {t('errors.frozenMessage')}
        </ConfirmDialog>
      )}
      {addFileDialogOptions && (
        <AddFileDialog
          baseDir={project.baseDir}
          onClose={() => {
            setAddFileDialogOptions(null);
            promptFieldRef.current?.focus();
          }}
          onAddFile={handleAddFile}
          initialReadOnly={addFileDialogOptions.readOnly}
        />
      )}
    </div>
  );
};
