import { useTranslation } from 'react-i18next';
import { RiFileTextLine, RiCheckboxCircleFill, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { getLanguageFromPath } from '@common/utils';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { CodeBlock } from '@/components/common/CodeBlock';
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

export const FileReadToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const filePath = (message.args.filePath as string) || '';
  const withLines = (message.args.withLines as boolean) ?? false;
  const lineOffset = (message.args.lineOffset as number) ?? 0;
  const lineLimit = (message.args.lineLimit as number) ?? 1000;
  const content = message.content && JSON.parse(message.content);
  const codeBlockContent =
    typeof content === 'string'
      ? withLines
        ? content
            .split('\n')
            .map((line) => line.replace(/^\d+\|/, ''))
            .join('\n')
        : content
      : '';
  const language = getLanguageFromPath(filePath);

  const isError = typeof content === 'string' && content.startsWith('Error: ');
  const isDenied = typeof content === 'string' && content.startsWith(`File read of '${filePath}' denied by user.`);

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiFileTextLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1 align-center">
        <span>{t('toolMessage.power.fileRead.title')}</span>
        <Tooltip content={filePath}>
          <span>
            <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
          </span>
        </Tooltip>
        {(lineOffset !== 0 || lineLimit !== 1000) && (
          <span className="text-text-muted text-2xs mt-[1px]">
            L#{lineOffset}-{lineOffset + lineLimit}
          </span>
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

  const renderContent = () => (
    <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
      {!isError && !isDenied && codeBlockContent && (
        <>
          {/* File content - filter out line numbers if present */}
          <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
            {codeBlockContent}
          </CodeBlock>

          {/* Parameter information */}
          <div className="mb-2 p-2 bg-bg-primary-light rounded text-2xs">
            <div className="font-mono space-y-1">
              <div>
                <span className="text-text-muted">{t('toolMessage.power.fileRead.withLines')}:</span>{' '}
                <span className="text-text-primary">{withLines.toString()}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('toolMessage.power.fileRead.lineOffset')}:</span> <span className="text-text-primary">{lineOffset}</span>
              </div>
              <div>
                <span className="text-text-muted">{t('toolMessage.power.fileRead.lineLimit')}:</span> <span className="text-text-primary">{lineLimit}</span>
              </div>
            </div>
          </div>
        </>
      )}
      {isDenied && (
        <div className="text-warning">
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
            {content}
          </pre>
        </div>
      )}
    </div>
  );

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      title={title}
      content={renderContent()}
      usageReport={message.usageReport}
      onRemove={onRemove}
      initialExpanded={false}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
