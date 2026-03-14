import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { HiOutlineExclamation } from 'react-icons/hi';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import { LanguageSupport } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { clsx } from 'clsx';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  filePath: string;
  baseDir: string;
  onClose: () => void;
};

const theme = githubDarkInit({
  settings: {
    fontFamily: 'var(--font-family-mono)',
    fontSize: '12px',
    background: 'transparent',
    selection: 'var(--color-bg-selection)',
    caret: 'var(--color-text-muted)',
  },
});

const getLanguageDescription = (filePath: string) => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  return languages.find((lang) => lang.extensions.includes(extension) || lang.alias.includes(extension));
};

export const FilePreviewModal = ({ filePath, baseDir, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [languageExtension, setLanguageExtension] = useState<LanguageSupport | null>(null);

  const languageDescription = useMemo(() => getLanguageDescription(filePath), [filePath]);

  useEffect(() => {
    const loadLanguage = async () => {
      if (languageDescription) {
        try {
          const support = await languageDescription.load();
          setLanguageExtension(support);
        } catch {
          setLanguageExtension(null);
        }
      }
    };

    void loadLanguage();
  }, [languageDescription]);

  useEffect(() => {
    const fetchFileContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fileContent = await api.readFile(baseDir, filePath);
        setContent(fileContent);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFileContent();
  }, [api, baseDir, filePath]);

  const renderLoading = () => (
    <div className="flex items-center justify-center h-full">
      <AiOutlineLoading3Quarters className="w-8 h-8 text-text-muted animate-spin" />
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <HiOutlineExclamation className="w-12 h-12 text-error" />
      <p className="text-text-secondary text-sm">{t('filePreview.errorLoading')}</p>
      <p className="text-text-muted text-xs font-mono max-w-md text-center">{error}</p>
    </div>
  );

  const renderCodeContent = () => {
    const extensions = [
      EditorView.theme({
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-scroller': {
          overflowX: 'auto',
        },
        '.cm-content': {
          cursor: 'default',
        },
        '.cm-gutters': {
          background: 'transparent',
        },
      }),
      EditorView.lineWrapping,
    ];

    if (languageExtension) {
      extensions.push(languageExtension.extension);
    }

    return (
      <CodeMirror
        value={content || ''}
        theme={theme}
        editable={false}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: false,
          highlightSpecialChars: true,
          history: false,
          foldGutter: true,
          drawSelection: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: false,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          closeBracketsKeymap: false,
          defaultKeymap: false,
          searchKeymap: false,
          historyKeymap: false,
          foldKeymap: true,
          completionKeymap: false,
          lintKeymap: false,
        }}
        extensions={extensions}
        className="h-full overflow-auto"
      />
    );
  };

  return (
    <ModalOverlayLayout title={t('filePreview.title')} onClose={onClose} closeOnEscape={true}>
      <div className="flex items-center border-b border-border-default justify-center bg-bg-secondary min-h-[44px] px-4">
        <div className={clsx('flex items-center justify-between w-full max-w-6xl')}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xs sm:text-xs font-medium text-text-primary truncate" title={filePath}>
              {filePath}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-bg-primary-light scrollbar scrollbar-thumb-bg-tertiary scrollbar-track-transparent">
        {isLoading && renderLoading()}
        {error && renderError()}
        {!isLoading && !error && (
          <div className="mx-auto select-text bg-bg-code-block rounded-lg p-4 text-xs relative max-w-6xl scrollbar-thin scrollbar-track-bg-code-block scrollbar-thumb-bg-tertiary">
            {renderCodeContent()}
          </div>
        )}
      </div>
    </ModalOverlayLayout>
  );
};
