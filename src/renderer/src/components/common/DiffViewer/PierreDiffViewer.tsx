import { type MouseEvent, useCallback, useMemo } from 'react';
import { HiPencil, HiTrash } from 'react-icons/hi';
import { DiffViewMode, isCodeEditorDarkTheme } from '@common/types';
import { MultiFileDiff, type MultiFileDiffProps, PatchDiff } from '@pierre/diffs/react';

import type { DiffLineAnnotation, OnDiffLineClickProps, SelectedLineRange } from '@pierre/diffs';

import { useSettings } from '@/contexts/SettingsContext';
import './PierreDiffViewer.scss';

export type PierreLineClickInfo = {
  lineNumber: number;
  side: 'deletions' | 'additions';
  viewportRect: { top: number; left: number };
};

export type DiffComment = {
  id: string;
  lineNumber: number;
  comment: string;
};

type Props = {
  oldValue?: string;
  newValue?: string;
  udiff?: string;
  fileName?: string;
  showFilename?: boolean;
  viewMode?: DiffViewMode;
  selectedLineNumber?: number | null;
  onLineClick?: (lineInfo: PierreLineClickInfo) => void;
  comments?: DiffComment[];
  onEditComment?: (info: { commentId: string; viewportRect: { top: number; left: number } }) => void;
  onRemoveComment?: (commentId: string) => void;
};

export const PierreDiffViewer = ({
  oldValue,
  newValue,
  udiff,
  fileName,
  showFilename = true,
  viewMode,
  selectedLineNumber,
  onLineClick,
  comments,
  onEditComment,
  onRemoveComment,
}: Props) => {
  const { theme } = useSettings();

  const handleLineClick = useCallback(
    (props: OnDiffLineClickProps) => {
      if (!onLineClick || props.annotationSide !== 'additions') {
        return;
      }

      const rect = props.lineElement.getBoundingClientRect();

      onLineClick({
        lineNumber: props.lineNumber,
        side: props.annotationSide,
        viewportRect: {
          top: rect.bottom + 8,
          left: Math.min(rect.left + 8, window.innerWidth - 300),
        },
      });
    },
    [onLineClick],
  );

  const lineAnnotations = useMemo<DiffLineAnnotation<{ id: string; comment: string }>[]>(
    () => (comments ?? []).map((c) => ({ side: 'additions' as const, lineNumber: c.lineNumber, metadata: { id: c.id, comment: c.comment } })),
    [comments],
  );

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<{ id: string; comment: string }>) => {
      const { id, comment } = annotation.metadata;

      const handleEdit = (e: MouseEvent<HTMLButtonElement>) => {
        const annotationEl = e.currentTarget.closest('[data-diff-annotation]') as HTMLElement | null;
        const rect = (annotationEl ?? e.currentTarget).getBoundingClientRect();
        onEditComment?.({
          commentId: id,
          viewportRect: { top: rect.bottom + 8, left: Math.min(rect.left + 8, window.innerWidth - 300) },
        });
      };
      const handleRemove = () => onRemoveComment?.(id);

      return (
        <div
          data-diff-annotation
          className="flex items-start justify-between gap-2 py-1.5 px-3 text-2xs text-text-secondary bg-bg-primary-light-strong border-t border-b border-border-accent group"
        >
          <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">{comment}</span>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-secondary transition-colors" onClick={handleEdit}>
              <HiPencil size={14} />
            </button>
            <button type="button" className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-error transition-colors" onClick={handleRemove}>
              <HiTrash size={14} />
            </button>
          </div>
        </div>
      );
    },
    [onEditComment, onRemoveComment],
  );

  const options = useMemo(
    () =>
      ({
        disableFileHeader: !showFilename,
        diffIndicators: 'bars',
        enableGutterUtility: true,
        diffStyle: (viewMode === DiffViewMode.SideBySide ? 'split' : 'unified') as 'split' | 'unified',
        disableLineNumbers: !udiff,
        overflow: 'wrap',
        theme: !theme || isCodeEditorDarkTheme(theme) ? 'github-dark-default' : 'github-light-default',
        ...(onLineClick ? { onLineClick: handleLineClick } : {}),
      }) as MultiFileDiffProps<unknown>['options'],
    [showFilename, theme, udiff, viewMode, onLineClick, handleLineClick],
  );

  const selectedLines = useMemo<SelectedLineRange | null>(
    () => (selectedLineNumber != null ? { start: selectedLineNumber, end: selectedLineNumber, side: 'additions' as const } : null),
    [selectedLineNumber],
  );

  const annotationProps = comments && comments.length > 0 ? { lineAnnotations, renderAnnotation } : {};

  if (udiff) {
    return <PatchDiff patch={udiff} options={options} selectedLines={selectedLines} disableWorkerPool={true} {...annotationProps} />;
  }

  if (oldValue !== undefined && newValue !== undefined) {
    const ensureTrailingNewline = (s: string) => (s.endsWith('\n') ? s : s + '\n');
    const oldContents = ensureTrailingNewline(oldValue);
    const newContents = ensureTrailingNewline(newValue);

    return (
      <MultiFileDiff
        oldFile={{ name: fileName || 'file.txt', contents: oldContents }}
        newFile={{ name: fileName || 'file.txt', contents: newContents }}
        options={options}
        selectedLines={selectedLines}
        disableWorkerPool={true}
        {...annotationProps}
      />
    );
  }

  return null;
};
