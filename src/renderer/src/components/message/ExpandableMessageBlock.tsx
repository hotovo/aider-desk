import { ReactNode, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { UsageReportData } from '@common/types';

import { MessageBar } from './MessageBar';

import { Accordion } from '@/components/common/Accordion';

type Props = {
  title: ReactNode;
  content: ReactNode;
  copyContent?: string;
  usageReport?: UsageReportData;
  onRemove?: () => void;
  initialExpanded?: boolean;
  onOpenChange?: (open: boolean) => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export interface ExpandableMessageBlockRef {
  open: () => void;
  close: () => void;
}

export const ExpandableMessageBlock = forwardRef<ExpandableMessageBlockRef, Props>(
  ({ title, content, copyContent, usageReport, onRemove, initialExpanded = false, onOpenChange, onFork, onRemoveUpTo, hideMessageBar = false }, ref) => {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const [isInitialAutoExpand, setIsInitialAutoExpand] = useState(!initialExpanded);

    const handleExpandedChange = (open: boolean) => {
      setIsExpanded(open);
      setIsInitialAutoExpand(false);
      onOpenChange?.(open);
    };

    useImperativeHandle(ref, () => ({
      open: () => {
        handleExpandedChange(true);
      },
      close: () => {
        handleExpandedChange(false);
      },
    }));

    useEffect(() => {
      let timeout: NodeJS.Timeout | null = null;

      if (isInitialAutoExpand && !isExpanded) {
        timeout = setTimeout(() => {
          if (isInitialAutoExpand) {
            setIsInitialAutoExpand(false);
          }
        }, 2000);
      }

      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    }, [isInitialAutoExpand, isExpanded]);

    return (
      <div className="border border-border-dark-light rounded-md mb-2 group bg-bg-secondary">
        <Accordion
          title={title}
          isOpen={isExpanded}
          onOpenChange={handleExpandedChange}
          chevronPosition="right"
          scrollToVisibleWhenExpanded={!initialExpanded}
          showCollapseButton={!initialExpanded}
          noMaxHeight={true}
          buttonClassName="p-3 rounded-b-none"
        >
          <div className="relative">
            {content}
            {/* Gradient overlay for initial auto-expand */}
            {isInitialAutoExpand && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-bg-secondary via-bg-secondary to-transparent pointer-events-none"></div>
            )}
          </div>
        </Accordion>
        {!hideMessageBar && (
          <div className="px-3 pb-3 bg-bg-secondary">
            <MessageBar className="mt-0" content={copyContent} usageReport={usageReport} remove={onRemove} onFork={onFork} onRemoveUpTo={onRemoveUpTo} />
          </div>
        )}
      </div>
    );
  },
);

ExpandableMessageBlock.displayName = 'ExpandableMessageBlock';
