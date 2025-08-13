import Prism from 'prismjs';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { MdKeyboardArrowDown, MdUndo } from 'react-icons/md';
import { VscCode } from 'react-icons/vsc';

import { CopyMessageButton } from '../message/CopyMessageButton';

import { IconButton } from './IconButton';

import { DiffViewer, UDiffViewer } from '@/components/common/DiffViewer';

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
  language: string;
  children?: string;
  file?: string;
  isComplete?: boolean;
  oldValue?: string;
  newValue?: string;
};

export const CodeBlock = ({ baseDir, language, children, file, isComplete = true, oldValue, newValue }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [changesReverted, setChangesReverted] = useState(false);

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
      return <UDiffViewer udiff={children} language={language} />;
    } else if (displayAsDiff) {
      return <DiffViewer oldValue={diffOldValue} newValue={diffNewValue} language={language} />;
    } else if (codeForSyntaxHighlight && language) {
      let html = codeForSyntaxHighlight;

      const grammar = Prism.languages[language];
      if (grammar) {
        try {
          html = Prism.highlight(codeForSyntaxHighlight, grammar, language);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to highlight code:', error);
        }
      }

      return (
        <pre>
          <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      );
    } else {
      return (
        <pre>
          <code className="text-2xs">{codeForSyntaxHighlight}</code>
        </pre>
      );
    }
  }, [codeForSyntaxHighlight, diffNewValue, diffOldValue, displayAsDiff, displayAsUdiff, children, language]);

  const handleRevertChanges = () => {
    if (file && displayAsDiff) {
      window.api.applyEdits(baseDir, [
        {
          path: file!,
          original: diffNewValue,
          updated: diffOldValue,
        },
      ]);
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
            <div className="absolute right-0 top-1 flex items-center gap-2">
              <CopyMessageButton content={stringToCopy} />
              {!isComplete && <AiOutlineLoading3Quarters className="animate-spin text-text-muted" size={14} />}
            </div>
            {content}
          </div>
        )}
      </div>
    </div>
  );
};
