import { useTranslation } from 'react-i18next';
import { RiMessage3Line, RiCheckboxCircleFill, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
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

export const GetTaskMessageToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const taskId = message.args.taskId as string;
  const index = message.args.index as number | undefined;
  const content = message.content && JSON.parse(message.content);
  const isError =
    content &&
    typeof content === 'string' &&
    (content.startsWith('Error getting task message:') ||
      (content.startsWith('Task with ID') && content.includes('not found')) ||
      (content.startsWith('Message index') && content.includes('out of range')));
  const isDenied = content && typeof content === 'string' && content.startsWith('Retrieving task message denied by user.');

  const renderStatusIcon = () => {
    if (!content) {
      return <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />;
    }
    if (isError) {
      return (
        <Tooltip content={content}>
          <RiErrorWarningFill className="w-3 h-3 text-error" />
        </Tooltip>
      );
    }
    if (isDenied) {
      return (
        <Tooltip content={content}>
          <RiCloseCircleFill className="w-3 h-3 text-warning" />
        </Tooltip>
      );
    }
    return <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />;
  };

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiMessage3Line className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.tasks.getTaskMessage')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{taskId}</CodeInline>
        </span>
        {index !== undefined && <span>#{index}</span>}
      </div>
      {renderStatusIcon()}
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

    if (!content || typeof content !== 'object') {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.tasks.messageNotFound')}</div>
        </div>
      );
    }

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-secondary">{content.role}</span>
              </div>
              {content.sender && <span className="text-text-muted text-3xs">{content.sender}</span>}
            </div>
            {content.content && (
              <div className="text-3xs text-text-muted">
                <pre className="whitespace-pre-wrap bg-bg-secondary p-2 rounded mt-1 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                  {typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2)}
                </pre>
              </div>
            )}
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
