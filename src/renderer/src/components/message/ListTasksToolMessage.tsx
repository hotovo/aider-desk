import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { LuClipboardList } from 'react-icons/lu';

import { ToolMessage } from '@/types/message';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { TaskStateChip } from '@/components/common/TaskStateChip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
};

export const ListTasksToolMessage = ({ message, onRemove, compact = false, onFork }: Props) => {
  const { t } = useTranslation();

  type Task = {
    id: string;
    name: string;
    archived?: boolean;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    state?: string;
  };

  const offset = (message.args.offset as number) ?? 0;
  const limit = message.args.limit as number | undefined;
  const state = (message.args.state as string) ?? undefined;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Error listing tasks:');
  const isDenied = content && typeof content === 'string' && content.startsWith('Listing tasks denied by user.');

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <LuClipboardList className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{state ? t('toolMessage.tasks.listTasksWithState', { state }) : t('toolMessage.tasks.listTasks')}</span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`list-tasks-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`list-tasks-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : isDenied ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`list-tasks-denied-tooltip-${message.id}`} maxWidth={600} />
            <RiCloseCircleFill className="w-3 h-3 text-warning" data-tooltip-id={`list-tasks-denied-tooltip-${message.id}`} data-tooltip-content={content} />
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

    if (!content || !Array.isArray(content) || content.length === 0) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.tasks.noTasksFound')}</div>
        </div>
      );
    }

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-text-secondary">{t('toolMessage.power.glob.foundFiles', { count: content.length })}</span>
          {limit != null && (
            <span className="text-text-muted">
              {t('toolMessage.power.glob.for')} offset={offset}, limit={limit}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {content.map((task: Task) => (
            <div key={task.id} className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-secondary">{task.name}</span>
                  {task.state && <TaskStateChip state={task.state} className="-ml-0.5" />}
                  {task.archived && <span className="px-1.5 py-0.5 text-3xs bg-bg-secondary text-text-muted rounded">{t('toolMessage.tasks.archived')}</span>}
                </div>
              </div>
              <div className="space-y-1 text-3xs text-text-muted">
                <div>
                  <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {task.id}
                </div>
                {task.createdAt && (
                  <div>
                    <span className="text-text-muted">{t('toolMessage.tasks.createdAt')}:</span> {new Date(task.createdAt).toLocaleString()}
                  </div>
                )}
                {task.updatedAt && (
                  <div>
                    <span className="text-text-muted">{t('toolMessage.tasks.updatedAt')}:</span> {new Date(task.updatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} onFork={onFork} />;
};
