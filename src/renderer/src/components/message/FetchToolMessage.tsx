import { useTranslation } from 'react-i18next';
import { RiLinkM, RiErrorWarningFill, RiCheckboxCircleFill } from 'react-icons/ri';
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

export const FetchToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const url = message.args.url as string;
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && content.startsWith('Error:');

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
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError ? (
          <span className="text-left">
            <StyledTooltip id={`fetch-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`fetch-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
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

    if (!content) {
      return null;
    }

    const contentLength = content.length;
    const maxPreviewLength = 2000;
    const isTruncated = contentLength > maxPreviewLength;
    const displayContent = isTruncated ? content.substring(0, maxPreviewLength) + '...' : content;

    return (
      <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
        <div className="space-y-3">
          <div>
            <pre className="whitespace-pre-wrap bg-bg-primary-light p-2 rounded text-2xs max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth text-text-secondary">
              {displayContent}
            </pre>
            {isTruncated && <div className="text-text-muted text-3xs mt-1">{t('toolMessage.power.fetch.contentTruncated')}</div>}
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
