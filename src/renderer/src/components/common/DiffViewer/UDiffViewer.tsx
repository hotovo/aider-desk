import { useMemo, MouseEvent, useCallback } from 'react';
import { Diff, Hunk, parseDiff, getChangeKey } from 'react-diff-view';
import { DiffViewMode } from '@common/types';
import { clsx } from 'clsx';

import { createTokens } from './utils';

import type { ChangeData, HunkData } from 'react-diff-view';
import type { NormalChange } from 'gitdiff-parser';

import 'react-diff-view/style/index.css';
import './DiffViewer.scss';

import { useResponsive } from '@/hooks/useResponsive';

export type LineClickInfo = {
  lineKey: string;
  change: ChangeData;
  lineNumber: number;
  content: string;
};

type Props = {
  udiff: string;
  language: string;
  viewMode?: DiffViewMode;
  showFilename?: boolean;
  onLineClick?: (lineInfo: LineClickInfo, event: MouseEvent) => void;
  activeLineKey?: string | null;
};

export const UDiffViewer = ({ udiff, language, viewMode = DiffViewMode.SideBySide, showFilename = true, onLineClick, activeLineKey }: Props) => {
  const { isMobile } = useResponsive();
  const parsedFiles = useMemo(() => {
    try {
      return parseDiff(udiff, { nearbySequences: 'zip' });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error parsing udiff:', error);
      return [];
    }
  }, [udiff]);

  const handleCodeClick = useCallback(
    ({ change }: { change: ChangeData | null }, event: MouseEvent) => {
      if (onLineClick && change) {
        const lineKey = getChangeKey(change);
        const lineNumber = change.type === 'normal' ? (change as NormalChange).newLineNumber : change.lineNumber;
        const content = change.content;

        onLineClick({ lineKey, change, lineNumber, content }, event);
      }
    },
    [onLineClick],
  );

  const codeEvents = useMemo(
    () => ({
      onClick: handleCodeClick,
    }),
    [handleCodeClick],
  );

  if (parsedFiles.length === 0) {
    return <span>{udiff}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      {parsedFiles.map((file, index) => {
        const tokens = createTokens(file.hunks, language);

        return (
          <div key={index} className="diff-viewer-container">
            {showFilename && (
              <div className="text-xs font-semibold text-text-secondary mb-2">
                {file.oldPath !== file.newPath ? (
                  <span>
                    {file.oldPath} → {file.newPath}
                  </span>
                ) : (
                  <span>{file.newPath}</span>
                )}
              </div>
            )}
            <Diff
              viewType={isMobile || viewMode === DiffViewMode.Unified ? 'unified' : 'split'}
              diffType={file.type}
              hunks={file.hunks}
              className={clsx('diff-viewer', !!onLineClick && 'selectable')}
              optimizeSelection={true}
              tokens={tokens}
              selectedChanges={activeLineKey ? [activeLineKey] : []}
              codeEvents={codeEvents}
            >
              {(hunks: HunkData[]) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          </div>
        );
      })}
    </div>
  );
};
