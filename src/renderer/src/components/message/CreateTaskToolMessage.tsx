import { useTranslation } from 'react-i18next';
import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdAssignmentAdd } from 'react-icons/md';

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

export const CreateTaskToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const prompt = message.args.prompt as string;
  const agentProfileId = message.args.agentProfileId as string;
  const name = message.args.name as string | undefined;
  const parentTaskId = message.args.parentTaskId as string | null | undefined;
  const modelId = message.args.modelId as string;
  const execute = message.args.execute as boolean;
  const executeInBackground = message.args.executeInBackground as boolean;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Error creating task:');
  const isDenied = content && typeof content === 'string' && content.startsWith('Creating task denied by user.');

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <MdAssignmentAdd className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.tasks.createTask')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{prompt.length > 30 ? prompt.substring(0, 27) + '...' : prompt}</CodeInline>
        </span>
        {agentProfileId && (
          <>
            <span>{t('toolMessage.tasks.agentProfile')}:</span>
            <span>
              <CodeInline className="bg-bg-primary-light">{agentProfileId}</CodeInline>
            </span>
          </>
        )}
        {modelId && (
          <>
            <span>{t('toolMessage.tasks.model')}:</span>
            <span>
              <CodeInline className="bg-bg-primary-light">{modelId}</CodeInline>
            </span>
          </>
        )}
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <Tooltip content={content}>
            <RiErrorWarningFill className="w-3 h-3 text-error" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={content}>
            <RiCloseCircleFill className="w-3 h-3 text-warning" />
          </Tooltip>
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
      return <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">{content}</div>;
    }

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
            <pre className="whitespace-pre-wrap text-3xs text-text-primary max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
              {prompt}
            </pre>
          </div>

          {/* Task Details */}
          <div className="space-y-2">
            <div className="border border-border-dark-light rounded bg-bg-primary-light px-3 py-2 space-y-1">
              <div className="text-3xs">
                <span className="text-text-muted">{t('toolMessage.tasks.taskId')}:</span> {content.id}
              </div>
              <div className="text-3xs">
                <span className="text-text-muted">{t('agentProfiles.profileName')}:</span> {content.name}
              </div>
              {name && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.name')}:</span> {name}
                </div>
              )}
              {parentTaskId !== undefined && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.parentTaskId')}:</span> {parentTaskId}
                </div>
              )}
              {agentProfileId && (
                <div className="text-3xs mt-2">
                  <span className="text-text-muted">{t('toolMessage.tasks.agentProfile')}:</span> {agentProfileId}
                </div>
              )}
              {modelId && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.model')}:</span> {modelId}
                </div>
              )}
              {execute !== undefined && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.execute')}:</span> {execute ? t('toolMessage.tasks.yes') : t('toolMessage.tasks.no')}
                </div>
              )}
              {executeInBackground !== undefined && execute && (
                <div className="text-3xs">
                  <span className="text-text-muted">{t('toolMessage.tasks.executeInBackground')}:</span>{' '}
                  {executeInBackground ? t('toolMessage.tasks.yes') : t('toolMessage.tasks.no')}
                </div>
              )}
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
