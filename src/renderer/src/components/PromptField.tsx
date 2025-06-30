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
import { Mode, PromptBehavior, QuestionData, SuggestionMode } from '@common/types';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import CodeMirror, { Prec, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiSend } from 'react-icons/bi';
import { MdPlaylistRemove, MdStop } from 'react-icons/md';

import { AgentSelector } from '@/components/AgentSelector';
import { InputHistoryMenu } from '@/components/InputHistoryMenu';
import { ModeSelector } from '@/components/ModeSelector';
import { showErrorNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';

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
  '/init',
  '/clear-logs',
];

const ANSWERS = ['y', 'n', 'a', 'd'];

const HISTORY_MENU_CHUNK_SIZE = 20;

const isPathLike = (input: string): boolean => {
  const firstWord = input.split(' ')[0];
  return (firstWord.match(/\//g) || []).length >= 2;
};

const theme = githubDarkInit({
  settings: {
    background: 'transparent',
  },
});

export interface PromptFieldRef {
  focus: () => void;
  setText: (text: string) => void;
}

type Props = {
  baseDir: string;
  processing: boolean;
  isActive: boolean;
  words?: string[];
  inputHistory?: string[];
  openModelSelector?: (model?: string) => void;
  openAgentModelSelector?: (model?: string) => void;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
  runPrompt: (prompt: string) => void;
  showFileDialog: (readOnly: boolean) => void;
  addFiles?: (filePaths: string[], readOnly?: boolean) => void;
  clearMessages: () => void;
  scrapeWeb: (url: string) => void;
  question?: QuestionData | null;
  answerQuestion: (answer: string) => void;
  interruptResponse: () => void;
  runCommand: (command: string) => void;
  runTests: (testCmd?: string) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: () => void;
  disabled?: boolean;
  promptBehavior: PromptBehavior;
  clearLogMessages: () => void;
};

export const PromptField = forwardRef<PromptFieldRef, Props>(
  (
    {
      baseDir,
      processing = false,
      isActive = false,
      words = [],
      inputHistory = [],
      mode,
      onModeChanged,
      showFileDialog,
      runPrompt,
      addFiles,
      clearMessages,
      scrapeWeb,
      question,
      answerQuestion,
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
    }: Props,
    ref,
  ) => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [placeholderIndex] = useState(Math.floor(Math.random() * 16));
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

    const completionSource = async (context: CompletionContext): Promise<CompletionResult | null> => {
      const word = context.matchBefore(/\S*/);
      const { state } = context;
      const text = state.doc.toString();

      if (!word || (word.from === word.to && !context.explicit)) {
        return null;
      }

      if (promptBehavior.suggestionMode === SuggestionMode.MentionAtSign) {
        // Handle @-based file suggestions (exclusive)
        const atPos = text.lastIndexOf('@');
        if (atPos >= 0 && (atPos === 0 || /\s/.test(text[atPos - 1]))) {
          const files = await window.api.getAddableFiles(baseDir);
          return {
            from: atPos + 1,
            options: files.map((file) => ({ label: file, type: 'file' })),
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
            const files = await window.api.getAddableFiles(baseDir);
            return {
              from: state.doc.length - currentArg.length,
              options: files.map((file) => ({ label: file, type: 'file' })),
              validFor: /^\S*$/,
            };
          }
        } else {
          return {
            from: 0,
            options: COMMANDS.map((cmd) => ({ label: cmd, type: 'keyword' })),
            validFor: /^\/\w*$/,
          };
        }
      }

      return {
        from: word.from,
        options: words.map((w) => ({ label: w, type: 'text' })),
      };
    };

    const historyItems = inputHistory.slice(0, historyLimit).reverse();

    const loadMoreHistory = useCallback(() => {
      if (historyLimit < inputHistory.length) {
        const additional = Math.min(HISTORY_MENU_CHUNK_SIZE, inputHistory.length - historyLimit);
        setHistoryLimit((prev) => prev + additional);
        setHighlightedHistoryItemIndex((prev) => prev + additional);
        setKeepHistoryHighlightTop(true);
      }
    }, [historyLimit, inputHistory.length]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        editorRef.current?.view?.focus();
      },
      setText: (newText: string) => {
        setText(newText);
        // Ensure cursor is at the end after setting text
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

    const executeCommand = useCallback(
      (command: string, args?: string): void => {
        switch (command) {
          case '/code':
          case '/context':
          case '/ask':
          case '/architect': {
            const newMode = command.slice(1) as Mode;
            onModeChanged(newMode);
            setText(args || '');
            break;
          }
          case '/agent': {
            const newMode = command.slice(1) as Mode;
            if (mode === 'agent') {
              openAgentModelSelector?.(args);
              prepareForNextPrompt();
            } else {
              onModeChanged(newMode);
              setText(args || '');
            }
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
            openModelSelector?.(args);
            break;
          case '/web': {
            const url = text.replace('/web', '').trim();
            prepareForNextPrompt();
            scrapeWeb(url);
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
            window.api.compactConversation(baseDir, mode, args);
            break;
          case '/test': {
            runTests(args);
            break;
          }
          case '/init': {
            if (mode !== 'agent') {
              showErrorNotification(t('promptField.initCommandAgentModeOnly'));
              return;
            }
            prepareForNextPrompt();
            window.api.initProjectRulesFile(baseDir);
            break;
          }
          case '/clear-logs': {
            prepareForNextPrompt();
            clearLogMessages();
            break;
          }
          default: {
            setText('');
            runCommand(`${command.slice(1)} ${args || ''}`);
            break;
          }
        }
      },
      [
        showFileDialog,
        addFiles,
        openModelSelector,
        clearMessages,
        redoLastUserPrompt,
        editLastUserMessage,
        onModeChanged,
        text,
        mode,
        openAgentModelSelector,
        scrapeWeb,
        runTests,
        runCommand,
        baseDir,
        t,
        clearLogMessages,
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
      setHistoryLimit(Math.min(HISTORY_MENU_CHUNK_SIZE, inputHistory.length));
    }, [inputHistory]);

    useEffect(() => {
      if (keepHistoryHighlightTop) {
        setKeepHistoryHighlightTop(false);
      }
    }, [historyLimit, keepHistoryHighlightTop]);

    const onChange = useCallback(
      (newText: string) => {
        setText(newText);
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
      },
      [question],
    );

    const prepareForNextPrompt = () => {
      setText('');
      setPendingCommand(null);
    };

    const handleSubmit = () => {
      if (text) {
        if (text.startsWith('/') && !isPathLike(text) && !COMMANDS.some((cmd) => text.startsWith(cmd))) {
          showErrorNotification(t('promptField.invalidCommand'));
          return;
        }

        if (pendingCommand) {
          prepareForNextPrompt();
          handleConfirmCommand();
        } else {
          runPrompt(text);
          prepareForNextPrompt();
        }
      }
    };

    const getAutocompleteDetailLabel = (item: string) => {
      if (item.startsWith('/')) {
        if (item === '/init' && mode !== 'agent') {
          return t('commands.agentModeOnly');
        }

        return t(`commands.${item.slice(1)}`);
      }

      return null;
    };

    const keymapExtension = keymap.of([
      {
        key: 'Enter',
        preventDefault: true,
        run: (view) => {
          if (question && selectedAnswer) {
            const answers = question.answers?.map((answer) => answer.shortkey.toLowerCase()) || ANSWERS;
            if (answers.includes(selectedAnswer.toLowerCase())) {
              answerQuestion(selectedAnswer);
              prepareForNextPrompt();
              return true;
            }
          } else if (historyMenuVisible) {
            setHistoryMenuVisible(false);
            view.dispatch({
              changes: { from: 0, insert: historyItems[highlightedHistoryItemIndex] },
              selection: { anchor: historyItems[highlightedHistoryItemIndex].length },
            });
          } else if (!processing || question) {
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
        key: '@',
        preventDefault: true,
        run: (view) => {
          if (promptBehavior.suggestionMode !== SuggestionMode.MentionAtSign) {
            return false;
          }
          const cursorPos = view.state.selection.main.head;
          const textBeforeCursor = view.state.doc.sliceString(0, cursorPos);

          if (!/\S$/.test(textBeforeCursor)) {
            view.dispatch({
              changes: { from: cursorPos, insert: '@' },
              selection: { anchor: cursorPos + 1 },
            });
            startCompletion(view);
          }
          return true;
        },
      },

      {
        key: 'ArrowUp',
        run: () => {
          if (!text && historyItems.length > 0) {
            if (historyMenuVisible) {
              if (highlightedHistoryItemIndex === 0) {
                loadMoreHistory();
              } else {
                setHighlightedHistoryItemIndex((prev) => Math.max(prev - 1, 0));
              }
            } else {
              setHistoryLimit(HISTORY_MENU_CHUNK_SIZE);
              setHistoryMenuVisible(true);
              setHighlightedHistoryItemIndex(historyItems.length - 1);
            }
            return true;
          }
          return false;
        },
      },
      {
        key: 'ArrowDown',
        run: () => {
          if (historyMenuVisible) {
            setHighlightedHistoryItemIndex((prev) => Math.min(prev + 1, historyItems.length - 1));
            return true;
          }
          return false;
        },
      },
    ]);

    return (
      <div className="w-full relative">
        {question && (
          <div className="mb-2 p-3 bg-gradient-to-b fromF-neutral-950 to-neutral-900 rounded-md border border-neutral-700 text-sm">
            <div className="text-white text-sm mb-2 whitespace-pre-wrap">{question.text}</div>
            {question.subject && (
              <div className="text-neutral-400 text-xs mb-3 whitespace-pre-wrap max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900 scrollbar-rounded">
                {question.subject}
              </div>
            )}
            <div className="flex gap-2">
              {question.answers && question.answers.length > 0 ? (
                question.answers.map((answer, index) => (
                  <button
                    key={index}
                    onClick={() => answerQuestion(answer.shortkey)}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-neutral-700 border border-neutral-600 ${selectedAnswer === answer.shortkey ? 'bg-neutral-700 border-neutral-400' : 'bg-neutral-850'}`}
                  >
                    {answer.text}
                  </button>
                ))
              ) : (
                <>
                  <button
                    onClick={() => answerQuestion('y')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-neutral-700 border border-neutral-600 ${selectedAnswer === 'y' ? 'bg-neutral-700 border-neutral-400' : 'bg-neutral-850'}`}
                    title="Yes (Y)"
                  >
                    {t('promptField.answers.yes')}
                  </button>
                  <button
                    onClick={() => answerQuestion('n')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-neutral-700 border border-neutral-600 ${selectedAnswer === 'n' ? 'bg-neutral-700 border-neutral-400' : 'bg-neutral-850'}`}
                    title={t('promptField.answers.no')}
                  >
                    {t('promptField.answers.no')}
                  </button>
                  <button
                    onClick={() => answerQuestion('a')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-neutral-700 border border-neutral-600 ${selectedAnswer === 'a' ? 'bg-neutral-700 border-neutral-400' : 'bg-neutral-850'}`}
                    title={t('promptField.answers.always')}
                  >
                    {t('promptField.answers.always')}
                  </button>
                  <button
                    onClick={() => answerQuestion('d')}
                    className={`px-2 py-0.5 text-xs rounded hover:bg-neutral-700 border border-neutral-600 ${selectedAnswer === 'd' ? 'bg-neutral-700 border-neutral-400' : 'bg-neutral-850'}`}
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
              ref={editorRef}
              value={text}
              onChange={onChange}
              placeholder={question ? t('promptField.questionPlaceholder') : t(`promptField.placeholders.${placeholderIndex}`)}
              editable={!disabled}
              spellCheck={false}
              className="w-full px-2 py-1 pr-8 border-2 border-neutral-700 rounded-md focus:outline-none focus:border-neutral-500 text-sm bg-neutral-850 text-white placeholder-neutral-600 resize-none overflow-y-auto transition-colors duration-200 max-h-[60vh] scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-600"
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
                promptBehavior.useVimBindings ? vim() : keymap.of([]),
                EditorView.lineWrapping,
                EditorView.domEventHandlers({
                  paste(event) {
                    const items = event.clipboardData?.items;
                    if (items) {
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                          window.api.runCommand(baseDir, 'paste');
                          break;
                        }
                      }
                    }
                  },
                }),
                autocompletion({
                  override: question ? [] : [completionSource],
                  activateOnTyping:
                    promptBehavior.suggestionMode === SuggestionMode.Automatically || promptBehavior.suggestionMode === SuggestionMode.MentionAtSign,
                  activateOnTypingDelay: promptBehavior.suggestionDelay,
                  aboveCursor: true,
                  icons: false,
                  selectOnOpen: false,
                  addToOptions: [
                    {
                      render: (completion) => {
                        const detail = getAutocompleteDetailLabel(completion.label);
                        if (!detail) {
                          return null;
                        }

                        const element = document.createElement('span');
                        element.className =
                          mode !== 'agent' && completion.label === '/init' ? 'cm-tooltip-autocomplete-chip' : 'cm-tooltip-autocomplete-detail';
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
            {processing ? (
              <div className="absolute right-3 top-1/2 -translate-y-[12px] flex items-center space-x-2 text-neutral-400">
                <button
                  onClick={interruptResponse}
                  className="hover:text-neutral-300 hover:bg-neutral-700 rounded p-1 transition-colors duration-200"
                  title={t('promptField.stopResponse')}
                >
                  <MdStop className="w-4 h-4" />
                </button>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className={`absolute right-2 top-1/2 -translate-y-[12px] text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded p-1 transition-all duration-200
                ${!text.trim() ? 'opacity-0' : 'opacity-100'}`}
                title={t('promptField.sendMessage')}
              >
                <BiSend className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative w-full flex items-center gap-1.5">
            <ModeSelector mode={mode} onModeChange={onModeChanged} />
            {mode === 'agent' && <AgentSelector />}
            <div className="flex-grow" />
            <Button
              variant="text"
              onClick={() => clearMessages()}
              className="hover:bg-neutral-800 border-neutral-200 text-neutral-200 hover:text-neutral-100"
              size="xs"
            >
              <MdPlaylistRemove className="w-4 h-4 mr-1" />
              {t('promptField.clearChat')}
            </Button>
          </div>
        </div>
        {historyMenuVisible && historyItems.length > 0 && (
          <InputHistoryMenu
            items={historyItems}
            highlightedIndex={highlightedHistoryItemIndex}
            keepHighlightAtTop={keepHistoryHighlightTop}
            onScrollTop={loadMoreHistory}
            onSelect={(item) => {
              setText(item);
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
