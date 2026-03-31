import { MouseEvent, useCallback, useState } from 'react';
import { HiChevronDown } from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';
import { MdOutlineCommit } from 'react-icons/md';
import { DiffViewMode, UpdatedFile } from '@common/types';
import { getLanguageFromPath } from '@common/utils';

import { CompactDiffViewer, DiffLineCommentPanel, LineClickInfo, UDiffViewer } from '@/components/common/DiffViewer';

type Props = {
  file: UpdatedFile;
  index: number;
  diffViewMode: DiffViewMode;
  activeLineInfo: {
    lineKey: string;
    lineInfo: LineClickInfo;
    position: { top: number; left: number };
    filePath: string;
  } | null;
  onLineClick: (lineInfo: LineClickInfo, event: MouseEvent, filePath: string) => void;
  onCommentSubmit: (comment: string, createNewTask: boolean) => void;
  onCommentCancel: () => void;
};

export const DiffFileItem = ({ file, index, diffViewMode, activeLineInfo, onLineClick, onCommentSubmit, onCommentCancel }: Props) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const fileLanguage = file.path ? getLanguageFromPath(file.path) : 'text';

  return (
    <div id={`diff-file-${index}`} className="select-text bg-bg-code-block rounded-lg text-xs relative overflow-hidden">
      <button type="button" onClick={handleToggle} className="w-full flex items-center gap-2 p-3 hover:bg-bg-tertiary transition-colors">
        <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <HiChevronDown className="h-4 w-4 text-text-secondary" />
        </motion.div>
        <span className="text-xs font-medium text-text-primary truncate text-left flex-1" title={file.path}>
          {file.path}
        </span>
        {file.additions > 0 && <span className="text-xs font-medium text-success shrink-0">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-xs font-medium text-error shrink-0">-{file.deletions}</span>}
        {file.commitHash && (
          <span className="text-xs text-text-secondary shrink-0 flex items-center gap-1" title={file.commitMessage}>
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
              {diffViewMode === DiffViewMode.Compact ? (
                <CompactDiffViewer udiff={file.diff || ''} language={fileLanguage} showFilename={false} />
              ) : (
                <UDiffViewer
                  udiff={file.diff || ''}
                  language={fileLanguage}
                  viewMode={diffViewMode}
                  showFilename={false}
                  onLineClick={(lineInfo, event) => onLineClick(lineInfo, event, file.path)}
                  activeLineKey={activeLineInfo?.filePath === file.path ? activeLineInfo.lineKey : undefined}
                />
              )}
              {activeLineInfo?.filePath === file.path && (
                <DiffLineCommentPanel onSubmit={onCommentSubmit} onCancel={onCommentCancel} position={activeLineInfo.position} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
