import 'prismjs/themes/prism-tomorrow.css';
import { startTransition, useMemo, useOptimistic, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { MdKeyboardArrowDown, MdUndo } from 'react-icons/md';
import { VscCode } from 'react-icons/vsc';
import { DiffViewMode } from '@common/types';

import { CopyMessageButton } from '../message/CopyMessageButton';

import { MermaidDiagram } from './MermaidDiagram';
import { IconButton } from './IconButton';
import { CompactSelect } from './CompactSelect';

import { DiffViewer, UDiffViewer, CompactDiffViewer } from '@/components/common/DiffViewer';
import { useApi } from '@/contexts/ApiContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useResponsive } from '@/hooks/useResponsive';
import { highlightWithLowlight } from '@/utils/highlighter';

const SEARCH_MARKER = /^<{5,9} SEARCH[^\n]*$/m;
const DIVIDER_MARKER = /^={5,9}\s*$/m;
const REPLACE_MARKER = /^>{5,9} REPLACE\s*$/m;

const isCustomDiffContent = (content: string): boolean => {
  return SEARCH_MARKER.test(content);
};

const isUdiffContent = (content: string): boolean => {
  return /^---\s/m.test(content) && /^\+\+\+\s/m.test(content);
};

const parseDiffContent = (content: string): { oldValue: string; newValue: string } => {
  const searchMatch = content.match(SEARCH_MARKER);
  if (!searchMatch) {
    return { oldValue: '', newValue: '' };
  }

  const searchIndex = searchMatch.index! + searchMatch[0].length;
  const dividerMatch = content.match(DIVIDER_MARKER);
  const replaceMatch = content.match(REPLACE_MARKER);

  if (!dividerMatch) {
    const oldValue = content.substring(searchIndex).replace(/^\n/, '');
    return { oldValue, newValue: '' };
  }

  const dividerIndex = dividerMatch.index!;
  const oldValue = content.substring(searchIndex, dividerIndex).replace(/^\n/, '');

  if (!replaceMatch) {
    // We have old value complete and new value being streamed
    const newValue = content.substring(dividerIndex + dividerMatch[0].length).replace(/^\n/, '');
    return { oldValue, newValue };
  }

  // We have complete diff
  const updatedIndex = replaceMatch.index!;
  const newValue = content.substring(dividerIndex + dividerMatch[0].length, updatedIndex).replace(/^\n/, '');
  return { oldValue, newValue };
};

type Props = {
  baseDir: string;
  taskId?: string;
  language: string;
  children?: string;
  file?: string;
  isComplete?: boolean;
  oldValue?: string;
  newValue?: string;
};

export const CodeBlock = ({ baseDir, taskId, language, children, file, isComplete = true, oldValue, newValue }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [changesReverted, setChangesReverted] = useState(false);
  const api = useApi();
  const { settings, saveSettings } = useSettings();
  const [diffViewMode, setDiffViewMode] = useOptimistic(settings?.diffViewMode || DiffViewMode.SideBySide);
  const { isMobile } = useResponsive();

  const handleDiffViewModeChange = (value: string) => {
    if (settings) {
      startTransition(() => {
        setDiffViewMode(value as DiffViewMode);
        void saveSettings({
          ...settings,
          diffViewMode: value as DiffViewMode,
        });
      });
    }
  };

  const diffViewOptions = [
    { label: t('diffViewer.sideBySide'), value: DiffViewMode.SideBySide },
    { label: t('diffViewer.unified'), value: DiffViewMode.Unified },
    { label: t('diffViewer.compact'), value: DiffViewMode.Compact },
  ];

  const isExplicitDiff = oldValue !== undefined && newValue !== undefined;
  const isCustomChildrenDiff = !isExplicitDiff && children ? isCustomDiffContent(children) : false;
  const isUdiffChildrenDiff = !isExplicitDiff && children ? isUdiffContent(children) : false;
  const displayAsDiff = isExplicitDiff || isCustomChildrenDiff;
  const displayAsUdiff = isUdiffChildrenDiff;

  let diffOldValue = '';
  let diffNewValue = '';
  let codeForSyntaxHighlight: string | undefined = undefined;
  let stringToCopy: string;

  if (isExplicitDiff) {
    diffOldValue = oldValue!; // Known to be string
    diffNewValue = newValue!; // Known to be string
    stringToCopy = newValue!;
  } else if (isCustomChildrenDiff) {
    const parsed = parseDiffContent(children!); // children is non-null and a diff
    diffOldValue = parsed.oldValue;
    diffNewValue = parsed.newValue;
    stringToCopy = children!;
  } else {
    // Not a diff, display children as plain code (if it exists)
    codeForSyntaxHighlight = children;
    stringToCopy = children || '';
  }

  const content = useMemo(() => {
    if (displayAsUdiff && children) {
      if (diffViewMode === DiffViewMode.Compact) {
        return <CompactDiffViewer udiff={children} fileName={file} language={language} />;
      }
      return <UDiffViewer udiff={children} language={language} viewMode={diffViewMode} />;
    } else if (displayAsDiff) {
      if (diffViewMode === DiffViewMode.Compact) {
        return <CompactDiffViewer oldValue={diffOldValue} newValue={diffNewValue} fileName={file} language={language} />;
      }
      return <DiffViewer oldValue={diffOldValue} newValue={diffNewValue} language={language} isComplete={isComplete} viewMode={diffViewMode} />;
    } else if (language === 'mermaid' && codeForSyntaxHighlight) {
      return <MermaidDiagram code={codeForSyntaxHighlight} />;
    } else if (codeForSyntaxHighlight && language) {
      return (
        <pre
          className={`language-${language} !bg-transparent !border-none !shadow-none scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth focus:outline-none`}
        >
          <code className={`language-${language}`}>{highlightWithLowlight(codeForSyntaxHighlight, language)}</code>
        </pre>
      );
    } else {
      return (
        <pre>
          <code className="text-2xs">{codeForSyntaxHighlight}</code>
        </pre>
      );
    }
  }, [displayAsUdiff, children, displayAsDiff, codeForSyntaxHighlight, language, diffViewMode, diffOldValue, diffNewValue, isComplete, file]);

  const handleRevertChanges = () => {
    if (file && displayAsDiff) {
      if (taskId) {
        api.applyEdits(baseDir, taskId, [
          {
            path: file!,
            original: diffNewValue,
            updated: diffOldValue,
          },
        ]);
      }
      setChangesReverted(true);
    }
  };

  const showRevertButton = !isExplicitDiff && displayAsDiff && file && diffOldValue && !changesReverted;

  return (
    <div className="mt-1 max-w-full">
      <div className="bg-bg-code-block border border-border-dark-light text-text-primary rounded-md px-3 py-2 mb-4 overflow-x-auto text-xs scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-tertiary">
        {file ? (
          <>
            <div className="text-text-primary text-xs py-1 w-full cursor-pointer flex items-center justify-between" onClick={() => setIsExpanded(!isExpanded)}>
              <span className="flex items-center gap-2">
                <VscCode className="text-text-muted" size={14} />
                {file}
              </span>
              <span className="flex items-center gap-2">
                {showRevertButton && (
                  <div className="relative inline-block">
                    <IconButton
                      icon={<MdUndo size={16} />}
                      onClick={handleRevertChanges}
                      tooltip={t('codeBlock.revertChanges')}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </div>
                )}
                <CopyMessageButton content={stringToCopy} className="opacity-0 group-hover:opacity-100" />
                {!isComplete && <AiOutlineLoading3Quarters className="animate-spin text-text-muted" size={14} />}
                {(displayAsDiff || displayAsUdiff) && !isMobile && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <CompactSelect options={diffViewOptions} value={diffViewMode} onChange={handleDiffViewModeChange} />
                  </div>
                )}
                <span className="text-text-primary transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                  <MdKeyboardArrowDown size={16} />
                </span>
              </span>
            </div>
            <div
              className={`transition-all duration-200 ${isExpanded ? 'max-h-[5000px] opacity-100 overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light' : 'max-h-0 opacity-0 overflow-hidden'}`}
            >
              <hr className="border-border-dark-light-strong my-2" />
              {content}
            </div>
          </>
        ) : (
          <div className="relative">
            <div className="absolute right-0 top-1 flex items-center gap-2 z-10">
              <CopyMessageButton content={stringToCopy} />
              {(displayAsDiff || displayAsUdiff) && !isMobile && (
                <CompactSelect options={diffViewOptions} value={diffViewMode} onChange={handleDiffViewModeChange} />
              )}
              {!isComplete && <AiOutlineLoading3Quarters className="animate-spin text-text-muted" size={14} />}
            </div>
            {content}
          </div>
        )}
      </div>
    </div>
  );
};
