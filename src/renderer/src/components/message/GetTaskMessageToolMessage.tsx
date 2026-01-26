import { useTranslation } from 'react-i18next';
import { RiMessage3Line, RiCheckboxCircleFill, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';

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

export const GetTaskMessageToolMessage = ({ message, onRemove, compact = false, onFork }: Props) => {
  const { t } = useTranslation();

  const taskId = message.args.taskId as string;
  const content = message.content && JSON.parse(message.content);
  const isError =
    content &&
    typeof content === 'string' &&
    (content.startsWith('Error getting task message:') ||
      (content.startsWith('Task with ID') && content.includes('not found')) ||
      (content.startsWith('Message index') && content.includes('out of range')));
  const isDenied = content && typeof content === 'string' && content.startsWith('Retrieving task message denied by user.');

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
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`get-task-message-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill
              className="w-3 h-3 text-error"
              data-tooltip-id={`get-task-message-error-tooltip-${message.id}`}
              data-tooltip-content={content}
            />
          </span>
        ) : isDenied ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`get-task-message-denied-tooltip-${message.id}`} maxWidth={600} />
            <RiCloseCircleFill
              className="w-3 h-3 text-warning"
              data-tooltip-id={`get-task-message-denied-tooltip-${message.id}`}
              data-tooltip-content={content}
            />
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

    if (!content || typeof content !== 'object') {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.tasks.messageNotFound')}</div>
        </div>
      );
    }

    const getRoleBadge = (role: string) => {
      const roleConfig = {
        user: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: t('toolMessage.tasks.user') },
        assistant: { color: 'text-success', bg: 'bg-success/10', label: t('toolMessage.tasks.assistant') },
      };

      const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;
      return <span className={`px-2 py-0.5 text-3xs ${config.color} ${config.bg} rounded font-medium`}>{config.label}</span>;
    };

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          {/* Message Header */}
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getRoleBadge(content.role)}
                <span className="font-medium text-text-secondary">
                  {t('toolMessage.tasks.messageIndex')} {content.index}
                </span>
                {content.originalIndex !== content.index && (
                  <span className="text-text-muted text-3xs">
                    ({t('toolMessage.tasks.messageIndex')} {content.originalIndex})
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1 text-3xs text-text-muted">
              <div>
                <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {taskId}
              </div>
            </div>
          </div>

          {/* Message Content */}
          <div className="space-y-2">
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
              <pre className="whitespace-pre-wrap text-3xs text-text-primary font-mono max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
                {content.content}
              </pre>
            </div>
          </div>

          {/* Usage Report */}
          {content.usageReport && (
            <div className="space-y-2">
              <h4 className="font-medium text-text-secondary">{t('toolMessage.tasks.usage')}</h4>
              <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2">
                <div className="space-y-1 text-3xs text-text-muted">
                  {content.usageReport.inputTokens && (
                    <div>
                      <span className="text-text-muted">{t('responseMessage.inputTokens')}:</span> {content.usageReport.inputTokens.toLocaleString()}
                    </div>
                  )}
                  {content.usageReport.outputTokens && (
                    <div>
                      <span className="text-text-muted">{t('responseMessage.outputTokens')}:</span> {content.usageReport.outputTokens.toLocaleString()}
                    </div>
                  )}
                  {content.usageReport.cacheWriteTokens && (
                    <div>
                      <span className="text-text-muted">{t('responseMessage.cacheWriteTokens')}:</span> {content.usageReport.cacheWriteTokens.toLocaleString()}
                    </div>
                  )}
                  {content.usageReport.cacheReadTokens && (
                    <div>
                      <span className="text-text-muted">{t('responseMessage.cacheReadTokens')}:</span> {content.usageReport.cacheReadTokens.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} onFork={onFork} />;
};
