import {
  acceptCompletion,
  autocompletion,
  CompletionContext,
  type CompletionResult,
  currentCompletions,
  moveCompletionSelection,
  startCompletion,
} from '@codemirror/autocomplete';
import { EditorView, keymap } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';
import { AIDER_MODES, Mode, PromptBehavior, QueuedPromptData, QuestionData, SuggestionMode, TaskData } from '@common/types';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import CodeMirror, { Annotation, Prec, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useDebounce } from '@reactuses/core';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { BiSend } from 'react-icons/bi';
import { FaInfoCircle } from 'react-icons/fa';
import { MdPlaylistRemove, MdSave, MdStop, MdMic, MdMicOff, MdOutlineScheduleSend } from 'react-icons/md';
import { VscTerminal } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { usePromptFieldText } from './usePromptFieldText';

import { AgentSelector } from '@/components/AgentSelector';
import { InputHistoryMenu } from '@/components/PromptField/InputHistoryMenu';
import { ModeSelector } from '@/components/PromptField/ModeSelector';
import { showErrorNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';
import { useCommands } from '@/hooks/useCommands';
import { useApi } from '@/contexts/ApiContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { AudioAnalyzer } from '@/components/PromptField/AudioAnalyzer';
import { AutoApprove } from '@/components/PromptField/AutoApprove';
import { useResponsive } from '@/hooks/useResponsive';

const External = Annotation.define<boolean>();

const COMMANDS = [
  '/code',
  '/context',
  '/agent',
  '/ask',
  '/architect',
  '/add',
  '/model',
  '/read-only',
  '/clear',
  '/web',
  '/task-info',
  '/undo',
  '/test',
  '/map-refresh',
  '/map',
  '/run',
  '/reasoning-effort',
  '/think-tokens',
  '/copy-context',
  '/tokens',
  '/reset',
  '/drop',
  '/redo',
  '/edit-last',
  '/compact',
  '/commit',
  '/handoff',
  '/init',
  '/clear-logs',
  '/resolve-conflicts',
];

const ANSWERS = ['y', 'n', 'a', 'd', 'maybe']; // Added 'maybe' (Branch B)

const HISTORY_MENU_CHUNK_SIZE = 20;
const PLACEHOLDER_COUNT = 20;

const isPathLike = (input: string): boolean => {
  const firstWord = input.split(' ')[0];
  return (firstWord.match(/\//g) || []).length >= 2;
};

const theme = githubDarkInit({
  settings: {
    fontFamily: 'var(--font-family)',
    background: 'transparent',
    selection: 'var(--color-bg-selection)',
    caret: 'var(--color-text-muted)',
  },
});

export interface PromptFieldRef {
  focus: () => void;
  setText: (text: string) => void;
  appendText: (text: string) => void;
}

type Props = {
  baseDir: string;
  taskId: string;
  task: TaskData;
  processing: boolean;
  isActive: boolean;
  allFiles?: string[];
  words?: string[];
  inputHistory?: string[];
  openModelSelector?: (model?: string) => void;
  openAgentModelSelector?: (model?: string) => void;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
  runPrompt: (prompt: string) => void;
  savePrompt: (prompt: string) => Promise<void>;
  showFileDialog: (readOnly: boolean) => void;
  addFiles?: (filePaths: string[], readOnly?: boolean) => void;
  clearMessages: () => void;
  scrapeWeb: (url: string, filePath?: string) => void;
  question?: QuestionData | null;
  answerQuestion: (answer: string) => void;
  queuedPrompts?: QueuedPromptData[];
  removeQueuedPrompt?: (id: string) => void;
  sendQueuedPromptNow?: (id: string) => void;
  interruptResponse: () => void;
  runCommand: (command: string) => void;
  runTests: (testCmd?: string) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: () => void;
  disabled?: boolean;
  promptBehavior: PromptBehavior;
  clearLogMessages: () => void;
  toggleTerminal?: () => void;
  terminalVisible?: boolean;
  scrollToBottom?: () => void;
  onAutoApproveChanged?: (autoApprove: boolean) => void;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
  showTaskInfo?: () => void;
  handoffConversation?: (focus?: string) => Promise<void>;
};

export const PromptField = forwardRef<PromptFieldRef, Props>(
  (
    {
      baseDir,
      taskId,
      task,
      processing = false,
      isActive = false,
      allFiles = [],
      words = [],
      inputHistory = [],
      mode,
      onModeChanged,
      showFileDialog,
      runPrompt,
      savePrompt,
      addFiles,
      clearMessages,
      scrapeWeb,
      question,
      answerQuestion,
      queuedPrompts = [],
      removeQueuedPrompt,
      sendQueuedPromptNow,
      interruptResponse,
      runCommand,
      runTests,
      redoLastUserPrompt,
      editLastUserMessage,
      openModelSelector,
      openAgentModelSelector,
      disabled = false,
      promptBehavior,
      clearLogMessages,
      toggleTerminal,
      terminalVisible = false,
      scrollToBottom,
      onAutoApproveChanged,
      showSettingsPage,
      showTaskInfo,
      handoffConversation,
    }: Props,
    ref,
  ) => {
    const { t } = useTranslation();
    const { isMobile } = useResponsive();
    const [text, setText] = useState('');
    const debouncedText = useDebounce(text, 100);
    const { setText: setSavedText } = usePromptFieldText(baseDir, taskId, (text) => {
      const view = editorRef.current?.view;
      view?.dispatch({
        changes: { from: 0, to: view.state.doc.toString().length, insert: text },
        annotations: [External.of(true)],
      });
      setText(text);
    });
    const [placeholderIndex, setPlaceholderIndex] = useState(1);
    const [historyMenuVisible, setHistoryMenuVisible] = useState(false);
    const [highlightedHistoryItemIndex, setHighlightedHistoryItemIndex] = useState(0);
    const [historyLimit, setHistoryLimit] = useState(HISTORY_MENU_CHUNK_SIZE);
    const [keepHistoryHighlightTop, setKeepHistoryHighlightTop] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [pendingCommand, setPendingCommand] = useState<{
      command: string;
      args?: string;
    } | null>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const [customCommands, extensionCommands] = useCommands(baseDir);
    const api = useApi();
    const { projectSettings, saveProjectSettings } = useProjectSettings();

    const {
      isRecording,
      isProcessing,
      startRecording,
      stopRecording,
      transcription,
      error: voiceError,
      resetTranscription,
      voiceAvailable,
      mediaStream,
    } = useAudioRecorder();
    const [textBeforeRecording, setTextBeforeRecording] = useState('');

    const setTextWithDispatch = useCallback(
      (newText: string) => {
        const view = editorRef.current?.view;
        view?.dispatch({
          changes: { from: 0, to: view.state.doc.toString().length, insert: newText },
          annotations: [External.of(true)],
        });
        setText(newText);
        setSavedText(newText);
      },
      [setText, setSavedText],
    );

    useEffect(() => {
      if (voiceError) {
        showErrorNotification(voiceError, false);
      }
    }, [voiceError]);

    useEffect(() => {
      if (isRecording) {
        setTextBeforeRecording(text);
      } else if (transcription) {
        // When recording stops, we reset after a short delay or immediately?
        // We want to keep the text.
        // We just need to reset the recorder state for next time.
        resetTranscription();
        setTextBeforeRecording('');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRecording]);

    useEffect(() => {
      if ((isRecording || isProcessing) && transcription) {
        const separator = textBeforeRecording && !textBeforeRecording.endsWith(' ') ? ' ' : '';
        setTextWithDispatch(textBeforeRecording + separator + transcription);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcription, isRecording, isProcessing, textBeforeRecording]);

    const completionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/\S*/);
      const { state } = context;
      const text = state.doc.toString();

      // Check if we're at a command argument position with options (before early return)
      if (text.startsWith('/') && text.includes(' ')) {
        const [command, ...args] = text.split(' ');
        const allCommands = [...customCommands, ...extensionCommands];
        const cmd = allCommands.find((c) => `/${c.name}` === command);
        const argIndex = args.length - 1;
        if (cmd?.arguments?.[argIndex]?.options) {
          const currentArg = args[argIndex];
          return {
            from: state.doc.length - currentArg.length,
            options: cmd.arguments[argIndex].options.map((opt) => ({
              label: opt,
              type: 'constant',
            })),
            validFor: /^\S*$/,
          };
        }
      }

      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      if (promptBehavior.suggestionMode === SuggestionMode.MentionAtSign && !text.startsWith('/') && !text.includes('@')) {
        return null;
      }

      if (promptBehavior.suggestionMode === SuggestionMode.MentionAtSign) {
        // Handle @-based file suggestions (exclusive)
        const atPos = text.lastIndexOf('@');
        if (atPos >= 0 && (atPos === 0 || /\s/.test(text[atPos - 1]))) {
          return {
            from: atPos + 1,
            options: allFiles.map((file) => ({ label: file, type: 'file' })),
            validFor: /^\S*$/,
          };
        }
      }

      // Handle command suggestions
      if (text.startsWith('/')) {
        if (text.includes(' ')) {
          const [command, ...args] = text.split(' ');
          const currentArg = args[args.length - 1];
          if (command === '/add' || command === '/read-only') {
            const files = await api.getAddableFiles(baseDir, taskId);
            return {
              from: state.doc.length - currentArg.length,
              options: files.map((file) => ({ label: file, type: 'file' })),
              validFor: /^\S*$/,
            };
          }
        } else {
          // Add custom and extension commands to the list
          const allCommands = [...customCommands, ...extensionCommands];
          const customCmds = allCommands.map((cmd) => `/${cmd.name}`);
          return {
            from: 0,
            options: [...COMMANDS, ...customCmds].map((cmd) => ({
              label: cmd,
              type: 'keyword',
            })),
            validFor: /^\/\w*$/,
          };
        }
      }

      return {
        from: word.from,
        options: [...words, ...allFiles].map((w) => ({ label: w, type: 'text' })),
      };
    };

    const allHistoryItems =
      historyMenuVisible && debouncedText.trim().length > 0
        ? inputHistory.filter((item) => item.toLowerCase().includes(debouncedText.trim().toLowerCase()))
        : inputHistory;

    const historyItems = allHistoryItems.slice(0, historyLimit);

    const loadMoreHistory = useCallback(() => {
      if (historyLimit < allHistoryItems.length) {
        const additional = Math.min(HISTORY_MENU_CHUNK_SIZE, allHistoryItems.length - historyLimit);
        setHistoryLimit((prev) => prev + additional);
        setHighlightedHistoryItemIndex((prev) => prev + 1);
        setKeepHistoryHighlightTop(true);
      }
    }, [historyLimit, allHistoryItems.length]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        editorRef.current?.view?.focus();
      },
      setText: (newText: string) => {
        setTextWithDispatch(newText);
        // Ensure cursor is at the end after setting text
        setTimeout(() => {
          const view = editorRef.current?.view;
          if (view) {
            const end = view.state.doc.length;
            view.dispatch({
              selection: { anchor: end, head: end },
            });
            view.focus();
          }
        }, 0);
      },
      appendText: (textToAppend: string) => {
        const currentText = text;
        const newText = currentText ? `${currentText}\n${textToAppend}` : textToAppend;
        setTextWithDispatch(newText);
        // Ensure cursor is at the end after appending text
        setTimeout(() => {
          if (editorRef.current?.view) {
            const end = editorRef.current.view.state.doc.length;
            editorRef.current.view.dispatch({
              selection: { anchor: end, head: end },
            });
            editorRef.current.view.focus();
          }
        }, 0);
      },
    }));

    const handleAutoApproveLockChanged = useCallback(
      (locked: boolean) => {
        void saveProjectSettings({
          autoApproveLocked: locked,
        });
      },
      [saveProjectSettings],
    );

    const prepareForNextPrompt = useCallback(() => {
      setTextWithDispatch('');
      setPendingCommand(null);
    }, [setTextWithDispatch]);

    const executeCommand = useCallback(
      (command: string, args?: string): void => {
        switch (command) {
          case '/agent':
          case '/code':
          case '/context':
          case '/ask':
          case '/architect': {
            const newMode = command.slice(1) as Mode;
            onModeChanged(newMode);
            setTextWithDispatch(args || '');
            break;
          }
          case '/add':
            prepareForNextPrompt();
            if (args && addFiles) {
              addFiles(args.split(' '), false);
            } else {
              showFileDialog(false);
            }
            break;
          case '/read-only':
            prepareForNextPrompt();
            if (args && addFiles) {
              addFiles(args.split(' '), true);
            } else {
              showFileDialog(true);
            }
            break;
          case '/model':
            prepareForNextPrompt();
            if (!AIDER_MODES.includes(mode)) {
              openAgentModelSelector?.(args);
            } else {
              openModelSelector?.(args);
            }
            break;
          case '/task-info': {
            prepareForNextPrompt();
            showTaskInfo?.();
            break;
          }
          case '/web': {
            const commandArgs = text.replace('/web', '').trim();
            const firstSpaceIndex = commandArgs.indexOf(' ');
            let url: string;
            let filePath: string | undefined;

            if (firstSpaceIndex === -1) {
              url = commandArgs; // Only URL provided
            } else {
              url = commandArgs.substring(0, firstSpaceIndex);
              filePath = commandArgs.substring(firstSpaceIndex + 1).trim();
              if (filePath === '') {
                filePath = undefined; // If only spaces after URL, treat as no filePath
              }
            }
            prepareForNextPrompt();
            scrapeWeb(url, filePath);
            break;
          }
          case '/clear':
            prepareForNextPrompt();
            clearMessages();
            break;
          case '/redo':
            prepareForNextPrompt();
            redoLastUserPrompt();
            break;
          case '/edit-last':
            prepareForNextPrompt();
            editLastUserMessage();
            break;
          case '/compact':
            prepareForNextPrompt();
            api.compactConversation(baseDir, taskId, mode, args);
            break;
          case '/handoff': {
            const focus = args || '';
            if (handoffConversation) {
              handoffConversation(focus);
            }
            prepareForNextPrompt();
            break;
          }
          case '/test': {
            runTests(args);
            break;
          }
          case '/init': {
            if (AIDER_MODES.includes(mode)) {
              showErrorNotification(t('promptField.agentModeOnly'));
              return;
            }
            prepareForNextPrompt();
            void api.initProjectRulesFile(baseDir, taskId);
            break;
          }
          case '/clear-logs': {
            prepareForNextPrompt();
            clearLogMessages();
            break;
          }
          case '/resolve-conflicts': {
            prepareForNextPrompt();
            void api.resolveConflictsWithAgent(baseDir, taskId);
            break;
          }
          default: {
            setTextWithDispatch('');
            runCommand(`${command.slice(1)} ${args || ''}`);
            break;
          }
        }
      },
      [
        prepareForNextPrompt,
        addFiles,
        mode,
        clearMessages,
        redoLastUserPrompt,
        editLastUserMessage,
        api,
        baseDir,
        taskId,
        onModeChanged,
        showFileDialog,
        openAgentModelSelector,
        openModelSelector,
        text,
        scrapeWeb,
        runTests,
        t,
        clearLogMessages,
        runCommand,
        showTaskInfo,
        setTextWithDispatch,
        handoffConversation,
      ],
    );

    const invokeCommand = useCallback(
      (command: string, args?: string): void => {
        const requiresConfirmation = (command: string): boolean => {
          switch (command) {
            case '/add':
              return promptBehavior.requireCommandConfirmation.add;
            case '/read-only':
              return promptBehavior.requireCommandConfirmation.readOnly;
            case '/model':
              return promptBehavior.requireCommandConfirmation.model;
            case '/code':
            case '/context':
            case '/ask':
            case '/architect':
            case '/agent':
              return promptBehavior.requireCommandConfirmation.modeSwitching;
            default:
              return true;
          }
        };

        if (requiresConfirmation(command)) {
          setPendingCommand({ command, args });
        } else {
          executeCommand(command, args);
        }
      },
      [executeCommand, promptBehavior],
    );

    const handleConfirmCommand = () => {
      if (pendingCommand) {
        executeCommand(pendingCommand.command, pendingCommand.args);
        setPendingCommand(null);
      }
    };

    useEffect(() => {
      if (question) {
        setSelectedAnswer(question.defaultAnswer || 'y');
      }
    }, [question]);

    useEffect(() => {
      setHighlightedHistoryItemIndex(0);
    }, [debouncedText]);

    useEffect(() => {
      if (!disabled && isActive && editorRef.current) {
        editorRef.current.view?.focus();
      }
    }, [isActive, disabled]);

    useEffect(() => {
      const commandMatch = COMMANDS.find((cmd) => {
        if (text === cmd) {
          return true;
        }

        return text.startsWith(`${cmd} `);
      });
      if (commandMatch) {
        invokeCommand(commandMatch, text.split(' ').slice(1).join(' '));
      }
    }, [text, invokeCommand]);

    useEffect(() => {
      setHistoryLimit(Math.min(HISTORY_MENU_CHUNK_SIZE, allHistoryItems.length));
    }, [allHistoryItems.length]);

    useEffect(() => {
      if (keepHistoryHighlightTop) {
        setKeepHistoryHighlightTop(false);
      }
    }, [historyLimit, keepHistoryHighlightTop]);

    const onChange = (newText: string) => {
      setText(newText);
      setSavedText(newText);
      setPendingCommand(null);

      if (question) {
        if (question?.answers) {
          const matchedAnswer = question.answers.find((answer) => answer.shortkey.toLowerCase() === newText.toLowerCase());
          if (matchedAnswer) {
            setSelectedAnswer(matchedAnswer.shortkey);
            return;
          } else {
            setSelectedAnswer(null);
          }
        } else if (ANSWERS.includes(newText.toLowerCase())) {
          setSelectedAnswer(newText);
          return;
        } else {
          setSelectedAnswer(null);
        }
      }
    };

    const handleSubmit = () => {
      scrollToBottom?.();
      stopRecording();
      if (text) {
        if (text.startsWith('/') && !isPathLike(text)) {
          // Check if it's a custom or extension command
          const [cmd, ...args] = text.slice(1).split(' ');
          const allCommands = [...customCommands, ...extensionCommands];
          const command = allCommands.find((command) => command.name === cmd);

          if (command) {
            api.runCustomCommand(baseDir, taskId, cmd, args, mode);
            prepareForNextPrompt();
            setPlaceholderIndex(Math.floor(Math.random() * PLACEHOLDER_COUNT));
            return;
          }

          if (!COMMANDS.includes(`/${cmd}`)) {
            showErrorNotification(t('promptField.invalidCommand'));
            return;
          }
        }

        if (pendingCommand) {
          prepareForNextPrompt();
          handleConfirmCommand();
        } else {
          runPrompt(text);
          prepareForNextPrompt();
        }
        setPlaceholderIndex(Math.floor(Math.random() * PLACEHOLDER_COUNT));
      }
    };

    const handleSavePrompt = async () => {
      if (text) {
        try {
          await savePrompt(text);
          prepareForNextPrompt();
          setPlaceholderIndex(Math.floor(Math.random() * PLACEHOLDER_COUNT));
        } catch (error) {
          showErrorNotification(t('promptField.saveError', { error: error instanceof Error ? error.message : String(error) }));
        }
      }
    };

    const getAutocompleteDetailLabel = (item: string): [string | null, boolean] => {
      if (item.startsWith('/')) {
        // Check if it's a custom or extension command
        const commandName = item.slice(1);
        const allCommands = [...customCommands, ...extensionCommands];
        const command = allCommands.find((cmd) => cmd.name === commandName);
        if (command) {
          return [command.description, false];
        }

        if (item === '/init' && !!AIDER_MODES.includes(mode)) {
          return [t('commands.agentModeOnly'), true];
        }

        return [t(`commands.${item.slice(1)}`), false];
      }

      return [null, false];
    };

    const toggleVoice = () => {
      if (voiceAvailable && !disabled && !processing) {
        if (isRecording) {
          void stopRecording();
        } else {
          void startRecording();
        }

        return true;
      }
      return false;
    };

    useHotkeys(
      'alt+v',
      (e) => {
        e.preventDefault();
        toggleVoice();
      },
      {
        enableOnFormTags: true,
        enabled: voiceAvailable && !disabled && !processing,
      },
    );

    const keymapExtension = keymap.of([
      {
        key: 'Alt-v',
        preventDefault: true,
        run: toggleVoice,
      },
      {
        key: 'Shift-Enter',
        preventDefault: true,
        run: (view) => {
          // On desktop, Shift+Enter inserts a new line
          const cursorPos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: cursorPos, insert: '\n' },
            selection: { anchor: cursorPos + 1 },
          });
          return true;
        },
      },
      {
        key: 'Enter',
        run: (view) => {
          // On mobile, Enter inserts a new line (default behavior)
          // On desktop, Enter submits the prompt
          if (isMobile) {
            return false; // Allow default behavior (new line)
          }

          // Desktop behavior: submit or handle special cases
          if (question && selectedAnswer) {
            const answers = question.answers?.map((answer) => answer.shortkey.toLowerCase()) || ANSWERS;
            if (answers.includes(selectedAnswer.toLowerCase())) {
              answerQuestion(selectedAnswer);
              prepareForNextPrompt();
              return true;
            }
          } else if (historyMenuVisible) {
            setHistoryMenuVisible(false);
            const newText = historyItems[historyItems.length - 1 - highlightedHistoryItemIndex];
            view.dispatch({
              changes: {
                from: 0,
                to: view.state.doc.length,
                insert: newText,
              },
              selection: {
                anchor: newText.length,
              },
            });
          } else {
            handleSubmit();
          }
          return true;
        },
      },
      {
        key: 'Space',
        run: acceptCompletion,
      },
      {
        key: 'Escape',
        run: () => {
          if (historyMenuVisible) {
            setHistoryMenuVisible(false);
            setHighlightedHistoryItemIndex(-1);
            return true;
          } else if (processing) {
            interruptResponse();
            return true;
          }
          return false;
        },
      },
      {
        key: 'Ctrl-c',
        run: () => {
          if (processing) {
            interruptResponse();
            return true;
          }
          return false;
        },
      },
      {
        key: 'Tab',
        preventDefault: true,
        run: (view) => {
          if (question && selectedAnswer) {
            const answers = question.answers?.map((answer) => answer.shortkey.toLowerCase()) || ANSWERS;
            const currentIndex = answers.indexOf(selectedAnswer.toLowerCase());
            if (currentIndex !== -1) {
              const nextIndex = (currentIndex + 1 + ANSWERS.length) % ANSWERS.length;
              setSelectedAnswer(answers[nextIndex]);
              return true;
            }
          }

          const state = view.state;
          const completions = currentCompletions(state);

          if (!completions.length) {
            return false;
          }
          if (completions.length === 1) {
            moveCompletionSelection(true)(view);
            return acceptCompletion(view);
          }

          return moveCompletionSelection(true)(view);
        },
      },
      {
        key: 'Tab',
        preventDefault: true,
        run: startCompletion,
      },
      {
        key: '/',
        preventDefault: true,
        run: (view) => {
          const cursorPos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: cursorPos, insert: '/' },
            selection: { anchor: cursorPos + 1 },
          });
          if (cursorPos === 0) {
            startCompletion(view);
          }
          return true;
        },
      },
      {
        key: '@',
        preventDefault: true,
        run: (view) => {
          const cursorPos = view.state.selection.main.head;
          const textBeforeCursor = view.state.doc.sliceString(0, cursorPos);

          view.dispatch({
            changes: { from: cursorPos, insert: '@' },
            selection: { anchor: cursorPos + 1 },
          });

          if (!/\S$/.test(textBeforeCursor) && promptBehavior.suggestionMode === SuggestionMode.MentionAtSign) {
            startCompletion(view);
          }
          return true;
        },
      },

      {
        key: 'ArrowUp',
        run: () => {
          if (historyItems.length > 0) {
            if (historyMenuVisible) {
              if (highlightedHistoryItemIndex === historyItems.length - 1) {
                loadMoreHistory();
              } else {
                setHighlightedHistoryItemIndex((prev) => Math.min(prev + 1, historyItems.length - 1));
              }
              return true;
            } else if (!text) {
              setHistoryLimit(HISTORY_MENU_CHUNK_SIZE);
              setHistoryMenuVisible(true);
              setHighlightedHistoryItemIndex(0);
              return true;
            }
          }
          return false;
        },
      },
      {
        key: 'ArrowDown',
        run: () => {
          if (historyMenuVisible) {
            setHighlightedHistoryItemIndex((prev) => Math.max(prev - 1, 0));
            return true;
          }
          return false;
        },
      },
    ]);

    return (
      <div className="w-full relative">
        {queuedPrompts && queuedPrompts.length > 0 && (
          <div className="mb-2 p-3 bg-bg-primary-light from-bg-primary to-bg-primary-light rounded-md border border-border-default-dark text-sm max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded">
            <div className="text-text-primary text-xs mb-2">{t('promptField.queueTitle')}</div>
            {queuedPrompts.map((queuedPrompt) => (
              <div key={queuedPrompt.id} className="flex items-center gap-2 mb-2 last:mb-0 p-2 bg-bg-secondary rounded border border-border-default-dark">
                <div className="flex-1 truncate text-text-muted-light text-xs">{queuedPrompt.text}</div>
                <Tooltip content={t('promptField.removeQueuedPrompt')}>
                  <button onClick={() => removeQueuedPrompt?.(queuedPrompt.id)} className="text-text-muted hover:text-text-primary transition-colors">
                    <MdPlaylistRemove size={16} />
                  </button>
                </Tooltip>

                <Tooltip content={t('promptField.sendQueuedPromptNow')}>
                  <button
                    onClick={() => sendQueuedPromptNow?.(queuedPrompt.id)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                    title={t('promptField.sendQueuedPromptNow')}
                  >
                    <BiSend size={16} />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
        {question && (
          <div className="mb-2 p-3 bg-gradient-to-b from-bg-primary to-bg-primary-light rounded-md border border-border-default-dark text-sm">
            <div className="text-text-primary text-sm mb-2 whitespace-pre-wrap">{question.text}</div>
            {question.subject && (
              <div className="text-text-muted-light text-xs mb-3 whitespace-pre-wrap max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-bg-tertiary scrollbar-track-bg-primary-light scrollbar-rounded">
                {question.subject}
              </div>
            )}
            <div className="flex gap-2">
              {question.answers && question.answers.length > 0 ? (
                question.answers.map((answer, index) => (
                  <button
                    key={index}
                    onClick={() => answerQuestion(answer.shortkey)}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-bg-tertiary border border-border-default ${selectedAnswer === answer.shortkey ? 'bg-bg-tertiary border-border-light' : 'bg-bg-secondary'}`}
                  >
                    {answer.text}
                  </button>
                ))
              ) : (
                <>
                  <button
                    onClick={() => answerQuestion('y')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-bg-tertiary border border-border-default ${selectedAnswer === 'y' ? 'bg-bg-tertiary border-accent-secondary' : 'bg-bg-secondary'}`}
                    title="Yes (Y)"
                  >
                    {t('promptField.answers.yes')}
                  </button>
                  <button
                    onClick={() => answerQuestion('n')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-bg-tertiary border border-border-default ${selectedAnswer === 'n' ? 'bg-bg-tertiary border-border-light' : 'bg-bg-secondary'}`}
                    title={t('promptField.answers.no')}
                  >
                    {t('promptField.answers.no')}
                  </button>
                  <button
                    onClick={() => answerQuestion('a')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-bg-tertiary border border-border-default ${selectedAnswer === 'a' ? 'bg-bg-tertiary border-border-light' : 'bg-bg-secondary'}`}
                    title={t('promptField.answers.always')}
                  >
                    {t('promptField.answers.always')}
                  </button>
                  <button
                    onClick={() => answerQuestion('d')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-bg-tertiary border border-border-default ${selectedAnswer === 'd' ? 'bg-bg-tertiary border-border-light' : 'bg-bg-secondary'}`}
                    title={t('promptField.answers.dontAsk')}
                  >
                    {t('promptField.answers.dontAsk')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="relative flex-shrink-0">
            <CodeMirror
              ref={(instance) => {
                editorRef.current = instance;
              }}
              onChange={onChange}
              placeholder={question ? t('promptField.questionPlaceholder') : t(`promptField.placeholders.${placeholderIndex}`)}
              editable={!disabled}
              spellCheck={false}
              className={clsx(
                'w-full px-2 py-1 border-2 border-border-default-dark rounded-md focus:outline-none focus:border-border-accent text-sm bg-bg-secondary text-text-primary placeholder-text-muted-dark resize-none overflow-y-auto transition-colors duration-200 max-h-[40vh] scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth hover:scrollbar-thumb-bg-fourth',
                voiceAvailable ? (isRecording ? 'pr-24' : 'pr-20') : 'pr-16',
              )}
              theme={theme}
              basicSetup={{
                highlightSelectionMatches: false,
                allowMultipleSelections: false,
                syntaxHighlighting: false,
                lineNumbers: false,
                foldGutter: false,
                completionKeymap: false,
                autocompletion: true,
                highlightActiveLine: false,
              }}
              indentWithTab={false}
              extensions={[
                EditorView.theme({
                  '&.cm-focused': {
                    outline: 'none',
                  },
                }),
                promptBehavior.useVimBindings ? vim() : keymap.of([]),
                EditorView.lineWrapping,
                EditorView.domEventHandlers({
                  paste(event) {
                    const items = event.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (item.type.indexOf('image') !== -1) {
                          const file = item.getAsFile();
                          if (file) {
                            file.arrayBuffer().then((buffer) => {
                              api.pasteImage(baseDir, taskId, buffer);
                            });
                          } else {
                            api.pasteImage(baseDir, taskId);
                          }
                          break;
                        }
                      }
                    }
                  },
                }),
                autocompletion({
                  override: question || historyMenuVisible ? [] : [completionSource],
                  activateOnTyping:
                    promptBehavior.suggestionMode === SuggestionMode.Automatically || promptBehavior.suggestionMode === SuggestionMode.MentionAtSign,
                  activateOnTypingDelay: promptBehavior.suggestionDelay,
                  aboveCursor: true,
                  icons: false,
                  selectOnOpen: false,
                  tooltipClass: () => (isMobile ? '' : 'max-w-[60vw]'),
                  addToOptions: [
                    {
                      render: (completion) => {
                        const [detail, showInChip] = getAutocompleteDetailLabel(completion.label);
                        if (!detail) {
                          return null;
                        }

                        const element = document.createElement('span');
                        element.className = showInChip
                          ? 'cm-tooltip-autocomplete-chip whitespace-pre-wrap text-right'
                          : 'cm-tooltip-autocomplete-detail whitespace-pre-wrap text-right';
                        element.innerText = detail;
                        return element;
                      },
                      position: 100,
                    },
                  ],
                }),
                Prec.high(keymapExtension),
              ]}
            />
            <div className="absolute right-3 top-1/2 -translate-y-[12px] flex items-center space-x-1 text-text-muted-light">
              {processing && (
                <Tooltip content={`${t('promptField.stopResponse')} (Ctrl+C)`}>
                  <button
                    onClick={() => interruptResponse()}
                    className="hover:text-text-tertiary hover:bg-bg-tertiary rounded p-1 transition-colors duration-200 ml-1"
                  >
                    <MdStop className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              {isRecording && mediaStream && <AudioAnalyzer stream={mediaStream} />}
              {voiceAvailable && (
                <Tooltip content={`${isRecording ? t('promptField.stopRecording') : t('promptField.startRecording')} (Alt+V)`}>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={disabled || isProcessing}
                    className={clsx(
                      'text-text-muted-light hover:text-text-tertiary hover:bg-bg-tertiary rounded p-1 transition-all duration-200',
                      isRecording ? 'text-accent-primary animate-pulse' : '',
                    )}
                  >
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isRecording ? (
                      <MdMicOff className="w-4 h-4" />
                    ) : (
                      <MdMic className="w-4 h-4" />
                    )}
                  </button>
                </Tooltip>
              )}
              {text.trim() && !isRecording && (
                <>
                  {!processing && (
                    <Tooltip content={t('promptField.savePrompt')}>
                      <button
                        onClick={handleSavePrompt}
                        disabled={disabled}
                        className={clsx('text-text-muted-light hover:text-text-tertiary hover:bg-bg-tertiary rounded p-1 transition-all duration-200')}
                      >
                        <MdSave className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content={isProcessing ? t('promptField.queueMessage') : t('promptField.sendMessage')}>
                    <button
                      onClick={handleSubmit}
                      disabled={disabled}
                      className={clsx('hover:text-text-tertiary hover:bg-bg-tertiary rounded p-1 transition-all duration-200')}
                    >
                      {isProcessing && !question ? <MdOutlineScheduleSend className="w-4 h-4" /> : <BiSend className="w-4 h-4" />}
                    </button>
                  </Tooltip>
                </>
              )}
              {processing && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            </div>
          </div>
          <div className={clsx('relative w-full flex flex-wrap', isMobile ? 'items-start gap-0.5' : 'items-center')}>
            <div className={clsx('flex gap-1.5', isMobile && !AIDER_MODES.includes(mode) ? 'flex-col items-start' : 'items-center')}>
              <ModeSelector baseDir={baseDir} mode={mode} onModeChange={onModeChanged} />
              <div className="flex gap-2">
                {!AIDER_MODES.includes(mode) && <AgentSelector projectDir={baseDir} task={task} isActive={isActive} showSettingsPage={showSettingsPage} />}
                <AutoApprove
                  enabled={!!task?.autoApprove}
                  locked={projectSettings?.autoApproveLocked ?? false}
                  onChange={onAutoApproveChanged}
                  onLockChange={handleAutoApproveLockChanged}
                  showLabel={!isMobile}
                />
              </div>
            </div>

            <div className="flex-grow" />
            {isMobile && (
              <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
                {toggleTerminal && (
                  <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
                    <VscTerminal className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">Terminal</span>
                  </Button>
                )}
                <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
                  <MdPlaylistRemove className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
                </Button>
                {showTaskInfo && (
                  <Tooltip content={t('promptField.taskInfo')}>
                    <Button variant="text" onClick={showTaskInfo} className="py-1.5" size="xs" color="tertiary">
                      <FaInfoCircle className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                )}
              </div>
            )}
            {!isMobile && toggleTerminal && (
              <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
                <VscTerminal className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Terminal</span>
              </Button>
            )}
            {!isMobile && (
              <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
                <MdPlaylistRemove className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
              </Button>
            )}
            {!isMobile && showTaskInfo && (
              <Tooltip content={t('promptField.taskInfo')}>
                <div>
                  <Button variant="text" onClick={showTaskInfo} className="py-1.5" size="xs" color="tertiary">
                    <FaInfoCircle className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Tooltip>
            )}
          </div>
        </div>
        {historyMenuVisible && historyItems.length > 0 && (
          <InputHistoryMenu
            items={historyItems}
            highlightedIndex={highlightedHistoryItemIndex}
            keepHighlightAtTop={keepHistoryHighlightTop}
            onScrollTop={loadMoreHistory}
            onSelect={(item) => {
              setTextWithDispatch(item);
              setHistoryMenuVisible(false);
            }}
            onClose={() => setHistoryMenuVisible(false)}
          />
        )}
      </div>
    );
  },
);

PromptField.displayName = 'PromptField';
