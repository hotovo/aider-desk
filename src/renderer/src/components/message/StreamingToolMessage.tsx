import { ReactNode } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { ToolMessage } from '@common/types';

import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';

type Props = {
  message: ToolMessage;
  icon: ReactNode;
  label: string;
  compact?: boolean;
  onRemove?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export const StreamingToolMessage = ({ message, icon, label, compact = false, onRemove, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted animate-pulse">{icon}</div>
      <div className="text-xs text-text-primary animate-pulse flex items-center gap-1">
        <span>{label.replace(/[.…:\s]+$/, '')}</span>
        <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />
      </div>
    </div>
  );

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      message={message}
      title={title}
      content={<div />}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
