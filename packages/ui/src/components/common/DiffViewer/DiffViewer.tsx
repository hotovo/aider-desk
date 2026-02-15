import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import { diffLines, formatLines } from 'unidiff';
import { useDebounce } from '@reactuses/core';
import { DiffViewMode } from '@aider-desk/common/types';

import { createTokens } from './utils';

import { useResponsive } from '@/hooks/useResponsive';

import 'react-diff-view/style/index.css';
import './DiffViewer.scss';

const DEBOUNCE_TIME = 100;

type Props = {
  oldValue: string;
  newValue: string;
  language: string;
  isComplete?: boolean;
  viewMode?: DiffViewMode;
};

export const DiffViewer = ({ oldValue, newValue, language, isComplete = false, viewMode = DiffViewMode.SideBySide }: Props) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();

  const debouncedOldValue = useDebounce(oldValue, DEBOUNCE_TIME, { leading: true, maxWait: DEBOUNCE_TIME });
  const debouncedNewValue = useDebounce(newValue, DEBOUNCE_TIME, { leading: true, maxWait: DEBOUNCE_TIME });

  const oldValueToUse = isComplete ? oldValue : debouncedOldValue;
  const newValueToUse = isComplete ? newValue : debouncedNewValue;

  const diffComputationResult = useMemo(() => {
    try {
      const diffText = formatLines(diffLines(oldValueToUse, newValueToUse), { context: 100 });
      const [parsedFile] = parseDiff(diffText, { nearbySequences: 'zip' });
      return { file: parsedFile, error: null };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      // eslint-disable-next-line no-console
      console.error('Error generating diff:', error);
      return { file: undefined, error: error };
    }
  }, [oldValueToUse, newValueToUse]);

  const { file: diffFile, error: diffError } = diffComputationResult;

  const tokens = useMemo(() => {
    if (diffError || !diffFile || !diffFile.hunks) {
      return undefined;
    }
    return createTokens(diffFile.hunks, language);
  }, [diffFile, language, diffError]);

  if (diffError) {
    return (
      <div className={`flex w-full ${isMobile ? 'flex-col' : ''}`}>
        <div className={`flex ${isMobile ? 'flex-col' : 'w-full'}`}>
          <div className={`flex-1 overflow-auto px-4 py-3 ${!isMobile ? 'border-r border-border-dark' : ''}`}>
            <h3 className="mt-0 mb-2 text-xs font-semibold text-text-secondary">Old Value</h3>
            <pre className="whitespace-pre-wrap break-words m-0 text-2xs text-text-primary leading-normal bg-bg-secondary px-3 py-2 rounded">
              {oldValueToUse}
            </pre>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3">
            <h3 className="mt-0 mb-2 text-xs font-semibold text-text-secondary">New Value</h3>
            <pre className="whitespace-pre-wrap break-words m-0 text-2xs text-text-primary leading-normal bg-bg-secondary px-3 py-2 rounded">
              {newValueToUse}
            </pre>
          </div>
        </div>
        {diffError.message && (
          <div className="w-full px-4 py-2 bg-info text-error-lighter text-xs text-center">
            Error: {diffError.message}
            <br />
            Please report an issue in https://github.com/hotovo/aider-desk/issues.
          </div>
        )}
      </div>
    );
  }

  if (!diffFile || !diffFile.hunks || diffFile.hunks.length === 0) {
    // No error, but no diff file (e.g., identical content)
    return <div className="flex w-full justify-center items-center py-4 text-text-muted-light text-xs">{t('diffViewer.noChanges')}</div>;
  }

  return (
    <Diff
      viewType={isMobile ? 'unified' : viewMode === DiffViewMode.Unified ? 'unified' : 'split'}
      diffType={diffFile.type}
      hunks={diffFile.hunks}
      className="diff-viewer"
      optimizeSelection={true}
      tokens={tokens}
    >
      {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
    </Diff>
  );
};
