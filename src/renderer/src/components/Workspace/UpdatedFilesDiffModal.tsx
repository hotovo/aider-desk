import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HiChevronLeft, HiChevronRight, HiSparkles, HiViewList } from 'react-icons/hi';
import { MdClose, MdOutlineCommit, MdUndo, MdUnfoldLess, MdUnfoldMore } from 'react-icons/md';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { useLocalStorage } from '@reactuses/core';
import { DiffViewMode, UpdatedFile } from '@common/types';
import { clsx } from 'clsx';

import { sortFilesByTreeOrder } from './group-files';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { IconButton } from '@/components/common/IconButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DiffLineCommentPanel, PierreDiffViewer, PierreLineClickInfo, type DiffComment } from '@/components/common/DiffViewer';
import { CompactSelect } from '@/components/common/CompactSelect';
import { TextArea } from '@/components/common/TextArea';
import { Checkbox } from '@/components/common/Checkbox';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { DiffFileItem } from '@/components/Workspace/DiffFileItem';
import { DiffFilesSidebar } from '@/components/Workspace/DiffFilesSidebar';
import { CommentsPanel } from '@/components/Workspace/CommentsPanel';
import { useApi } from '@/contexts/ApiContext';
import { useCommitChanges } from '@/hooks/useCommitChanges';
import { useUpdatedFileDiff } from '@/hooks/useUpdatedFileDiff';
import { useUpdatedFileContents } from '@/hooks/useUpdatedFileContents';

type PendingComment = {
  id: string;
  filePath: string;
  lineNumber: number;
  lineKey: string;
  comment: string;
};

export type DiffModalGroup = {
  id: string | null;
  commitHash?: string;
  commitMessage?: string;
  files: UpdatedFile[];
};

type Props = {
  groups: DiffModalGroup[];
  initialFile: UpdatedFile | null;
  onClose: () => void;
  baseDir: string;
  taskId: string;
  openInWindowUrl?: string;
  openInWindowTitle?: string;
};

