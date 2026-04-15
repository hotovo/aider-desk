import { useCallback, useMemo, useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';
import { MdOutlineCommit } from 'react-icons/md';
import { DiffViewMode, UpdatedFile } from '@common/types';

import { PierreDiffViewer, PierreLineClickInfo, type DiffComment } from '@/components/common/DiffViewer';

type Props = {
  file: UpdatedFile;
  index: number;
  diffViewMode: DiffViewMode;
  selectedLineNumber?: number | null;
  onLineClick: (lineInfo: PierreLineClickInfo, filePath: string) => void;
  comments?: DiffComment[];
  onEditComment?: (info: { commentId: string; viewportRect: { top: number; left: number } }) => void;
  onRemoveComment?: (commentId: string) => void;
};

export const DiffFileItem = ({ file, index, diffViewMode, selectedLineNumber, onLineClick, comments, onEditComment, onRemoveComment }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleLineClick = useCallback(
    (lineInfo: PierreLineClickInfo) => {
      onLineClick(lineInfo, file.path);
    },
    [onLineClick, file.path],
  );

  const fileComments = useMemo(() => comments ?? [], [comments]);

  return (
    <div id={`diff-file-${index}`} className="select-text bg-bg-code-block rounded-lg text-xs relative overflow-hidden">
      <button type="button" onClick={handleToggle} className="w-full flex items-center gap-2 p-3 hover:bg-bg-tertiary transition-colors">
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
              <PierreDiffViewer
                udiff={file.diff || ''}
                viewMode={diffViewMode}
                showFilename={false}
                selectedLineNumber={selectedLineNumber}
                onLineClick={handleLineClick}
                comments={fileComments}
                onEditComment={onEditComment}
                onRemoveComment={onRemoveComment}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
