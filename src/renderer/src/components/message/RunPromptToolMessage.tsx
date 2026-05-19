import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill, RiPauseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdPlayArrow } from 'react-icons/md';
import { DefaultTaskState, ToolMessage } from '@common/types';

import { CodeInline } from '@/components/common/CodeInline';
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

export const RunPromptToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const taskId = message.args.taskId as string;
  const prompt = message.args.prompt as string;
  const mode = message.args.mode as string | undefined;
  const executeAndWait = message.args.executeAndWait as boolean | undefined;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Error running prompt on task:');
  const isDenied = content && typeof content === 'string' && content.startsWith('Running prompt on task denied by user.');
  const isNotFound = content && typeof content === 'string' && content.startsWith('Task with ID') && content.includes('not found');
  const taskState = content && typeof content === 'object' ? (content.state as string | undefined) : undefined;
  const isInterrupted = taskState === DefaultTaskState.Interrupted;

  const renderStatusIcon = () => {
    if (!content) {
      return <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />;
    }
    if (isError || isNotFound) {
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
    if (isInterrupted) {
      return <RiPauseCircleFill className="w-3 h-3 text-warning flex-shrink-0" />;
    }
    return <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />;
  };

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <MdPlayArrow className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex gap-3 overflow-hidden">
        <span className="flex-shrink-0">{t('toolMessage.tasks.runPrompt')}</span>
        <span className="overflow-hidden text-ellipsis max-w-[600px]">
          <CodeInline className="bg-bg-primary-light whitespace-nowrap">{prompt}</CodeInline>
        </span>
      </div>
      {renderStatusIcon()}
    </div>
  );

  const renderContent = () => {
    if (isError || isNotFound) {
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

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
            <pre className="whitespace-pre-wrap text-3xs text-text-primary max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
              {prompt}
            </pre>
          </div>

          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
            <div className="text-3xs">
              <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {taskId}
            </div>
            {taskState && (
              <div className="text-3xs flex items-center gap-1">
                <span className="text-text-muted">{t('toolMessage.tasks.state')}:</span> <TaskStateChip state={taskState} className="-ml-0.5" />
              </div>
            )}
            {content && typeof content === 'object' && content.result && (
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.tasks.result')}:</span> {content.result}
              </div>
            )}
            {mode && (
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.tasks.mode')}:</span> {mode}
              </div>
            )}
            {executeAndWait ? (
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.tasks.executeAndWait')}:</span> {t('toolMessage.tasks.yes')}
              </div>
            ) : (
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.tasks.executeInBackground')}:</span> {t('toolMessage.tasks.yes')}
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
      message={message}
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
