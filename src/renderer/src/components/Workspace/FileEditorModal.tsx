import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { HiOutlineExclamation } from 'react-icons/hi';
import { MdSave } from 'react-icons/md';
import { useHotkeys } from 'react-hotkeys-hook';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView, GutterMarker, gutter, lineNumbers } from '@codemirror/view';
import { githubDarkInit } from '@uiw/codemirror-theme-github';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';

import { remapLineAnchors } from './fileEditorUtils';
import { createInlineChangeRequestsExtension } from './fileEditorInlineRequests';
import { CommentsPanel } from './CommentsPanel';

import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DiffLineCommentPanel } from '@/components/common/DiffViewer';
import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification, showSuccessNotification, showWarningNotification } from '@/utils/notifications';

const EDITOR_THEME = githubDarkInit({
  settings: {
    fontFamily: 'monospace',
    background: 'var(--color-bg-code-block)',
    foreground: 'var(--color-text-primary)',
    selection: 'var(--color-bg-selection)',
    caret: 'var(--color-text-muted)',
    gutterBackground: 'var(--color-bg-code-block)',
    gutterForeground: 'var(--color-text-muted)',
    gutterBorder: 'var(--color-border-default)',
    lineHighlight: 'var(--color-bg-primary-light-strong)',
  },
});

const EDITOR_LAYOUT = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarColor: 'var(--color-bg-secondary-light) var(--color-bg-primary)',
    scrollbarWidth: 'thin',
  },
  '.cm-scroller::-webkit-scrollbar': {
    height: '8px',
    width: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: 'var(--color-bg-primary)',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--color-bg-secondary-light)',
    borderRadius: '9999px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'var(--color-bg-fourth)',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 12px 0 6px',
  },
  '.cm-gutters': {
    borderRight: '1px solid var(--color-border-default)',
  },
  '.cm-change-request-gutter': {
    borderRight: 'none',
  },
  '.cm-change-request-gutter .cm-gutterElement': {
    alignItems: 'center',
    display: 'flex',
    minWidth: '24px',
    padding: '0 2px',
  },
  '.cm-change-request-button': {
    alignItems: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    fontSize: '14px',
    height: '18px',
    justifyContent: 'center',
    opacity: '0',
    padding: '0',
    transition: 'opacity 120ms, background-color 120ms, color 120ms',
    width: '18px',
  },
  '.cm-gutterElement:hover .cm-change-request-button, .cm-change-request-button:focus-visible': {
    opacity: '1',
  },
  '.cm-change-request-button:hover, .cm-change-request-button:focus-visible': {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-accent-primary)',
    outline: 'none',
  },
});

const BASIC_SETUP = {
  highlightSelectionMatches: true,
  allowMultipleSelections: true,
  lineNumbers: false,
  foldGutter: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  autocompletion: true,
};

type PendingComment = {
  id: string;
  filePath: string;
  lineNumber: number;
  position: number;
  comment: string;
};

type ActiveLineInfo = {
  lineNumber: number;
  position: number;
  viewportRect: { top: number; left: number };
};

type EditCommentInfo = {
  commentId: string;
  viewportRect: { top: number; left: number };
  initialText: string;
};

type LineSelectHandler = (lineNumber: number, position: number, rect: DOMRect) => void;

class ChangeRequestGutterMarker extends GutterMarker {
  constructor(
    private readonly lineNumber: number,
    private readonly position: number,
    private readonly label: string,
    private readonly onSelect: LineSelectHandler,
  ) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof ChangeRequestGutterMarker &&
      other.lineNumber === this.lineNumber &&
      other.position === this.position &&
      other.label === this.label &&
      other.onSelect === this.onSelect
    );
  }

  toDOM(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-change-request-button';
    button.textContent = '+';
    button.title = this.label;
    button.setAttribute('aria-label', this.label);
    button.dataset.lineNumber = String(this.lineNumber);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onSelect(this.lineNumber, this.position, button.getBoundingClientRect());
    });
    return button;
  }
}

type Props = {
  filePath: string;
  baseDir: string;
  taskId: string;
  onClose: () => void;
};