export const UpdatedFilesDiffModal = ({ groups, initialFile, onClose, baseDir, taskId, openInWindowUrl, openInWindowTitle }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [currentFile, setCurrentFile] = useState<UpdatedFile | null>(initialFile);
  const [diffViewMode, setDiffViewMode] = useLocalStorage<DiffViewMode>('updated-files-diff-view-mode', DiffViewMode.SideBySide);
  const [activeLineInfo, setActiveLineInfo] = useState<{
    lineKey: string;
    lineInfo: PierreLineClickInfo;
    viewportRect: { top: number; left: number };
    filePath: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const { isCommitting, commit, cancelCommit } = useCommitChanges(baseDir, taskId);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [isAllFilesView, setIsAllFilesView] = useLocalStorage('diff-modal-all-files-view', false);
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [createNewTask, setCreateNewTask] = useState(false);
  const [deselectedFilePaths, setDeselectedFilePaths] = useState<Set<string>>(new Set());
  const [editCommentActiveLineInfo, setEditCommentActiveLineInfo] = useState<{
    commentId: string;
    viewportRect: { top: number; left: number };
    initialText: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const isScrollDrivenUpdateRef = useRef(false);

  // Full file context for the current file (single-file view), loaded on demand via the header button.
  // Tracks which file is expanded so switching files collapses automatically.
  const { contents: currentFileContents, loading: contentsLoading, load: loadCurrentFileContents } = useUpdatedFileContents(baseDir, taskId, currentFile);
  // Lazily fetched diff for the current file (single-file view)
  const currentFileDiff = useUpdatedFileDiff(baseDir, taskId, currentFile);

  // Sort each group's files to match the sidebar tree order so the all-files view,
  // navigation and scroll spy agree with the sidebar
  const orderedGroups = useMemo(() => groups.map((group) => ({ ...group, files: sortFilesByTreeOrder(group.files) })), [groups]);

  // Flatten groups into a single file list for navigation
  const flatFiles = useMemo(() => {
    return orderedGroups.flatMap((group) => group.files);
  }, [orderedGroups]);

  // Files eligible for commit: only uncommitted files (committed files are shown for reference only)
  const committableFiles = useMemo(() => orderedGroups.filter((g) => !g.commitHash).flatMap((g) => g.files), [orderedGroups]);

  // Files selected for commit: all committable files minus explicitly deselected ones
  const selectedFiles = useMemo(() => committableFiles.filter((f) => !deselectedFilePaths.has(f.path)), [committableFiles, deselectedFilePaths]);
  const selectedFilePaths = useMemo(() => new Set(selectedFiles.map((f) => f.path)), [selectedFiles]);

  // Reset selection to all files whenever the committable file list changes (e.g. after a commit)
  const committableFilePathsKey = useMemo(() => committableFiles.map((f) => f.path).join('\n'), [committableFiles]);
  useEffect(() => {
    setDeselectedFilePaths(new Set());
  }, [committableFilePathsKey]);

  const handleToggleFileSelection = useCallback((filePath: string, selected: boolean) => {
    setDeselectedFilePaths((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const handleToggleFolderSelection = useCallback((filePaths: string[], selected: boolean) => {
    setDeselectedFilePaths((prev) => {
      const next = new Set(prev);
      for (const filePath of filePaths) {
        if (selected) {
          next.delete(filePath);
        } else {
          next.add(filePath);
        }
      }
      return next;
    });
  }, []);

  // Find the position of a file in the flat list, matching by path and commitHash.
  // When commitHash is undefined/null, the file belongs to the uncommitted group.
  const findFilePosition = useCallback(
    (file: UpdatedFile): number => {
      return flatFiles.findIndex((f) => f.path === file.path && f.commitHash === file.commitHash);
    },
    [flatFiles],
  );

  // Derive current position from the active file object
  const currentPosition = currentFile ? findFilePosition(currentFile) : -1;

  // Cumulative file counts per group for rendering offsets in all-files view
  const groupFileOffsets = useMemo(() => {
    const offsets: number[] = [];
    let offset = 0;
    for (const group of orderedGroups) {
      offsets.push(offset);
      offset += group.files.length;
    }
    return offsets;
  }, [orderedGroups]);

  // Derive current group by matching commitHash — uncommitted when commitHash is absent
  const currentGroup = currentFile
    ? (orderedGroups.find((g) => (currentFile.commitHash ? g.commitHash === currentFile.commitHash : !g.commitHash)) ?? null)
    : null;

  const resetLineState = useCallback(() => {
    setActiveLineInfo(null);
    setEditCommentActiveLineInfo(null);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentPosition > 0) {
      setCurrentFile(flatFiles[currentPosition - 1]);
      resetLineState();
    }
  }, [currentPosition, flatFiles, resetLineState]);

  const handleNext = useCallback(() => {
    if (currentPosition >= 0 && currentPosition < flatFiles.length - 1) {
      setCurrentFile(flatFiles[currentPosition + 1]);
      resetLineState();
    }
  }, [currentPosition, flatFiles, resetLineState]);

  const handleDiffViewModeChange = useCallback(
    (value: string) => {
      setDiffViewMode(value as DiffViewMode);
    },
    [setDiffViewMode],
  );

  const handleLineClick = useCallback((lineInfo: PierreLineClickInfo, filePath: string) => {
    setActiveLineInfo({
      lineKey: `${lineInfo.side}-${lineInfo.lineNumber}`,
      lineInfo,
      viewportRect: lineInfo.viewportRect,
      filePath,
    });
  }, []);

  const handleCommentCancel = useCallback(() => {
    resetLineState();
  }, [resetLineState]);

  const handleCommentSubmit = useCallback(
    (comment: string) => {
      if (!activeLineInfo || isSubmitting) {
        return;
      }

      const newComment: PendingComment = {
        id: `${activeLineInfo.filePath}-${activeLineInfo.lineInfo.lineNumber}-${Date.now()}`,
        filePath: activeLineInfo.filePath,
        lineNumber: activeLineInfo.lineInfo.lineNumber,
        lineKey: activeLineInfo.lineKey,
        comment,
      };

      setPendingComments((prev) => [...prev, newComment]);
      resetLineState();
    },
    [activeLineInfo, isSubmitting, resetLineState],
  );

  const handleRemoveComment = useCallback(
    (id: string) => {
      setPendingComments((prev) => prev.filter((c) => c.id !== id));
      if (editCommentActiveLineInfo?.commentId === id) {
        setEditCommentActiveLineInfo(null);
      }
    },
    [editCommentActiveLineInfo],
  );

  const handleEditCommentFromDiffViewer = useCallback(
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

  const handleUpdateComment = useCallback((id: string, comment: string) => {
    setPendingComments((prev) => prev.map((c) => (c.id === id ? { ...c, comment } : c)));
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
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to submit change requests:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [api, baseDir, taskId, pendingComments, isSubmitting, onClose, createNewTask]);

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

  const handleGenerateMessage = useCallback(async () => {
    setIsGeneratingMessage(true);
    try {
      const message = await api.generateCommitMessage(
        baseDir,
        taskId,
        selectedFiles.map((f) => f.path),
      );
      setCommitMessage(message);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to generate commit message:', error);
    } finally {
      setIsGeneratingMessage(false);
    }
  }, [api, baseDir, taskId, selectedFiles]);

  const handleCommit = useCallback(async () => {
    // Allow empty message only when amending
    if (!commitMessage.trim() && !amend) {
      return;
    }

    setCommitError(null);
    try {
      await commit(
        commitMessage,
        amend,
        selectedFiles.map((f) => f.path),
      );
      setCommitMessage('');
      setAmend(false);
      onClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to commit changes:', error);
      // Strip the Electron IPC wrapper prefix so only the actual backend error is shown
      const rawError = error instanceof Error ? error.message : String(error);
      setCommitError(rawError.replace(/^Error invoking remote method 'commit-changes':\s*(Error:\s*)?/, ''));
    }
  }, [commit, commitMessage, amend, onClose, selectedFiles]);

  const handleCancelCommit = useCallback(() => {
    cancelCommit();
  }, [cancelCommit]);

  const handleToggleViewMode = useCallback(() => {
    setIsAllFilesView((prev) => !prev);
    resetLineState();
  }, [resetLineState, setIsAllFilesView]);

  const scrollToFile = useCallback(
    (file: UpdatedFile) => {
      const pos = findFilePosition(file);
      if (pos === -1) {
        return;
      }

      const fileId = `diff-file-${pos}`;
      const element = document.getElementById(fileId);
      if (element) {
        if (isAllFilesView) {
          const container = scrollContainerRef.current;
          if (container) {
            // Place the file header right below the sticky group header at the
            // top of the scroll view (viewport-rect based, so it is stable even
            // for deep nesting)
            const computeTargetTop = (): number => {
              const rect = element.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const header = container.querySelector<HTMLElement>('.sticky.top-0.z-10');
              const headerHeight = header?.getBoundingClientRect().height ?? 0;
              return container.scrollTop + rect.top - containerRect.top - headerHeight - (header ? 8 : 0);
            };

            programmaticScrollRef.current = true;

            // Pin the file header at the top while diffs above it are lazily
            // loading (they grow the content and would otherwise push the
            // target file down). The pin is cancelled as soon as the user
            // scrolls manually.
            let isCancelled = false;
            const cancelPin = () => {
              isCancelled = true;
            };
            container.addEventListener('wheel', cancelPin, { once: true, passive: true });

            const startTime = performance.now();
            const pinScroll = () => {
              if (isCancelled || performance.now() - startTime > 1500) {
                container.removeEventListener('wheel', cancelPin);
                programmaticScrollRef.current = false;
                return;
              }
              container.scrollTo({ top: computeTargetTop() });
              requestAnimationFrame(pinScroll);
            };

            container.scrollTo({ top: computeTargetTop() });
            requestAnimationFrame(pinScroll);
          }
        } else {
          element.scrollIntoView({ block: 'start' });
        }
        setCurrentFile(flatFiles[pos]);
      }
    },
    [flatFiles, findFilePosition, isAllFilesView],
  );

  const handleFileSelect = useCallback(
    (file: UpdatedFile) => {
      setCurrentFile(file);
      resetLineState();
      if (isAllFilesView) {
        scrollToFile(file);
      }
    },
    [isAllFilesView, resetLineState, scrollToFile],
  );

  const handlePreviousInAllFiles = useCallback(() => {
    if (currentPosition > 0) {
      scrollToFile(flatFiles[currentPosition - 1]);
    }
  }, [currentPosition, flatFiles, scrollToFile]);

  const handleNextInAllFiles = useCallback(() => {
    if (currentPosition >= 0 && currentPosition < flatFiles.length - 1) {
      scrollToFile(flatFiles[currentPosition + 1]);
    }
  }, [currentPosition, flatFiles, scrollToFile]);

  const diffViewOptions = useMemo(
    () => [
      { label: t('diffViewer.sideBySide'), value: DiffViewMode.SideBySide },
      { label: t('diffViewer.unified'), value: DiffViewMode.Unified },
    ],
    [t],
  );

  // Tracks which file is expanded so switching files collapses automatically.
  const [expandedFileKey, setExpandedFileKey] = useState<string | null>(null);
  const currentFileKey = currentFile ? `${currentFile.commitHash ?? 'uncommitted'}:${currentFile.path}` : null;
  const showFullContext = expandedFileKey !== null && expandedFileKey === currentFileKey;

  const handleToggleExpandContext = useCallback(() => {
    if (!showFullContext) {
      loadCurrentFileContents();
      setExpandedFileKey(currentFileKey);
    } else {
      setExpandedFileKey(null);
    }
  }, [showFullContext, loadCurrentFileContents, currentFileKey]);

  const handleLoadLargeDiff = useCallback(() => {
    currentFileDiff.load();
  }, [currentFileDiff]);

  const currentFileComments = useMemo<DiffComment[]>(
    () => pendingComments.filter((c) => c.filePath === currentFile?.path).map((c) => ({ id: c.id, lineNumber: c.lineNumber, comment: c.comment })),
    [pendingComments, currentFile],
  );

  const getCommentsForFile = useCallback(
    (filePath: string): DiffComment[] =>
      pendingComments.filter((c) => c.filePath === filePath).map((c) => ({ id: c.id, lineNumber: c.lineNumber, comment: c.comment })),
    [pendingComments],
  );

  const canGoPrevious = currentPosition > 0;
  const canGoNext = currentPosition >= 0 && currentPosition < flatFiles.length - 1;

  useHotkeys('left', handlePrevious, { enabled: canGoPrevious });
  useHotkeys('right', handleNext, { enabled: canGoNext });

  useHotkeys('escape', resetLineState, { enabled: !!activeLineInfo });

  // Sync currentFile when initialFile prop changes (user clicks a different file)
  useEffect(() => {
    if (initialFile) {
      setCurrentFile(initialFile);
    }
  }, [initialFile]);

  // Scroll to the active file when in view-all mode
  useEffect(() => {
    if (isScrollDrivenUpdateRef.current) {
      isScrollDrivenUpdateRef.current = false;
      return;
    }
    if (isAllFilesView && initialFile) {
      scrollToFile(initialFile);
    }
  }, [isAllFilesView, initialFile, scrollToFile]);

  // Scroll spy: update currentFile based on scroll position in all-files view
  useEffect(() => {
    if (!isAllFilesView) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      if (programmaticScrollRef.current) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const header = container.querySelector<HTMLElement>('.sticky.top-0.z-10');
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const threshold = containerRect.top + headerHeight + (header ? 8 : 0);

      let bestIdx = -1;

      for (let i = 0; i < flatFiles.length; i++) {
        const element = document.getElementById(`diff-file-${i}`);
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top <= threshold) {
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        isScrollDrivenUpdateRef.current = true;
        setCurrentFile(flatFiles[bestIdx]);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAllFilesView, flatFiles]);

  useEffect(() => {
    resetLineState();
  }, [resetLineState, currentFile]);

  // Whether data is in flat mode (single group with no commit hashes)
  const isFlatMode = orderedGroups.length === 1 && !orderedGroups[0].commitHash;

  // Render a group section header for the all-files view
  const renderGroupHeader = useCallback(
    (group: DiffModalGroup) => {
      const isUncommitted = !group.commitHash;
      // Skip rendering header for flat mode single group
      if (isFlatMode) {
        return null;
      }

      return (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary border border-border-dark sticky top-0 z-10">
          <MdOutlineCommit className="h-3.5 w-3.5 text-text-muted shrink-0" />
          {isUncommitted ? (
            <span className="text-xs font-medium text-text-secondary uppercase">{t('contextFiles.uncommitted')}</span>
          ) : (
            <>
              <Tooltip content={group.commitMessage || ''}>
                <span className="text-xs font-medium text-text-secondary font-mono">{group.commitHash?.slice(0, 7)}</span>
              </Tooltip>
              {group.commitMessage && <span className="text-xs text-text-muted truncate">{group.commitMessage}</span>}
            </>
          )}
        </div>
      );
    },
    [t, isFlatMode],
  );

  if (!currentFile) {
    return null;
  }

  return (
    <ModalOverlayLayout
      title={t('contextFiles.updatedFiles')}
      onClose={onClose}
      closeOnEscape={true}
      openInWindowUrl={openInWindowUrl}
      openInWindowTitle={openInWindowTitle}
    >
      {/* Main content area: file sidebar on left (full height), header + diff viewer center, comments panel right */}
      <div className="flex-1 flex overflow-hidden">
        {flatFiles.length > 1 && (
          <DiffFilesSidebar
            groups={groups}
            currentFile={currentFile}
            onFileSelect={handleFileSelect}
            selectedFilePaths={selectedFilePaths}
            onToggleFileSelection={handleToggleFileSelection}
            onToggleFolderSelection={handleToggleFolderSelection}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center border-b border-border-default justify-center bg-bg-secondary h-11 px-4">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                {/* Group badge in single-file mode */}
                {!isAllFilesView && currentGroup && (
                  <span
                    className={clsx(
                      'text-2xs font-medium px-1.5 py-0.5 rounded shrink-0',
                      !currentGroup.commitHash ? 'bg-bg-tertiary text-text-secondary' : 'bg-accent-primary/10 text-accent-primary',
                    )}
                  >
                    {!currentGroup.commitHash ? t('contextFiles.uncommitted') : currentGroup.commitHash?.slice(0, 7)}
                  </span>
                )}
                <span className="text-3xs sm:text-xs font-medium text-text-primary truncate">{currentFile.path}</span>
                <>
                  {currentFile.additions > 0 && <span className="text-3xs sm:text-xs font-medium text-success shrink-0">+{currentFile.additions}</span>}
                  {currentFile.deletions > 0 && <span className="text-3xs sm:text-xs font-medium text-error shrink-0">-{currentFile.deletions}</span>}
                </>
                {!isAllFilesView && (
                  <IconButton
                    icon={
                      contentsLoading && showFullContext ? (
                        <CgSpinner className="h-4 w-4 animate-spin" />
                      ) : showFullContext ? (
                        <MdUnfoldLess className="h-4 w-4" />
                      ) : (
                        <MdUnfoldMore className="h-4 w-4" />
                      )
                    }
                    onClick={handleToggleExpandContext}
                    tooltip={showFullContext ? t('contextFiles.collapseContext') : t('contextFiles.expandContext')}
                    className={clsx(
                      'p-1.5 rounded-md transition-colors',
                      showFullContext ? 'text-text-primary hover:bg-bg-tertiary' : 'hover:bg-bg-tertiary text-text-secondary',
                    )}
                  />
                )}
                {(!currentFile.commitHash || isFlatMode) && (
                  <IconButton
                    icon={<MdUndo className="h-4 w-4" />}
                    onClick={handleRevertClick}
                    tooltip={t('contextFiles.revertFile')}
                    className="p-1.5 rounded-md transition-colors hover:bg-bg-tertiary text-text-secondary"
                  />
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <div className="hidden sm:block">
                  <CompactSelect options={diffViewOptions} value={diffViewMode || DiffViewMode.SideBySide} onChange={handleDiffViewModeChange} />
                </div>
                {flatFiles.length > 1 && (
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={<HiChevronLeft className="h-5 w-5" />}
                      onClick={isAllFilesView ? handlePreviousInAllFiles : handlePrevious}
                      tooltip={t('common.previous')}
                      disabled={!canGoPrevious}
                      className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        canGoPrevious ? 'hover:bg-bg-tertiary text-text-secondary' : 'text-text-muted cursor-not-allowed',
                      )}
                    />
                    <span className="text-xs sm:text-sm text-text-secondary min-w-[60px] text-center">
                      {currentPosition + 1} / {flatFiles.length}
                    </span>
                    <IconButton
                      icon={<HiChevronRight className="h-5 w-5" />}
                      onClick={isAllFilesView ? handleNextInAllFiles : handleNext}
                      tooltip={t('common.next')}
                      disabled={!canGoNext}
                      className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        canGoNext ? 'hover:bg-bg-tertiary text-text-secondary' : 'text-text-muted cursor-not-allowed',
                      )}
                    />
                    <IconButton
                      icon={<HiViewList className="h-4 w-4" />}
                      onClick={handleToggleViewMode}
                      tooltip={isAllFilesView ? t('contextFiles.viewSingleFile') : t('contextFiles.viewAllFiles')}
                      className={clsx(
                        'p-1.5 rounded-md transition-colors',
                        isAllFilesView ? 'bg-bg-tertiary text-text-primary' : 'hover:bg-bg-tertiary text-text-secondary',
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Diff viewer with its own scroll - scrollbar right next to the file */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto bg-bg-primary-light scrollbar scrollbar-thumb-bg-tertiary scrollbar-track-transparent relative"
          >
            {activeLineInfo && <DiffLineCommentPanel onSubmit={handleCommentSubmit} onCancel={handleCommentCancel} anchorRect={activeLineInfo.viewportRect} />}
            {editCommentActiveLineInfo && (
              <DiffLineCommentPanel
                initialText={editCommentActiveLineInfo.initialText}
                onSubmit={handleEditCommentSubmit}
                onCancel={handleEditCommentCancel}
                anchorRect={editCommentActiveLineInfo.viewportRect}
              />
            )}
            <div className="p-4">
              {isAllFilesView ? (
                <div className="space-y-4">
                  {orderedGroups.map((group, gi) => (
                    <div key={group.id}>
                      {renderGroupHeader(group)}
                      <div className={isFlatMode ? 'space-y-3' : 'space-y-3 mt-3'}>
                        {group.files.map((file, fi) => {
                          const flatIdx = groupFileOffsets[gi] + fi;
                          return (
                            <DiffFileItem
                              key={`${file.path}-${gi}`}
                              file={file}
                              index={flatIdx}
                              baseDir={baseDir}
                              taskId={taskId}
                              diffViewMode={diffViewMode || DiffViewMode.SideBySide}
                              selectedLineNumber={activeLineInfo?.filePath === file.path ? activeLineInfo.lineInfo.lineNumber : null}
                              onLineClick={handleLineClick}
                              comments={getCommentsForFile(file.path)}
                              onEditComment={handleEditCommentFromDiffViewer}
                              onRemoveComment={handleRemoveComment}
                              stickyHeader
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="select-text bg-bg-code-block rounded-lg px-4 py-2 text-xs relative">
                  {currentFileDiff.isLarge && currentFileDiff.diff === null && !currentFileDiff.loading ? (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <p className="text-xs text-text-muted">
                        {t('contextFiles.largeDiffMessage', { count: (currentFile?.additions ?? 0) + (currentFile?.deletions ?? 0) })}
                      </p>
                      <Button variant="contained" size="xs" onClick={handleLoadLargeDiff}>
                        {t('contextFiles.largeDiffLoad')}
                      </Button>
                    </div>
                  ) : currentFileDiff.loading ? (
                    <div className="flex items-center justify-center py-10">
                      <CgSpinner className="text-3xl text-text-muted animate-spin" />
                    </div>
                  ) : (
                    <PierreDiffViewer
                      udiff={currentFileDiff.diff ?? ''}
                      contents={currentFileContents}
                      expandContext={showFullContext && !!currentFileContents}
                      fileName={currentFile.path}
                      viewMode={diffViewMode || DiffViewMode.SideBySide}
                      showFilename={false}
                      selectedLineNumber={activeLineInfo?.filePath === currentFile.path ? activeLineInfo.lineInfo.lineNumber : null}
                      onLineClick={(lineInfo) => handleLineClick(lineInfo, currentFile.path)}
                      comments={currentFileComments}
                      onEditComment={handleEditCommentFromDiffViewer}
                      onRemoveComment={handleRemoveComment}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Comments panel */}
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

      {/* Footer */}
      <div className="flex items-center border-t border-border-default justify-center bg-bg-secondary px-4 py-3">
        <div className="flex flex-col w-full gap-3 max-w-6xl">
          {/* Commit section */}
          {commitError && (
            <div className="border border-border-default bg-bg-primary-light rounded-md p-3 max-h-40 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
              <div className="text-xs font-medium text-error mb-1">{t('contextFiles.commitError')}</div>
              <div className="text-xs text-error whitespace-pre-wrap font-mono select-text">{commitError}</div>
            </div>
          )}

          {selectedFiles.length < committableFiles.length && (
            <div className="text-xs text-text-secondary">
              {t('contextFiles.selectedFilesToCommit', { count: selectedFiles.length, total: committableFiles.length })}
            </div>
          )}

          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex-1 min-w-0 relative">
              <TextArea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={
                  isGeneratingMessage
                    ? t('contextFiles.generatingMessage')
                    : amend
                      ? t('contextFiles.commitMessagePlaceholderAmend')
                      : t('contextFiles.commitMessagePlaceholder')
                }
                rows={1}
                disabled={isGeneratingMessage || isCommitting}
                className="text-xs"
                wrapperClassName="flex flex-col"
              />
              <div className="absolute top-1.5 right-1">
                <IconButton
                  icon={isGeneratingMessage ? <HiSparkles className="h-4 w-4 animate-pulse" /> : <HiSparkles className="h-4 w-4" />}
                  onClick={handleGenerateMessage}
                  tooltip={t('contextFiles.generateMessage')}
                  disabled={isGeneratingMessage || isCommitting}
                  className={clsx(
                    'p-1 rounded-md transition-colors',
                    isGeneratingMessage || isCommitting
                      ? 'text-text-muted cursor-not-allowed'
                      : 'hover:bg-bg-tertiary text-accent-primary hover:text-accent-primary-light',
                  )}
                />
              </div>
            </div>

            <div className="flex items-center shrink-0 gap-2 pr-4">
              <Checkbox checked={amend} onChange={setAmend} label={t('contextFiles.amend')} tooltip={t('contextFiles.amendTooltip')} size="xs" />
              <Button
                onClick={handleCommit}
                disabled={(!commitMessage.trim() && !amend) || isCommitting || isGeneratingMessage || (selectedFiles.length === 0 && !amend)}
                variant="contained"
                color="primary"
                size="sm"
              >
                {isCommitting ? (
                  <>
                    <CgSpinner className="h-4 w-4 mr-1 animate-spin" />
                    {t('contextFiles.committing')}
                  </>
                ) : (
                  <>
                    <MdOutlineCommit className="h-4 w-4 mr-1" />
                    {t('contextFiles.commit')}
                  </>
                )}
              </Button>
              {isCommitting && (
                <IconButton
                  icon={<MdClose className="h-4 w-4" />}
                  onClick={handleCancelCommit}
                  tooltip={t('contextFiles.cancelCommit')}
                  className="p-1.5 rounded-md transition-colors hover:bg-bg-tertiary text-text-muted"
                />
              )}
            </div>
          </div>
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
