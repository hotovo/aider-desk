import { useTranslation } from 'react-i18next';
import { RiErrorWarningFill, RiCheckboxCircleFill, RiCloseCircleFill } from 'react-icons/ri';
import { LuFileSearch } from 'react-icons/lu';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock } from '@/components/message/ExpandableMessageBlock';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const GrepToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();

  const filePattern = message.args.filePattern as string;
  const searchTerm = message.args.searchTerm as string;
  const contextLines = message.args.contextLines as number;
  const content = message.content && JSON.parse(message.content);
  const isError = content && !Array.isArray(content) && typeof content === 'string' && content.startsWith('Error:');
  const isDenied = content && typeof content === 'string' && content.startsWith('Grep search for');

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <LuFileSearch className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.grep.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{filePattern}</CodeInline>
        </span>
        <span>{t('toolMessage.power.grep.for')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{searchTerm}</CodeInline>
        </span>
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

    if (!content || !Array.isArray(content) || content.length === 0) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.power.grep.noMatches')}</div>
        </div>
      );
    }

    const groupedMatches: Record<string, Array<{ lineNumber: number; lineContent: string; context?: string[] }>> = content.reduce(
      (
        acc: Record<string, Array<{ lineNumber: number; lineContent: string; context?: string[] }>>,
        match: { filePath: string; lineNumber: number; lineContent: string; context?: string[] },
      ) => {
        const file = match.filePath;
        if (!acc[file]) {
          acc[file] = [];
        }
        acc[file].push(match);
        return acc;
      },
      {},
    );

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-text-secondary">{t('toolMessage.power.grep.foundMatches', { count: content.length })}</span>
          {contextLines > 0 && <span className="text-text-muted">{t('toolMessage.power.grep.contextLines', { count: contextLines })}</span>}
        </div>
        {Object.entries(groupedMatches).map(([filePath, matches]) => (
          <div key={filePath} className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-text-secondary">{filePath}</span>
              <span className="text-text-muted">{t('toolMessage.power.grep.matchesCount', { count: matches.length })}</span>
            </div>
            <div className="ml-0.5">
              {matches.map((match, index) => (
                <div key={index} className="border border-border-dark-light rounded bg-bg-primary-light px-2 py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">{t('toolMessage.power.grep.lineLabel', { lineNumber: match.lineNumber })}</span>
                    <span className="font-mono text-text-secondary">{match.lineContent}</span>
                  </div>
                  {match.context && match.context.length > 0 && (
                    <div className="mt-1">
                      <div className="text-text-muted text-3xs mb-1">{t('toolMessage.power.grep.contextLabel')}</div>
                      <pre className="whitespace-pre-wrap font-mono text-3xs text-text-primary bg-bg-secondary p-1 rounded">{match.context.join('\n')}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return <ExpandableMessageBlock title={title} content={renderContent()} usageReport={message.usageReport} onRemove={onRemove} />;
};
