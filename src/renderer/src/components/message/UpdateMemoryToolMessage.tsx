import { useTranslation } from 'react-i18next';
import { FaBrain, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export const UpdateMemoryToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const id = message.args.id as string;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Failed to update memory');
  const isDenied = (content && typeof content === 'string' && content.includes('cancelled')) || content.includes('denied');

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <FaBrain className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        {!content ? (
          <span>{t('toolMessage.memory.updatingMemory')}</span>
        ) : isError || isDenied ? (
          <span>{t('toolMessage.memory.updatingMemory')}</span>
        ) : (
          <span>{t('toolMessage.memory.memoryUpdated')}</span>
        )}
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <Tooltip content={content}>
            <FaExclamationTriangle className="w-3 h-3 text-error" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={content}>
            <FaTimesCircle className="w-3 h-3 text-warning" />
          </Tooltip>
        ) : (
          <FaCheckCircle className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (!content) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('toolMessage.memory.updatingMemory')}</span>
          </div>
        </div>
      );
    }

    if (isError || isDenied) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className={`${isDenied ? 'text-warning' : 'text-error'}`}>
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              {content}
            </pre>
          </div>
        </div>
      );
    }

    const args = message.args as { id: string; content: string };

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          {/* Memory ID */}
          <div className="space-y-2">
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.memory.memoryId')}:</span> {id}
              </div>
            </div>
          </div>

          {/* New Content */}
          <div className="space-y-2">
            <div className="text-3xs text-text-muted">{t('toolMessage.memory.newContent')}</div>
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              <pre className="whitespace-pre-wrap text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                {args.content}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      title={title}
      content={renderContent()}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