export const FileEditorModal = ({ filePath, baseDir, taskId, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const pendingCommentsRef = useRef<PendingComment[]>([]);

  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string | null>(null);
  const [languageSupport, setLanguageSupport] = useState<Extension | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLineInfo, setActiveLineInfo] = useState<ActiveLineInfo | null>(null);
  const [editCommentInfo, setEditCommentInfo] = useState<EditCommentInfo | null>(null);
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createNewTask, setCreateNewTask] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isDirty = savedContent !== null && editorContent !== null && savedContent !== editorContent;

  const updatePendingComments = useCallback((updater: (comments: PendingComment[]) => PendingComment[]) => {
    const updatedComments = updater(pendingCommentsRef.current);
    pendingCommentsRef.current = updatedComments;
    setPendingComments(updatedComments);
  }, []);

  useEffect(() => {
    const fetchFileContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fileContent = await api.readFile(baseDir, taskId, filePath);
        setSavedContent(fileContent);
        setEditorContent(fileContent);
        pendingCommentsRef.current = [];
        setPendingComments([]);
        setActiveLineInfo(null);
        setEditCommentInfo(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFileContent();
  }, [api, baseDir, filePath, taskId]);

  useEffect(() => {
    let cancelled = false;
    setLanguageSupport(null);

    const language = LanguageDescription.matchFilename(languages, filePath);
    if (language) {
      void language
        .load()
        .then((support) => {
          if (!cancelled) {
            setLanguageSupport(support);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLanguageSupport(null);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const resetLineState = useCallback(() => {
    setActiveLineInfo(null);
  }, []);

  const handleLineSelect = useCallback<LineSelectHandler>((lineNumber, position, rect) => {
    setEditCommentInfo(null);
    setActiveLineInfo({
      lineNumber,
      position,
      viewportRect: {
        top: rect.bottom + 8,
        left: Math.min(rect.left + 8, window.innerWidth - 300),
      },
    });
  }, []);

  const changeRequestGutter = useMemo(
    () =>
      gutter({
        class: 'cm-change-request-gutter',
        renderEmptyElements: true,
        lineMarker: (view, line) => {
          const documentLine = view.state.doc.lineAt(line.from);
          return new ChangeRequestGutterMarker(documentLine.number, documentLine.from, t('fileEditor.requestChangeOnLine'), handleLineSelect);
        },
      }),
    [handleLineSelect, t],
  );

  const handleEditorChange = useCallback(
    (value: string, viewUpdate: Parameters<NonNullable<ComponentProps<typeof CodeMirror>['onChange']>>[1]) => {
      setEditorContent(value);
      if (!viewUpdate.docChanged) {
        return;
      }

      const getLineNumber = (position: number) => viewUpdate.state.doc.lineAt(Math.min(position, viewUpdate.state.doc.length)).number;
      const mapPosition = (position: number) => viewUpdate.changes.mapPos(position, 1);

      updatePendingComments((comments) => remapLineAnchors(comments, mapPosition, getLineNumber));
      setActiveLineInfo((current) => {
        if (!current) {
          return null;
        }
        return remapLineAnchors([current], mapPosition, getLineNumber)[0];
      });
    },
    [updatePendingComments],
  );

  const handleCommentCancel = useCallback(() => {
    resetLineState();
  }, [resetLineState]);

  const handleCommentSubmit = useCallback(
    (comment: string) => {
      if (!activeLineInfo) {
        return;
      }

      const newComment: PendingComment = {
        id: `${filePath}-${activeLineInfo.lineNumber}-${Date.now()}`,
        filePath,
        lineNumber: activeLineInfo.lineNumber,
        position: activeLineInfo.position,
        comment,
      };

      updatePendingComments((comments) => [...comments, newComment]);
      resetLineState();
    },
    [activeLineInfo, filePath, resetLineState, updatePendingComments],
  );

  const handleRemoveComment = useCallback(
    (id: string) => {
      updatePendingComments((comments) => comments.filter((comment) => comment.id !== id));
      setEditCommentInfo((current) => (current?.commentId === id ? null : current));
    },
    [updatePendingComments],
  );

  const handleUpdateComment = useCallback(
    (id: string, comment: string) => {
      updatePendingComments((comments) => comments.map((pendingComment) => (pendingComment.id === id ? { ...pendingComment, comment } : pendingComment)));
    },
    [updatePendingComments],
  );

  const handleInlineCommentEdit = useCallback((id: string, rect: DOMRect) => {
    const pendingComment = pendingCommentsRef.current.find((comment) => comment.id === id);
    if (!pendingComment) {
      return;
    }

    setActiveLineInfo(null);
    setEditCommentInfo({
      commentId: id,
      viewportRect: {
        top: rect.bottom + 8,
        left: Math.min(rect.left + 8, window.innerWidth - 300),
      },
      initialText: pendingComment.comment,
    });
  }, []);

  const handleEditCommentSubmit = useCallback(
    (comment: string) => {
      if (!editCommentInfo) {
        return;
      }

      handleUpdateComment(editCommentInfo.commentId, comment);
      setEditCommentInfo(null);
    },
    [editCommentInfo, handleUpdateComment],
  );

  const handleEditCommentCancel = useCallback(() => {
    setEditCommentInfo(null);
  }, []);

  const inlineChangeRequests = useMemo(
    () =>
      createInlineChangeRequestsExtension({
        changeRequests: pendingComments,
        editLabel: t('common.edit'),
        deleteLabel: t('common.delete'),
        onEdit: handleInlineCommentEdit,
        onRemove: handleRemoveComment,
      }),
    [handleInlineCommentEdit, handleRemoveComment, pendingComments, t],
  );

  const editorExtensions = useMemo(
    () => [changeRequestGutter, lineNumbers(), EDITOR_LAYOUT, inlineChangeRequests, ...(languageSupport ? [languageSupport] : [])],
    [changeRequestGutter, inlineChangeRequests, languageSupport],
  );

  const handleSave = useCallback(() => {
    if (savedContent === null || editorContent === null || savedContent === editorContent) {
      return;
    }

    try {
      api.applyEdits(baseDir, taskId, [
        {
          path: filePath,
          original: savedContent,
          updated: editorContent,
        },
      ]);
      setSavedContent(editorContent);
      showSuccessNotification(t('fileEditor.saved'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorNotification(t('fileEditor.errorSaving', { error: message }));
    }
  }, [api, baseDir, editorContent, filePath, savedContent, t, taskId]);

  const handleSubmitAll = useCallback(async () => {
    if (pendingComments.length === 0 || isSubmitting) {
      return;
    }
    if (isDirty) {
      showWarningNotification(t('fileEditor.saveBeforeSubmitting'));
      return;
    }

    setIsSubmitting(true);
    try {
      api.runCodeChangeRequests(
        baseDir,
        taskId,
        pendingComments.map((comment) => ({
          filename: comment.filePath,
          lineNumber: comment.lineNumber,
          userComment: comment.comment,
        })),
        createNewTask,
      );
      updatePendingComments(() => []);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorNotification(t('fileEditor.errorSubmitting', { error: message }));
    } finally {
      setIsSubmitting(false);
    }
  }, [api, baseDir, createNewTask, isDirty, isSubmitting, onClose, pendingComments, t, taskId, updatePendingComments]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  const handleDiscardChanges = useCallback(() => {
    setShowDiscardConfirm(false);
    onClose();
  }, [onClose]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const handleCreateNewTaskChange = useCallback((value: boolean) => {
    setCreateNewTask(value);
  }, []);

  useHotkeys('escape', resetLineState, {
    enabled: !!activeLineInfo,
    enableOnFormTags: true,
    enableOnContentEditable: true,
  });

  useHotkeys(
    ['ctrl+s', 'meta+s'],
    (event) => {
      event.preventDefault();
      handleSave();
    },
    {
      enabled: isDirty,
      enableOnFormTags: true,
      enableOnContentEditable: true,
    },
    [handleSave, isDirty],
  );

  const renderLoading = () => (
    <div className="flex items-center justify-center h-full">
      <AiOutlineLoading3Quarters className="w-8 h-8 text-text-muted animate-spin" />
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <HiOutlineExclamation className="w-12 h-12 text-error" />
      <p className="text-text-secondary text-sm">{t('fileEditor.errorLoading')}</p>
      <p className="text-text-muted text-xs font-mono max-w-md text-center">{error}</p>
    </div>
  );

  return (
    <ModalOverlayLayout title={t('fileEditor.title')} onClose={handleClose} closeOnEscape={!activeLineInfo && !editCommentInfo && !showDiscardConfirm}>
      <div className="flex items-center border-b border-border-default justify-center bg-bg-secondary min-h-[44px] px-4">
        <div className="flex items-center justify-between gap-4 w-full">
          <span className="text-3xs sm:text-xs font-medium text-text-primary truncate" title={filePath}>
            {filePath}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {isDirty && <span className="text-3xs text-warning">{t('fileEditor.unsavedChanges')}</span>}
            <Button onClick={handleSave} disabled={!isDirty} size="xs" tooltip={t('fileEditor.saveShortcut')}>
              <MdSave className="w-3.5 h-3.5" />
              <span>{t('common.save')}</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden bg-bg-code-block relative">
          {activeLineInfo && <DiffLineCommentPanel onSubmit={handleCommentSubmit} onCancel={handleCommentCancel} anchorRect={activeLineInfo.viewportRect} />}
          {editCommentInfo && (
            <DiffLineCommentPanel
              initialText={editCommentInfo.initialText}
              onSubmit={handleEditCommentSubmit}
              onCancel={handleEditCommentCancel}
              anchorRect={editCommentInfo.viewportRect}
            />
          )}
          {isLoading && renderLoading()}
          {error && renderError()}
          {!isLoading && !error && editorContent !== null && (
            <CodeMirror
              value={editorContent}
              onChange={handleEditorChange}
              theme={EDITOR_THEME}
              basicSetup={BASIC_SETUP}
              extensions={editorExtensions}
              indentWithTab={true}
              className="h-full text-xs"
            />
          )}
        </div>

        <CommentsPanel
          pendingComments={pendingComments}
          onRemoveComment={handleRemoveComment}
          onUpdateComment={handleUpdateComment}
          onSubmitAll={handleSubmitAll}
          isSubmitting={isSubmitting}
          createNewTask={createNewTask}
          onCreateNewTaskChange={handleCreateNewTaskChange}
        />
      </div>

      {showDiscardConfirm && (
        <ConfirmDialog
          title={t('fileEditor.discardTitle')}
          onConfirm={handleDiscardChanges}
          onCancel={handleDiscardCancel}
          confirmButtonText={t('fileEditor.discard')}
          confirmButtonColor="danger"
          closeOnEscape
        >
          <p className="text-sm text-text-primary">{t('fileEditor.discardMessage')}</p>
        </ConfirmDialog>
      )}
    </ModalOverlayLayout>
  );
};
