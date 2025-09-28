import { useTranslation } from 'react-i18next';
import { RiTerminalLine, RiErrorWarningFill, RiCheckboxCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const BashToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const command = message.args.command as string;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'object' && 'exitCode' in content && content.exitCode !== 0;

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <RiTerminalLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.bash.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{command}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError ? (
          <span className="text-left">
            <StyledTooltip id={`bash-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill
              className="w-3 h-3 text-error"
              data-tooltip-id={`bash-error-tooltip-${message.id}`}
              data-tooltip-content={content.stderr || t('toolMessage.power.bash.commandFailed')}
            />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ))}
    </div>
  );

  const renderContent = () => {
    return (
      <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-2">
          {content && (
            <div className="flex items-center gap-2">
              <div className="font-semibold text-text-secondary">{t('toolMessage.power.bash.exitCode')}:</div>
              <div>{content.exitCode}</div>
            </div>
          )}
          {content.stdout && (
            <div className="relative">
              <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs text-text-secondary max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                {content.stdout}
              </pre>
            </div>
          )}
          {content.stderr && (
            <div className="relative">
              <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs text-error max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
                {content.stderr}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
