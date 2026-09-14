import { useCallback, useEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import { HiChevronDown } from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';
import { MdOutlineCommit } from 'react-icons/md';
import { CgSpinner } from 'react-icons/cg';
import { RiAlertLine } from 'react-icons/ri';
import { DiffViewMode, UpdatedFile } from '@common/types';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { Tooltip } from '@/components/ui/Tooltip';
import { Button } from '@/components/common/Button';
import { PierreDiffViewer, PierreLineClickInfo, type DiffComment } from '@/components/common/DiffViewer';
import { useUpdatedFileDiff } from '@/hooks/useUpdatedFileDiff';

type Props = {
  file: UpdatedFile;
  index: number;
  baseDir: string;
  taskId: string;
  diffViewMode: DiffViewMode;
  selectedLineNumber?: number | null;
  onLineClick: (lineInfo: PierreLineClickInfo, filePath: string) => void;
  comments?: DiffComment[];
  onEditComment?: (info: { commentId: string; viewportRect: { top: number; left: number } }) => void;
  onRemoveComment?: (commentId: string) => void;
  stickyHeader?: boolean;
};

export const DiffFileItem = ({
  file,
  index,
  baseDir,
  taskId,
  diffViewMode,
  selectedLineNumber,
  onLineClick,
  comments,
  onEditComment,
  onRemoveComment,
  stickyHeader,
}: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  // Diffs are fetched lazily only when the file item scrolls into the viewport
  const [isVisible, setIsVisible] = useState(false);
  const { diff, loading, isLarge, load: loadLargeDiff } = useUpdatedFileDiff(baseDir, taskId, file, isVisible);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleLoadLargeDiff = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      loadLargeDiff();
    },
    [loadLargeDiff],
  );

  const handleLineClick = useCallback(
    (lineInfo: PierreLineClickInfo) => {
      onLineClick(lineInfo, file.path);
    },
    [onLineClick, file.path],
  );

  const fileComments = useMemo(() => comments ?? [], [comments]);

  return (
    <div
      ref={containerRef}
      id={`diff-file-${index}`}
      className={clsx('select-text bg-bg-code-block rounded-lg text-xs relative', stickyHeader && !isExpanded ? 'overflow-hidden' : '')}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center gap-2 p-3 hover:bg-bg-tertiary transition-colors',
          stickyHeader && 'sticky top-0 z-[5] bg-bg-code-block rounded-t-lg',
        )}
      >
        <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <HiChevronDown className="h-4 w-4 text-text-secondary" />
        </motion.div>
        <span className="text-xs font-medium text-text-primary truncate text-left flex-1">{file.path}</span>
        {file.additions > 0 && <span className="text-xs font-medium text-success shrink-0">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-xs font-medium text-error shrink-0">-{file.deletions}</span>}
        {file.commitHash && (
          <span className="text-xs text-text-secondary shrink-0 flex items-center gap-1">
            <MdOutlineCommit className="h-3 w-3" />
            {file.commitHash.substring(0, 7)}
          </span>
        )}
        {file.hasConflicts && (
          <Tooltip content={t('contextFiles.fileHasConflicts')}>
            <RiAlertLine className="h-4 w-4 text-warning shrink-0" />
          </Tooltip>
        )}
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 border-t border-border-default relative">
              {isLarge && diff === null && !loading ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <p className="text-xs text-text-muted">{t('contextFiles.largeDiffMessage', { count: file.additions + file.deletions })}</p>
                  <Button variant="contained" size="sm" onClick={handleLoadLargeDiff}>
                    {t('contextFiles.largeDiffLoad')}
                  </Button>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-8">
                  <CgSpinner className="text-2xl text-text-muted animate-spin" />
                </div>
              ) : (
                <PierreDiffViewer
                  udiff={diff ?? ''}
                  viewMode={diffViewMode}
                  showFilename={false}
                  selectedLineNumber={selectedLineNumber}
                  onLineClick={handleLineClick}
                  comments={fileComments}
                  onEditComment={onEditComment}
                  onRemoveComment={onRemoveComment}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
