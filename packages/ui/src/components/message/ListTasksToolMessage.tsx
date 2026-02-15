import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { LuClipboardList } from 'react-icons/lu';

import { ToolMessage } from '@/types/message';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { TaskStateChip } from '@/components/common/TaskStateChip';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

export const ListTasksToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
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
        <LuClipboardList className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{state ? t('toolMessage.tasks.listTasksWithState', { state }) : t('toolMessage.tasks.listTasks')}</span>
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
        <div className="space-y-1">
          {content.map((task: Task) => (
            <div key={task.id} className="flex items-center justify-between p-2 bg-bg-primary-light rounded">
              <div className="flex items-center gap-2">
                <span className="font-mono text-text-primary">{task.id.slice(0, 8)}</span>
                <span className="text-text-secondary">{task.name || t('toolMessage.tasks.unnamedTask')}</span>
              </div>
              <div className="flex items-center gap-2">
                {task.archived && <span className="text-2xs bg-bg-secondary text-text-muted px-1 rounded">{t('toolMessage.tasks.archived')}</span>}
                {task.state && <TaskStateChip state={task.state} className="text-2xs" />}
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
