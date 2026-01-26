import { useTranslation } from 'react-i18next';
import { RiLinkM, RiErrorWarningFill, RiCheckboxCircleFill, RiCloseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { highlightWithLowlight } from '@/utils/highlighter';
import { CopyMessageButton } from '@/components/message/CopyMessageButton';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
};

export const FetchToolMessage = ({ message, onRemove, compact = false, onFork }: Props) => {
  const { t } = useTranslation();

  const url = message.args.url as string;
  const format = (message.args.format as string) || 'markdown';
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Error:');
  const isDenied = content && typeof content === 'string' && content.startsWith('URL fetch from');

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiLinkM className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.fetch.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{url}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`fetch-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`fetch-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : isDenied ? (
          <span className="text-left flex-shrink-0">
            <StyledTooltip id={`fetch-denied-tooltip-${message.id}`} maxWidth={600} />
            <RiCloseCircleFill className="w-3 h-3 text-warning" data-tooltip-id={`fetch-denied-tooltip-${message.id}`} data-tooltip-content={content} />
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

    if (!content) {
      return null;
    }

    return (
      <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3 relative">
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-2 rounded text-2xs max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth text-text-secondary">
            {format === 'html' ? highlightWithLowlight(content, 'html') : format === 'markdown' ? highlightWithLowlight(content, 'markdown') : content}
          </pre>
          <div className="absolute top-0 right-3">
            <CopyMessageButton content={content} />
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
