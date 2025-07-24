import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import { diffLines, formatLines } from 'unidiff';

import { createTokens } from './utils';

import 'react-diff-view/style/index.css';
import './DiffViewer.scss';

type Props = {
  oldValue: string;
  newValue: string;
  language: string;
};

export const DiffViewer = ({ oldValue, newValue, language }: Props) => {
  const { t } = useTranslation();

  const diffComputationResult = useMemo(() => {
    try {
      const diffText = formatLines(diffLines(oldValue, newValue), { context: 100 });
      const [parsedFile] = parseDiff(diffText, { nearbySequences: 'zip' });
      return { file: parsedFile, error: null };
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      // eslint-disable-next-line no-console
      console.error('Error generating diff:', error);
      return { file: undefined, error: error };
    }
  }, [oldValue, newValue]);

  const { file: diffFile, error: diffError } = diffComputationResult;

  const tokens = useMemo(() => {
    if (diffError || !diffFile || !diffFile.hunks) {
      return undefined;
    }
    return createTokens(diffFile.hunks, language);
  }, [diffFile, language, diffError]);

  if (diffError) {
    return (
      <div className="flex w-full flex-col">
        <div className="flex w-full">
          <div className="flex-1 overflow-auto px-4 py-3 border-r border-neutral-850">
            <h3 className="mt-0 mb-2 text-xs font-semibold text-neutral-200">Old Value</h3>
            <pre className="whitespace-pre-wrap break-words m-0 text-2xs text-neutral-100 leading-normal bg-neutral-850 px-3 py-2 rounded">{oldValue}</pre>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3">
            <h3 className="mt-0 mb-2 text-xs font-semibold text-neutral-200">New Value</h3>
            <pre className="whitespace-pre-wrap break-words m-0 text-2xs text-neutral-100 leading-normal bg-neutral-850 px-3 py-2 rounded">{newValue}</pre>
          </div>
        </div>
        {diffError.message && (
          <div className="w-full px-4 py-2 bg-red-900/50 text-red-300  text-xs text-center">
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
    return <div className="flex w-full justify-center items-center py-4 text-neutral-400 text-xs">{t('diffViewer.noChanges')}</div>;
  }

  return (
    <Diff viewType="split" diffType={diffFile.type} hunks={diffFile.hunks} className="diff-viewer" optimizeSelection={true} tokens={tokens}>
      {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
    </Diff>
  );
};
