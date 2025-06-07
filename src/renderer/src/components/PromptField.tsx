import { Mode, QuestionData, PromptBehavior, SuggestionMode } from '@common/types';
import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'react-use';
import { matchSorter } from 'match-sorter';
import { BiSend } from 'react-icons/bi';
import { MdStop } from 'react-icons/md';
import TextareaAutosize from 'react-textarea-autosize';
import getCaretCoordinates from 'textarea-caret';

import { showErrorNotification } from '@/utils/notifications';
import { ModeSelector } from '@/components/ModeSelector';
import { AgentSelector } from '@/components/AgentSelector';
import { InputHistoryMenu } from '@/components/InputHistoryMenu';
import { CommandSuggestion } from '@/components/CommandSuggestion';

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
  '/commit',
];

const ANSWERS = ['y', 'n', 'a', 'd'];

const MAX_SUGGESTIONS = 10;

const HISTORY_MENU_CHUNK_SIZE = 20;

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
};

export const PromptField = React.forwardRef<PromptFieldRef, Props>(
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
    }: Props,
    ref,
  ) => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [debouncedText, setDebouncedText] = useState('');
    const [suggestionsVisible, setSuggestionsVisible] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [currentWord, setCurrentWord] = useState('');
    const [placeholderIndex] = useState(Math.floor(Math.random() * 16));
    const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
    const [historyMenuVisible, setHistoryMenuVisible] = useState(false);
    const [highlightedHistoryItemIndex, setHighlightedHistoryItemIndex] = useState(0);
    const [historyLimit, setHistoryLimit] = useState(HISTORY_MENU_CHUNK_SIZE);
    const [keepHistoryHighlightTop, setKeepHistoryHighlightTop] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [pendingCommand, setPendingCommand] = useState<{ command: string; args?: string } | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const historyItems = inputHistory.slice(0, historyLimit).reverse();

    const loadMoreHistory = useCallback(() => {
      if (historyLimit < inputHistory.length) {
        const additional = Math.min(HISTORY_MENU_CHUNK_SIZE, inputHistory.length - historyLimit);
        setHistoryLimit((prev) => prev + additional);
        setHighlightedHistoryItemIndex((prev) => prev + additional);
        setKeepHistoryHighlightTop(true);
      }
    }, [historyLimit, inputHistory.length]);

    useDebounce(
      () => {
        // only show suggestions if the current word is at least 3 characters long and suggestion mode is automatic
        if (promptBehavior.suggestionMode === SuggestionMode.Automatically && currentWord.length >= 3 && !suggestionsVisible) {
          const matched = matchSorter(words, currentWord);
          setFilteredSuggestions(matched.slice(0, MAX_SUGGESTIONS));
          setSuggestionsVisible(matched.length > 0);
        }
      },
      promptBehavior.suggestionDelay,
      [currentWord, words, promptBehavior.suggestionMode, promptBehavior.suggestionDelay],
    );

    useDebounce(
      () => {
        if (text !== debouncedText) {
          setDebouncedText(text);
        }
      },
      100,
      [text],
    );

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      setText: (newText: string) => {
        setText(newText);
        // Ensure cursor is at the end after setting text
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = newText.length;
            inputRef.current.selectionEnd = newText.length;
            inputRef.current.focus();
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
          case '/test': {
            runTests(args);
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
      const loadAddableFiles = async () => {
        if (pendingCommand?.command === '/add' || pendingCommand?.command === '/read-only') {
          try {
            const files = await window.api.getAddableFiles(baseDir);
            setFilteredSuggestions(
              files
                .filter((file) => file.includes(currentWord))
                .sort()
                .slice(0, MAX_SUGGESTIONS),
            );
            setSuggestionsVisible(currentWord.length > 0 && files.length > 0);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error fetching addable files:', error);
          }
        }
      };

      void loadAddableFiles();
    }, [pendingCommand, baseDir, currentWord]);

    useEffect(() => {
      if (question) {
        setSelectedAnswer(question.defaultAnswer || 'y');
      }
    }, [question]);

    useEffect(() => {
      if (!disabled && isActive && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isActive, disabled]);

    useEffect(() => {
      const commandMatch = COMMANDS.find((cmd) => text.startsWith(cmd));
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

    useLayoutEffect(() => {
      if (!suggestionsVisible) {
        return;
      }
      const timer = requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) {
          const caretPosition = getCaretCoordinates(input, input.selectionStart);
          setCursorPosition({
            top: caretPosition.top,
            left: caretPosition.left,
          });
        }
      });

      return () => {
        cancelAnimationFrame(timer);
      };
    }, [suggestionsVisible, debouncedText]);

    const getCurrentWord = (text: string, cursorPosition: number) => {
      const textBeforeCursor = text.slice(0, cursorPosition);
      const words = textBeforeCursor.split(/\s/);
      return words[words.length - 1] || '';
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setText(newText);
      setPendingCommand(null);

      const word = getCurrentWord(newText, e.target.selectionStart);

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

      if (newText.startsWith('/')) {
        const commandMatch = COMMANDS.find((cmd) => newText.toLowerCase().startsWith(cmd.toLowerCase()));
        if (commandMatch) {
          if ((commandMatch === '/add' && newText !== '/add') || (commandMatch === '/read-only' && newText !== '/read-only')) {
            setCurrentWord(word);
          } else {
            setSuggestionsVisible(false);
          }
          return;
        }
        const matched = COMMANDS.filter((cmd) => cmd.toLowerCase().startsWith(newText.toLowerCase())).sort();
        setFilteredSuggestions(matched);
        setSuggestionsVisible(matched.length > 0);
      } else if (word.length > 0) {
        setCurrentWord(word);
        setHighlightedSuggestionIndex(-1);

        if (suggestionsVisible) {
          const matched = matchSorter(words, word);
          setFilteredSuggestions(matched);
          setSuggestionsVisible(matched.length > 0);
        }
      } else {
        setSuggestionsVisible(false);
        setCurrentWord('');
      }
    };

    const showSuggestionsOnTab = () => {
      if (promptBehavior.suggestionMode === SuggestionMode.OnTab && currentWord.length) {
        const matched = matchSorter(words, currentWord);
        setFilteredSuggestions(matched.slice(0, MAX_SUGGESTIONS));
        setSuggestionsVisible(matched.length > 0);
        setHighlightedSuggestionIndex(-1);
      }
    };

    const acceptSuggestion = (suggestion: string) => {
      if (inputRef.current) {
        const cursorPos = inputRef.current.selectionStart;
        const textBeforeCursor = text.slice(0, cursorPos);
        const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ');
        const textAfterCursor = text.slice(cursorPos);

        // Check if suggestion is a command prefix
        const commandMatch = COMMANDS.find((cmd) => cmd === suggestion);
        const newText = commandMatch ? suggestion + ' ' + textAfterCursor : textBeforeCursor.slice(0, lastSpaceIndex + 1) + suggestion + textAfterCursor;

        setText(newText);
        setSuggestionsVisible(false);
        setCurrentWord('');

        inputRef.current.focus();
        const newCursorPos = commandMatch ? suggestion.length + 1 : lastSpaceIndex + 1 + suggestion.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    };

    const prepareForNextPrompt = () => {
      setText('');
      setCurrentWord('');
      setSuggestionsVisible(false);
      setHighlightedSuggestionIndex(-1);
      setPendingCommand(null);
    };

    const handleSubmit = () => {
      if (text) {
        if (text.startsWith('/') && !COMMANDS.some((cmd) => text.startsWith(cmd))) {
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

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          window.api.runCommand(baseDir, 'paste');
          break;
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle CTRL+C during processing
      if (processing && e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        interruptResponse();
        return;
      }

      if (question) {
        const answers = question.answers?.map((answer) => answer.shortkey.toLowerCase()) || ANSWERS;
        if (e.key === 'Tab' && selectedAnswer) {
          e.preventDefault();
          const currentIndex = answers.indexOf(selectedAnswer.toLowerCase());
          if (currentIndex !== -1) {
            const nextIndex = (currentIndex + (e.shiftKey ? -1 : 1) + ANSWERS.length) % ANSWERS.length;
            setSelectedAnswer(answers[nextIndex]);
            return;
          }
        }
        if (e.key === 'Enter' && !e.shiftKey && selectedAnswer && answers.includes(selectedAnswer.toLowerCase())) {
          e.preventDefault();
          answerQuestion(selectedAnswer);
          prepareForNextPrompt();
          return;
        }
      }

      if (historyMenuVisible) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (highlightedHistoryItemIndex === 0) {
              loadMoreHistory();
            } else {
              setHighlightedHistoryItemIndex((prev) => Math.max(prev - 1, 0));
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedHistoryItemIndex((prev) => Math.min(prev + 1, historyItems.length - 1));
            break;
          case 'Enter':
            e.preventDefault();
            if (historyItems[highlightedHistoryItemIndex]) {
              setText(historyItems[highlightedHistoryItemIndex]);
            }
            setHistoryMenuVisible(false);
            break;
          case 'Escape':
            e.preventDefault();
            setHistoryMenuVisible(false);
            break;
          default:
            setHistoryMenuVisible(false);
            break;
        }
      } else if (suggestionsVisible) {
        switch (e.key) {
          case 'Enter':
            if (highlightedSuggestionIndex !== -1) {
              e.preventDefault();
              acceptSuggestion(filteredSuggestions[highlightedSuggestionIndex]);
            } else if ((!processing || question) && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
            break;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedSuggestionIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
            break;
          case 'Tab':
            e.preventDefault();
            if (filteredSuggestions.length === 1) {
              acceptSuggestion(filteredSuggestions[0]);
            } else {
              setHighlightedSuggestionIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
            }
            break;
          case ' ':
            if (highlightedSuggestionIndex !== -1) {
              e.preventDefault();
              acceptSuggestion(filteredSuggestions[highlightedSuggestionIndex] + ' ');
            }
            break;
          case 'Escape':
            e.preventDefault();
            setSuggestionsVisible(false);
            break;
        }
      } else {
        switch (e.key) {
          case 'Enter':
            if (!e.shiftKey) {
              e.preventDefault();
              if (!processing || question) {
                handleSubmit();
              }
            }
            break;
          case 'Tab':
            if (promptBehavior.suggestionMode === SuggestionMode.OnTab) {
              e.preventDefault();
              showSuggestionsOnTab();
            }
            break;
          case 'ArrowUp':
            if (text === '' && historyItems.length > 0) {
              e.preventDefault();
              setHistoryLimit(HISTORY_MENU_CHUNK_SIZE);
              setHistoryMenuVisible(true);
              setHighlightedHistoryItemIndex(historyItems.length - 1);
            }
            break;
        }
      }
    };

    return (
      <div className="w-full relative">
        {question && (
          <div className="mb-2 p-3 rounded-md border text-sm" style={{ backgroundColor: 'var(--theme-background-secondary)', borderColor: 'var(--theme-border-primary)' }}>
            <div className="text-sm mb-2 whitespace-pre-wrap" style={{ color: 'var(--theme-foreground-primary)' }}>{question.text}</div>
            {question.subject && (
              <div className="text-xs mb-3 whitespace-pre-wrap max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-track-[var(--scrollbar-track)] scrollbar-thumb-[var(--scrollbar-thumb)] scrollbar-rounded" style={{ color: 'var(--theme-foreground-secondary)' }}>
                {question.subject}
              </div>
            )}
            <div className="flex gap-2">
              {question.answers && question.answers.length > 0 ? (
                question.answers.map((answer, index) => (
                  <button
                    key={index}
                    onClick={() => answerQuestion(answer.shortkey)}
                    className="px-2 py-0.5 text-xs rounded border transition-colors duration-200"
                    style={{
                      backgroundColor: selectedAnswer === answer.shortkey ? 'var(--theme-background-tertiary)' : 'var(--theme-background-input)',
                      borderColor: selectedAnswer === answer.shortkey ? 'var(--theme-border-secondary)' : 'var(--theme-border-primary)',
                      color: 'var(--theme-foreground-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== answer.shortkey) {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== answer.shortkey) {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
                      }
                    }}
                  >
                    {answer.text}
                  </button>
                ))
              ) : (
                <>
                  <button
                    onClick={() => answerQuestion('y')}
                    className="px-2 py-0.5 text-xs rounded border transition-colors duration-200"
                    style={{
                      backgroundColor: selectedAnswer === 'y' ? 'var(--theme-background-tertiary)' : 'var(--theme-background-input)',
                      borderColor: selectedAnswer === 'y' ? 'var(--theme-border-secondary)' : 'var(--theme-border-primary)',
                      color: 'var(--theme-foreground-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== 'y') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== 'y') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
                      }
                    }}
                    title="Yes (Y)"
                  >
                    {t('promptField.answers.yes')}
                  </button>
                  <button
                    onClick={() => answerQuestion('n')}
                    className="px-2 py-0.5 text-xs rounded border transition-colors duration-200"
                    style={{
                      backgroundColor: selectedAnswer === 'n' ? 'var(--theme-background-tertiary)' : 'var(--theme-background-input)',
                      borderColor: selectedAnswer === 'n' ? 'var(--theme-border-secondary)' : 'var(--theme-border-primary)',
                      color: 'var(--theme-foreground-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== 'n') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== 'n') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
                      }
                    }}
                    title={t('promptField.answers.no')}
                  >
                    {t('promptField.answers.no')}
                  </button>
                  <button
                    onClick={() => answerQuestion('a')}
                    className="px-2 py-0.5 text-xs rounded border transition-colors duration-200"
                    style={{
                      backgroundColor: selectedAnswer === 'a' ? 'var(--theme-background-tertiary)' : 'var(--theme-background-input)',
                      borderColor: selectedAnswer === 'a' ? 'var(--theme-border-secondary)' : 'var(--theme-border-primary)',
                      color: 'var(--theme-foreground-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== 'a') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== 'a') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
                      }
                    }}
                    title={t('promptField.answers.always')}
                  >
                    {t('promptField.answers.always')}
                  </button>
                  <button
                    onClick={() => answerQuestion('d')}
                    className="px-2 py-0.5 text-xs rounded border transition-colors duration-200"
                    style={{
                      backgroundColor: selectedAnswer === 'd' ? 'var(--theme-background-tertiary)' : 'var(--theme-background-input)',
                      borderColor: selectedAnswer === 'd' ? 'var(--theme-border-secondary)' : 'var(--theme-border-primary)',
                      color: 'var(--theme-foreground-primary)'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAnswer !== 'd') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAnswer !== 'd') {
                        e.currentTarget.style.backgroundColor = 'var(--theme-background-input)';
                      }
                    }}
                    title={t('promptField.answers.dontAsk')}
                  >
                    {t('promptField.answers.dontAsk')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col">
          <div className="relative flex-shrink-0">
            <TextareaAutosize
              ref={inputRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={question ? t('promptField.questionPlaceholder') : t(`promptField.placeholders.${placeholderIndex}`)}
              disabled={disabled}
              minRows={1}
              maxRows={20}
              spellCheck={false}
              className="w-full px-2 py-2 pr-8 border-2 rounded-md focus:outline-none text-sm resize-none overflow-y-auto transition-colors duration-200 max-h-[60vh] scrollbar-thin scrollbar-track-[var(--scrollbar-track)] scrollbar-thumb-[var(--scrollbar-thumb)] hover:scrollbar-thumb-[var(--scrollbar-thumb-hover)]"
              style={{
                backgroundColor: 'var(--theme-background-input)',
                color: 'var(--theme-foreground-primary)',
                borderColor: 'var(--theme-border-primary)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-border-secondary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-border-primary)';
              }}
            />
            {processing ? (
              <div className="absolute right-3 top-1/2 -translate-y-[16px] flex items-center space-x-2" style={{ color: 'var(--theme-foreground-secondary)' }}>
                <button
                  onClick={interruptResponse}
                  className="rounded p-1 transition-colors duration-200"
                  style={{
                    color: 'var(--theme-foreground-secondary)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--theme-foreground-primary)';
                    e.currentTarget.style.backgroundColor = 'var(--theme-background-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--theme-foreground-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
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
                className={`absolute right-2 top-1/2 -translate-y-[16px] text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded p-1 transition-all duration-200
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
          </div>
        </div>
        {suggestionsVisible && filteredSuggestions.length > 0 && (
          <div
            className="absolute bg-neutral-900 border border-neutral-700 rounded-md text-xs shadow-lg z-10 text-neutral-100
            scrollbar-thin
            scrollbar-track-neutral-900
            scrollbar-thumb-neutral-800
            hover:scrollbar-thumb-neutral-600"
            style={{
              bottom: `calc(100% - 4px - ${cursorPosition.top}px)`,
              left: `${cursorPosition.left}px`,
              maxHeight: '200px',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={index}
                ref={index === highlightedSuggestionIndex ? (el) => el?.scrollIntoView() : null}
                className={`px-2 py-1 cursor-pointer ${index === highlightedSuggestionIndex ? 'bg-neutral-700' : 'hover:bg-neutral-850'}`}
                onClick={() => acceptSuggestion(suggestion)}
              >
                {suggestion.startsWith('/') ? <CommandSuggestion command={suggestion.slice(1)} /> : <span>{suggestion}</span>}
              </div>
            ))}
          </div>
        )}
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
