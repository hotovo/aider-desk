import { useMemo } from 'react';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import { DiffViewMode } from '@common/types';

import { createTokens } from './utils';

import 'react-diff-view/style/index.css';
import './DiffViewer.scss';

import { useResponsive } from '@/hooks/useResponsive';

type Props = {
  udiff: string;
  language: string;
  viewMode?: DiffViewMode;
};

export const UDiffViewer = ({ udiff, language, viewMode = DiffViewMode.SideBySide }: Props) => {
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

  if (parsedFiles.length === 0) {
    return <span>{udiff}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      {parsedFiles.map((file, index) => {
        const tokens = createTokens(file.hunks, language);

        return (
          <div key={index} className="diff-viewer-container">
            <div className="text-xs font-semibold text-text-secondary mb-2">
              {file.oldPath !== file.newPath ? (
                <span>
                  {file.oldPath} → {file.newPath}
                </span>
              ) : (
                <span>{file.newPath}</span>
              )}
            </div>
            <Diff
              viewType={isMobile || viewMode === DiffViewMode.Unified ? 'unified' : 'split'}
              diffType={file.type}
              hunks={file.hunks}
              className="diff-viewer"
              optimizeSelection={true}
              tokens={tokens}
            >
              {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          </div>
        );
      })}
    </div>
  );
};
