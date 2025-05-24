import { Mode, QuestionData } from '@common/types';
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
import { InputHistoryMenu } from '@/components/InputHistoryMenu';

const COMMANDS = ['/code', '/context', '/agent', '/ask', '/architect', '/add', '/model', '/read-only'];
const CONFIRM_COMMANDS = [
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
  openModelSelector?: () => void;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
  runPrompt: (prompt: string) => void;
  showFileDialog: (readOnly: boolean) => void;
  clearMessages: () => void;
  scrapeWeb: (url: string) => void;
  question?: QuestionData | null;
  answerQuestion: (answer: string) => void; // Changed to required as it's always passed
  interruptResponse: () => void;
  runCommand: (command: string) => void;
  runTests: (testCmd?: string) => void;
  redoLastUserPrompt: () => void;
  editLastUserMessage: () => void;
  disabled?: boolean;
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
      disabled = false,
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
        // only show suggestions if the current word is at least 3 characters long
        if (currentWord.length >= 3 && !suggestionsVisible) {
          const matched = matchSorter(words, currentWord);
          setFilteredSuggestions(matched.slice(0, MAX_SUGGESTIONS));
          setSuggestionsVisible(matched.length > 0);
        }
      },
      100,
      [currentWord, words],
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

    const invokeCommand = useCallback(
      (command: string, args?: string): void => {
        switch (command) {
          case '/code':
          case '/context':
          case '/ask':
          case '/agent':
          case '/architect': {
            const prompt = text.replace(command, '').trim();
            setText(prompt);
            const newMode = command.slice(1) as Mode;
            onModeChanged(newMode);
            break;
          }
          case '/add':
            prepareForNextPrompt();
            showFileDialog(false);
            break;
          case '/read-only':
            prepareForNextPrompt();
            showFileDialog(true);
            break;
          case '/model':
            prepareForNextPrompt();
            openModelSelector?.();
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [mode, text, runTests],
    );

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
        invokeCommand(commandMatch);
        setSuggestionsVisible(false);
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

      const word = getCurrentWord(newText, e.target.selectionStart);
      setHighlightedSuggestionIndex(-1);

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
        const matched = [...new Set([...COMMANDS, ...CONFIRM_COMMANDS])].filter((cmd) => cmd.toLowerCase().startsWith(newText.toLowerCase()));
        setFilteredSuggestions(matched);
        setSuggestionsVisible(matched.length > 0);
      } else if (word.length > 0) {
        setCurrentWord(word);

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
    };

    const handleSubmit = () => {
      if (text) {
        if (text.startsWith('/') && ![...COMMANDS, ...CONFIRM_COMMANDS].some((cmd) => text.startsWith(cmd))) {
          showErrorNotification(t('promptField.invalidCommand'));
          return;
        }

        const confirmCommandMatch = CONFIRM_COMMANDS.find((cmd) => text.startsWith(cmd));
        if (confirmCommandMatch) {
          invokeCommand(confirmCommandMatch, text.split(' ').slice(1).join(' '));
        } else {
          runPrompt(text);
        }
        prepareForNextPrompt();
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

    const handleModeChange = (mode: Mode) => {
      onModeChanged(mode);
    };

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
              className="w-full px-2 py-2 pr-8 border-2 border-neutral-700 rounded-md focus:outline-none focus:border-neutral-500 text-sm bg-neutral-850 text-white placeholder-neutral-600 resize-none overflow-y-auto transition-colors duration-200 max-h-[60vh] scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-600"
            />
            {processing ? (
              <div className="absolute right-3 top-1/2 -translate-y-[16px] flex items-center space-x-2 text-neutral-400">
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
                className={`absolute right-2 top-1/2 -translate-y-[16px] text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded p-1 transition-all duration-200
                ${!text.trim() ? 'opacity-0' : 'opacity-100'}`}
                title={t('promptField.sendMessage')}
              >
                <BiSend className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative w-full h-7">
            <ModeSelector mode={mode} onModeChange={handleModeChange} />
          </div>
        </div>
        {suggestionsVisible && filteredSuggestions.length > 0 && (
          <div
            className="absolute bg-neutral-950 text-xs shadow-lg z-10 text-white
            scrollbar-thin
            scrollbar-track-neutral-900
            scrollbar-thumb-neutral-700
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
                ref={index === highlightedSuggestionIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : null}
                className={`px-2 py-1 cursor-pointer ${index === highlightedSuggestionIndex ? 'bg-neutral-700' : 'hover:bg-neutral-850'}`}
                onClick={() => acceptSuggestion(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
        {historyMenuVisible && historyItems.length > 0 && (
          <InputHistoryMenu
            items={historyItems}
            highlightedIndex={highlightedHistoryItemIndex}
            setHighlightedIndex={setHighlightedHistoryItemIndex}
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
