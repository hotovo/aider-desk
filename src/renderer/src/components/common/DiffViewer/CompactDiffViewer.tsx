import React, { useMemo, FC } from 'react';
import { diffLines, formatLines } from 'unidiff';
import { getLanguageFromPath } from '@common/utils';
import { clsx } from 'clsx';
import { HiOutlineSelector } from 'react-icons/hi';

import { parseDiff, File, Hunk as HunkType, SkipBlock, Line as LineType } from './utils';

import { highlightWithRefractor } from '@/utils/highlighter';

interface DiffContextValue {
  language: string;
  fileStatus: File['type'];
}

const DiffContext = React.createContext<DiffContextValue | null>(null);

const useDiffContext = () => {
  const context = React.useContext(DiffContext);
  if (!context) {
    throw new Error('useDiffContext must be used within a Diff component');
  }
  return context;
};

export interface DiffProps extends React.TableHTMLAttributes<HTMLTableElement>, Pick<File, 'hunks' | 'type'> {
  fileName?: string;
  language?: string;
}

const Hunk = ({ hunk }: { hunk: HunkType | SkipBlock }) => {
  return hunk.type === 'hunk' ? (
    <>
      {hunk.lines.map((line, index) => (
        <Line key={index} line={line} />
      ))}
    </>
  ) : (
    <SkipBlockRow lines={hunk.count} content={hunk.content} />
  );
};

const Diff: React.FC<DiffProps> = ({ fileName, language = getLanguageFromPath(fileName), hunks, type, className, children, ...props }) => {
  return (
    <DiffContext.Provider value={{ language, fileStatus: type }}>
      <table
        {...props}
        className={clsx('font-mono text-[0.7rem] w-full m-0 border-separate border-0 outline-none overflow-x-auto border-spacing-0', className)}
      >
        <tbody className="w-full box-border">{children ?? hunks.map((hunk, index) => <Hunk key={index} hunk={hunk} />)}</tbody>
      </table>
    </DiffContext.Provider>
  );
};

const SkipBlockRow: React.FC<{
  lines: number;
  content?: string;
}> = ({ lines, content }) => (
  <>
    <tr className="h-4" />
    <tr className={clsx('h-10 font-mono bg-muted text-muted-foreground')}>
      <td></td>
      <td className="opacity-50 select-none text-center flex items-center justify-center h-10">
        <HiOutlineSelector className="size-4 mx-auto" />
      </td>
      <td>
        <span className="px-0 sticky left-2 italic opacity-50">{content || `${lines} lines hidden`}</span>
      </td>
    </tr>
    <tr className="h-4" />
  </>
);

const Line: React.FC<{
  line: LineType;
}> = ({ line }) => {
  const { language, fileStatus } = useDiffContext();
  const Tag = line.type === 'delete' ? 'del' : 'span';
  const lineNumberNew = line.type === 'normal' ? line.newLineNumber : line.lineNumber;
  const lineNumberOld = line.type === 'normal' ? line.oldLineNumber : undefined;

  return (
    <tr
      data-line-new={lineNumberNew ?? undefined}
      data-line-old={lineNumberOld ?? undefined}
      data-line-kind={line.type}
      className={clsx('whitespace-pre-wrap box-border border-none h-5 min-h-5', {
        'bg-[var(--color-bg-diff-viewer-new-secondary)]': line.type === 'insert' && fileStatus !== 'add',
        'bg-[var(--color-bg-diff-viewer-old-secondary)]': line.type === 'delete' && fileStatus !== 'delete',
      })}
    >
      <td
        className={clsx('border-transparent w-1 border-l-3', {
          'border-[var(--color-bg-diff-viewer-new-primary)]': line.type === 'insert',
          'border-[var(--color-bg-diff-viewer-old-primary)]': line.type === 'delete',
        })}
      />
      <td className="tabular-nums text-center opacity-50 px-2 text-xs select-none">{line.type === 'delete' ? '–' : lineNumberNew}</td>
      <td className="text-nowrap pr-6">
        <Tag className={`language-${language}`}>
          {line.content.map((seg, i) => (
            <span
              key={i}
              className={clsx({
                'bg-[var(--color-bg-diff-viewer-new-primary)]': seg.type === 'insert',
                'bg-[var(--color-bg-diff-viewer-old-primary)]': seg.type === 'delete',
              })}
            >
              {highlightWithRefractor(seg.value, language)}
            </span>
          ))}
        </Tag>
      </td>
    </tr>
  );
};

export interface CompactDiffViewerProps extends Omit<DiffProps, 'hunks' | 'type'> {
  oldValue?: string;
  newValue?: string;
  udiff?: string;
  hunks?: (HunkType | SkipBlock)[];
  type?: File['type'];
  showFilename?: boolean;
}

export const CompactDiffViewer: FC<CompactDiffViewerProps> = ({
  oldValue,
  newValue,
  udiff,
  fileName,
  language,
  hunks: providedHunks,
  type: providedType,
  className,
  showFilename = true,
  ...props
}) => {
  const files = useMemo(() => {
    if (providedHunks) {
      return [{ hunks: providedHunks, type: providedType, newPath: fileName } as File];
    }

    let diffText = udiff;
    if (!diffText && oldValue !== undefined && newValue !== undefined) {
      const name = fileName || 'file';
      const header = `diff --git a/${name} b/${name}\n`;
      diffText = header + formatLines(diffLines(oldValue, newValue), { context: 100, aname: `a/${name}`, bname: `b/${name}` });
    }

    if (diffText) {
      return parseDiff(diffText);
    }

    return [];
  }, [providedHunks, providedType, oldValue, newValue, udiff, fileName]);

  if (files.length === 0) {
    return null;
  }

  if (files.length === 1 && !udiff) {
    const file = files[0];
    return (
      <Diff
        {...props}
        fileName={file.newPath || fileName}
        language={language || getLanguageFromPath(file.newPath || fileName)}
        hunks={file.hunks}
        type={file.type}
        className={clsx('words-diff-viewer', className)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {files.map((file, index) => (
        <div key={index}>
          {showFilename && file.newPath && udiff && (
            <div className="text-xs font-semibold text-text-secondary mb-2">
              {file.oldPath !== file.newPath && file.oldPath ? (
                <span>
                  {file.oldPath} → {file.newPath}
                </span>
              ) : (
                <span>{file.newPath}</span>
              )}
            </div>
          )}
          <Diff
            {...props}
            fileName={file.newPath || fileName}
            language={language || getLanguageFromPath(file.newPath || fileName)}
            hunks={file.hunks}
            type={file.type}
            className={clsx('words-diff-viewer', className)}
          />
        </div>
      ))}
    </div>
  );
};
