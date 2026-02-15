import { useCallback, useMemo, useState, startTransition, useOptimistic, MouseEvent, useEffect } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { MdUndo } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { DiffViewMode, UpdatedFile } from '@aider-desk/common/types';
import { getLanguageFromPath } from '@aider-desk/common/utils';
import { clsx } from 'clsx';

import { IconButton } from '../common/IconButton';
import { ModalOverlayLayout } from '../common/ModalOverlayLayout';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { UDiffViewer, CompactDiffViewer, DiffLineCommentPanel, LineClickInfo } from '../common/DiffViewer';
import { CompactSelect } from '../common/CompactSelect';

import { useSettings } from '@/contexts/SettingsContext';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  files: UpdatedFile[];
  initialFileIndex: number;
  onClose: () => void;
  baseDir: string;
  taskId: string;
};

export const UpdatedFilesDiffModal = ({ files, initialFileIndex, onClose, baseDir, taskId }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { settings, saveSettings } = useSettings();
  const [currentIndex, setCurrentIndex] = useState(initialFileIndex);
  const [diffViewMode, setDiffViewMode] = useOptimistic(settings?.diffViewMode || DiffViewMode.SideBySide);
  const [activeLineInfo, setActiveLineInfo] = useState<{ lineKey: string; lineInfo: LineClickInfo; position: { top: number; left: number } } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const currentFile = files[currentIndex];

  const language = useMemo(() => {
    return currentFile?.path ? getLanguageFromPath(currentFile.path) : 'text';
  }, [currentFile]);

  const resetLineState = useCallback(() => {
    setActiveLineInfo(null);
  }, []);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    resetLineState();
  }, [resetLineState]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(files.length - 1, prev + 1));
    resetLineState();
  }, [files.length, resetLineState]);

  const handleDiffViewModeChange = useCallback(
    (value: string) => {
      if (settings) {
        startTransition(() => {
          setDiffViewMode(value as DiffViewMode);
          void saveSettings({
            ...settings,
            diffViewMode: value as DiffViewMode,
          });
        });
      }
    },
    [settings, saveSettings, setDiffViewMode],
  );

  const handleLineClick = useCallback(
    (lineInfo: LineClickInfo, event: MouseEvent) => {
      event.stopPropagation();

      if (!currentFile?.diff) {
        return;
      }

      const target = event.target as HTMLElement;
      const row = target.closest('tr');
      if (!row) {
        return;
      }

      const rect = row.getBoundingClientRect();
      const containerRect = row.closest('.diff-viewer-container')?.getBoundingClientRect() || rect;

      setActiveLineInfo({
        lineKey: lineInfo.lineKey,
        lineInfo,
        position: {
          top: rect.bottom - containerRect.top + 24,
          left: Math.min(rect.left - containerRect.left + 20, containerRect.width - 320),
        },
      });
    },
    [currentFile],
  );

  const handleCommentCancel = useCallback(() => {
    resetLineState();
  }, [resetLineState]);

  const handleCommentSubmit = useCallback(
    async (comment: string) => {
      if (!currentFile || !activeLineInfo || isSubmitting) {
        return;
      }

      setIsSubmitting(true);

      try {
        api.runCodeInlineRequest(baseDir, taskId, currentFile.path, activeLineInfo.lineInfo.lineNumber, comment);

        resetLineState();
        onClose();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create task from line comment:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, baseDir, taskId, currentFile, activeLineInfo, isSubmitting, resetLineState, onClose],
  );

  const handleRevertClick = useCallback(() => {
    setShowRevertConfirm(true);
  }, []);

  const handleRevertCancel = useCallback(() => {
    setShowRevertConfirm(false);
  }, []);

  const handleRevertConfirm = useCallback(async () => {
    if (!currentFile) {
      return;
    }

    setIsReverting(true);
    try {
      await api.restoreFile(baseDir, taskId, currentFile.path);
      setShowRevertConfirm(false);
      onClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to revert file:', error);
    } finally {
      setIsReverting(false);
    }
  }, [api, baseDir, taskId, currentFile, onClose]);

  const diffViewOptions = useMemo(
    () => [
      { label: t('diffViewer.sideBySide'), value: DiffViewMode.SideBySide },
      { label: t('diffViewer.unified'), value: DiffViewMode.Unified },
      { label: t('diffViewer.compact'), value: DiffViewMode.Compact },
    ],
    [t],
  );

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < files.length - 1;

  useHotkeys('left', handlePrevious, { enabled: canGoPrevious });
  useHotkeys('right', handleNext, { enabled: canGoNext });

  useHotkeys('escape', resetLineState, { enabled: !!activeLineInfo });

  useEffect(() => {
    resetLineState();
  }, [resetLineState, currentIndex]);

  if (!currentFile) {
    return null;
  }

  return (
    <ModalOverlayLayout title={t('contextFiles.updatedFiles')} onClose={onClose} closeOnEscape={true}>
      <div className="flex items-center border-b border-border-default justify-center bg-bg-secondary min-h-[44px] px-4">
        <div className="flex items-center justify-between w-full max-w-6xl">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xs sm:text-xs font-medium text-text-primary truncate" title={currentFile.path}>
              {currentFile.path}
            </span>
            {currentFile.additions > 0 && <span className="text-3xs sm:text-xs font-medium text-success shrink-0">+{currentFile.additions}</span>}
            {currentFile.deletions > 0 && <span className="text-3xs sm:text-xs font-medium text-error shrink-0">-{currentFile.deletions}</span>}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <div className="hidden sm:block">
              <CompactSelect options={diffViewOptions} value={diffViewMode} onChange={handleDiffViewModeChange} />
            </div>
            {files.length > 1 && (
              <div className="flex items-center gap-2">
                <IconButton
                  icon={<HiChevronLeft className="h-5 w-5" />}
                  onClick={handlePrevious}
                  tooltip={t('common.previous')}
                  disabled={!canGoPrevious}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    canGoPrevious ? 'hover:bg-bg-tertiary text-text-secondary' : 'text-text-muted cursor-not-allowed',
                  )}
                />
                <span className="text-xs sm:text-sm text-text-secondary min-w-[60px] text-center">
                  {currentIndex + 1} / {files.length}
                </span>
                <IconButton
                  icon={<HiChevronRight className="h-5 w-5" />}
                  onClick={handleNext}
                  tooltip={t('common.next')}
                  disabled={!canGoNext}
                  className={clsx(
                    'p-1.5 rounded-md transition-colors',
                    canGoNext ? 'hover:bg-bg-tertiary text-text-secondary' : 'text-text-muted cursor-not-allowed',
                  )}
                />
              </div>
            )}
            <IconButton
              icon={<MdUndo className="h-5 w-5" />}
              onClick={handleRevertClick}
              tooltip={t('contextFiles.revertFile')}
              className="p-1.5 rounded-md transition-colors hover:bg-bg-tertiary text-text-secondary"
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-bg-primary-light scrollbar scrollbar-thumb-bg-tertiary scrollbar-track-transparent">
        <div className="max-w-6xl mx-auto select-text bg-bg-code-block rounded-lg p-4 text-xs relative">
          {diffViewMode === DiffViewMode.Compact ? (
            <CompactDiffViewer udiff={currentFile.diff || ''} language={language} showFilename={false} />
          ) : (
            <UDiffViewer
              udiff={currentFile.diff || ''}
              language={language}
              viewMode={diffViewMode}
              showFilename={false}
              onLineClick={handleLineClick}
              activeLineKey={activeLineInfo?.lineKey}
            />
          )}
          {activeLineInfo && <DiffLineCommentPanel onSubmit={handleCommentSubmit} onCancel={handleCommentCancel} position={activeLineInfo.position} />}
        </div>
      </div>

      {showRevertConfirm && (
        <ConfirmDialog
          title={t('contextFiles.confirmRevertTitle')}
          onConfirm={handleRevertConfirm}
          onCancel={handleRevertCancel}
          confirmButtonText={t('contextFiles.revert')}
          disabled={isReverting}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('contextFiles.confirmRevertMessage')}</p>
          <p className="text-xs text-text-muted font-mono">{currentFile.path}</p>
        </ConfirmDialog>
      )}
    </ModalOverlayLayout>
  );
};
