import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdAssignment } from 'react-icons/md';
import { ContextFile } from '@common/types';

import { ToolMessage } from '@/types/message';
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

export const GetTaskToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const taskId = message.args.taskId as string;
  const content = message.content && JSON.parse(message.content);
  const isError =
    content &&
    typeof content === 'string' &&
    (content.startsWith('Error getting task:') || (content.startsWith('Task with ID') && content.includes('not found')));
  const isDenied = content && typeof content === 'string' && content.startsWith('Getting task information denied by user.');

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
        <MdAssignment className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.tasks.getTask')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{taskId}</CodeInline>
        </span>
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
          <div className="text-text-muted">{t('toolMessage.tasks.taskNotFound')}</div>
        </div>
      );
    }

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          {/* Task Header */}
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-secondary">{content.name}</span>
              </div>
              {content.state && <TaskStateChip state={content.state} className="-ml-0.5" />}
            </div>
            <div className="space-y-1 text-3xs text-text-muted">
              <div>
                <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {content.id}
              </div>
              <div>
                <span className="text-text-muted">{t('toolMessage.tasks.createdAt')}:</span> {new Date(content.createdAt).toLocaleString()}
              </div>
              <div>
                <span className="text-text-muted">{t('toolMessage.tasks.updatedAt')}:</span> {new Date(content.updatedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Task Configuration */}
          <div className="space-y-2">
            <h4 className="font-medium text-text-secondary">{t('settings.agent.provider')}</h4>
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
              {content.agentProfileId && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.agentProfile')}:</span> {content.agentProfileId}
                </div>
              )}
              {content.provider && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('providers.provider')}:</span> {content.provider}
                </div>
              )}
              {content.model && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.model')}:</span> {content.model}
                </div>
              )}
              {content.mode && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.currentMode')}:</span> {content.mode}
                </div>
              )}
            </div>
          </div>

          {/* Context Files */}
          <div className="space-y-2">
            <h4 className="font-medium text-text-secondary">{t('toolMessage.tasks.contextFiles')}</h4>
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              {content.contextFiles && content.contextFiles.length > 0 ? (
                <div className="space-y-1">
                  {content.contextFiles.map((file: ContextFile, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-3xs">
                      <span className="font-mono text-text-secondary">{file.path}</span>
                      {file.readOnly && (
                        <span className="px-1.5 py-0.5 text-3xs bg-bg-secondary text-text-muted rounded">{t('toolMessage.tasks.readOnly')}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-3xs text-text-muted">{t('common.noFiles')}</div>
              )}
            </div>
          </div>

          {/* Context Messages Count */}
          <div className="space-y-2">
            <h4 className="font-medium text-text-secondary">{t('toolMessage.tasks.contextMessages')}</h4>
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              <div className="text-3xs text-text-muted">
                {t('costInfo.messages')}: {content.contextMessagesCount || 0}
              </div>
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
