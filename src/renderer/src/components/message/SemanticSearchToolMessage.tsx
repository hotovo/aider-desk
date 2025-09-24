import { useTranslation } from 'react-i18next';
import { RiErrorWarningFill, RiCheckboxCircleFill } from 'react-icons/ri';
import { FaSearchengin } from 'react-icons/fa6';
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

export const SemanticSearchToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const searchQuery = (message.args.searchQuery as string) || (message.args.query as string);
  const path = (message.args.path as string) || '.';
  const content = message.content && JSON.parse(message.content);
  const isError = content && typeof content === 'string' && (content.startsWith('Error:') || content.startsWith('Search execution denied by user.'));

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <FaSearchengin className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.semanticSearch.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{searchQuery}</CodeInline>
        </span>
        <span>{t('toolMessage.power.semanticSearch.in')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{path}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError ? (
          <span className="text-left">
            <StyledTooltip id={`semantic-search-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`semantic-search-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ))}
    </div>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
          <div className="text-error">{content}</div>
        </div>
      );
    }

    if (!content || content.length === 0) {
      return (
        <div className="p-3 text-xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.power.semanticSearch.noMatches')}</div>
        </div>
      );
    }

    return (
      <div className="p-3 text-2xs text-text-secondary bg-bg-secondary">
        <pre className="whitespace-pre-wrap bg-bg-primary-light p-2">{content}</pre>
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
