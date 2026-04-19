import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { HiOutlineExclamation, HiPencil, HiTrash } from 'react-icons/hi';
import { useHotkeys } from 'react-hotkeys-hook';
import { File, type FileProps, type LineAnnotation, type LineEventBaseProps } from '@pierre/diffs/react';
import { isCodeEditorDarkTheme } from '@common/types';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { DiffLineCommentPanel } from '@/components/common/DiffViewer';
import { CommentsPanel } from '@/components/ContextFiles/CommentsPanel';
import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';

import '@/components/common/DiffViewer/PierreDiffViewer.scss';

type PendingComment = {
  id: string;
  filePath: string;
  lineNumber: number;
  comment: string;
};

type ActiveLineInfo = {
  lineKey: string;
  lineNumber: number;
  viewportRect: { top: number; left: number };
};

type Props = {
  filePath: string;
  baseDir: string;
  taskId: string;
  onClose: () => void;
};

export const FileViewerModal = ({ filePath, baseDir, taskId, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { theme } = useSettings();

  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLineInfo, setActiveLineInfo] = useState<ActiveLineInfo | null>(null);
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createNewTask, setCreateNewTask] = useState(false);
  const [editCommentActiveLineInfo, setEditCommentActiveLineInfo] = useState<{
    commentId: string;
    viewportRect: { top: number; left: number };
    initialText: string;
  } | null>(null);

  useEffect(() => {
    const fetchFileContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fileContent = await api.readFile(baseDir, taskId, filePath);
        setContent(fileContent);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchFileContent();
  }, [api, baseDir, filePath, taskId]);

  const resetLineState = useCallback(() => {
    setActiveLineInfo(null);
  }, []);

  const handleLineClick = useCallback((props: LineEventBaseProps) => {
    const rect = props.lineElement.getBoundingClientRect();

    setActiveLineInfo({
      lineKey: `line-${props.lineNumber}`,
      lineNumber: props.lineNumber,
      viewportRect: {
        top: rect.bottom + 8,
        left: Math.min(rect.left + 8, window.innerWidth - 300),
      },
    });
  }, []);

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
        comment,
      };

      setPendingComments((prev) => [...prev, newComment]);
      resetLineState();
    },
    [activeLineInfo, filePath, resetLineState],
  );

  const handleRemoveComment = useCallback((id: string) => {
    setPendingComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleUpdateComment = useCallback((id: string, comment: string) => {
    setPendingComments((prev) => prev.map((c) => (c.id === id ? { ...c, comment } : c)));
  }, []);

  const handleEditCommentFromAnnotation = useCallback(
    (info: { commentId: string; viewportRect: { top: number; left: number } }) => {
      const pc = pendingComments.find((c) => c.id === info.commentId);
      if (!pc) {
        return;
      }
      setActiveLineInfo(null);
      setEditCommentActiveLineInfo({
        commentId: info.commentId,
        viewportRect: info.viewportRect,
        initialText: pc.comment,
      });
    },
    [pendingComments],
  );

  const handleEditCommentSubmit = useCallback(
    (comment: string) => {
      if (!editCommentActiveLineInfo) {
        return;
      }
      setPendingComments((prev) => prev.map((c) => (c.id === editCommentActiveLineInfo.commentId ? { ...c, comment } : c)));
      setEditCommentActiveLineInfo(null);
    },
    [editCommentActiveLineInfo],
  );

  const handleEditCommentCancel = useCallback(() => {
    setEditCommentActiveLineInfo(null);
  }, []);

  const handleSubmitAll = useCallback(async () => {
    if (pendingComments.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      api.runCodeChangeRequests(
        baseDir,
        taskId,
        pendingComments.map((c) => ({
          filename: c.filePath,
          lineNumber: c.lineNumber,
          userComment: c.comment,
        })),
        createNewTask,
      );
      setPendingComments([]);
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit change requests:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [api, baseDir, taskId, pendingComments, isSubmitting, onClose, createNewTask]);

  useHotkeys('escape', resetLineState, { enabled: !!activeLineInfo });

  const fileContents = useMemo(
    () => (content !== null ? { name: filePath, contents: content.endsWith('\n') ? content : content + '\n' } : null),
    [content, filePath],
  );

  const fileOptions = useMemo<FileProps<unknown>['options']>(
    () =>
      ({
        disableFileHeader: true,
        enableGutterUtility: true,
        overflow: 'wrap',
        theme: !theme || isCodeEditorDarkTheme(theme) ? 'github-dark-default' : 'github-light-default',
        onLineClick: handleLineClick,
      }) as FileProps<unknown>['options'],
    [theme, handleLineClick],
  );

  const lineAnnotations = useMemo<LineAnnotation<{ id: string; comment: string }>[]>(
    () => pendingComments.filter((c) => c.filePath === filePath).map((c) => ({ lineNumber: c.lineNumber, metadata: { id: c.id, comment: c.comment } })),
    [pendingComments, filePath],
  );

  const renderAnnotation = useCallback(
    (annotation: LineAnnotation<{ id: string; comment: string }>) => {
      const { id, comment } = annotation.metadata;

      const handleEdit = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const annotationEl = e.currentTarget.closest('[data-diff-annotation]') as HTMLElement | null;
        const rect = (annotationEl ?? e.currentTarget).getBoundingClientRect();
        handleEditCommentFromAnnotation({
          commentId: id,
          viewportRect: { top: rect.bottom + 8, left: Math.min(rect.left + 8, window.innerWidth - 300) },
        });
      };
      const handleRemove = () => handleRemoveComment(id);

      return (
        <div
          data-diff-annotation
          className="flex items-start justify-between gap-2 py-1.5 px-3 text-2xs text-text-secondary bg-bg-primary-light-strong border-t border-b border-border-accent group"
        >
          <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{comment}</span>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors"
              onClick={handleEdit}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <HiPencil size={14} />
            </button>
            <button type="button" className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-error transition-colors" onClick={handleRemove}>
              <HiTrash size={14} />
            </button>
          </div>
        </div>
      );
    },
    [handleEditCommentFromAnnotation, handleRemoveComment],
  );

  const hasAnnotations = pendingComments.some((c) => c.filePath === filePath);

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

  return (
    <ModalOverlayLayout title={t('filePreview.title')} onClose={onClose} closeOnEscape={true}>
      <div className="flex items-center border-b border-border-default justify-center bg-bg-secondary min-h-[44px] px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xs sm:text-xs font-medium text-text-primary truncate" title={filePath}>
              {filePath}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto bg-bg-primary-light scrollbar scrollbar-thumb-bg-tertiary scrollbar-track-transparent relative">
          {activeLineInfo && <DiffLineCommentPanel onSubmit={handleCommentSubmit} onCancel={handleCommentCancel} anchorRect={activeLineInfo.viewportRect} />}
          {editCommentActiveLineInfo && (
            <DiffLineCommentPanel
              initialText={editCommentActiveLineInfo.initialText}
              onSubmit={handleEditCommentSubmit}
              onCancel={handleEditCommentCancel}
              anchorRect={editCommentActiveLineInfo.viewportRect}
            />
          )}
          <div className="p-4 pr-0">
            {isLoading && renderLoading()}
            {error && renderError()}
            {!isLoading && !error && fileContents && (
              <div className="select-text bg-bg-code-block rounded-lg px-4 py-2 text-xs relative">
                <File file={fileContents} options={fileOptions} disableWorkerPool={true} {...(hasAnnotations ? { lineAnnotations, renderAnnotation } : {})} />
              </div>
            )}
          </div>
        </div>

        <CommentsPanel
          pendingComments={pendingComments}
          onRemoveComment={handleRemoveComment}
          onUpdateComment={handleUpdateComment}
          onSubmitAll={handleSubmitAll}
          isSubmitting={isSubmitting}
          createNewTask={createNewTask}
          onCreateNewTaskChange={setCreateNewTask}
        />
      </div>
    </ModalOverlayLayout>
  );
};
