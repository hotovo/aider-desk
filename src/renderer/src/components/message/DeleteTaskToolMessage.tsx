import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { LiaFolderMinusSolid } from 'react-icons/lia';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
};

export const DeleteTaskToolMessage = ({ message, onRemove, compact = false, onFork }: Props) => {
  const { t } = useTranslation();

  const taskId = message.args.taskId as string;
  const content = message.content && JSON.parse(message.content);
  const isError =
    content &&
    typeof content === 'string' &&
    (content.startsWith('Error deleting task:') ||
      content === 'Cannot delete current task' ||
      (content.startsWith('Task with ID') && content.includes('not found')));
  const isDenied = content && typeof content === 'string' && content.startsWith('Deleting task denied by user.');

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <LiaFolderMinusSolid className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.tasks.deleteTask')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{taskId}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`delete-task-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`delete-task-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : isDenied ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`delete-task-denied-tooltip-${message.id}`} maxWidth={600} />
            <RiCloseCircleFill className="w-3 h-3 text-warning" data-tooltip-id={`delete-task-denied-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-error">{content}</div>
        </div>
      );
    }

    if (isDenied) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-warning">
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
              {content}
            </pre>
          </div>
        </div>
      );
    }

    if (!content || typeof content !== 'string') {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="space-y-1 text-3xs text-text-muted">
            <div>
              <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {taskId}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-2">
          {/* Success Message */}
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
            <div className="flex items-center gap-2">
              <RiCheckboxCircleFill className="w-4 h-4 text-success" />
              <span className="font-medium text-text-secondary">{content}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} onFork={onFork} />;
};
