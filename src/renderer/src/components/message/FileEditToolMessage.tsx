import { useEffect, useRef, useState } from 'react';
import { RiCheckboxCircleFill, RiEditLine, RiErrorWarningFill } from 'react-icons/ri';
import { getLanguageFromPath } from '@common/utils';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';

import { ToolMessage } from '@/types/message';
import { CodeBlock } from '@/components/common/CodeBlock';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock, ExpandableMessageBlockRef } from '@/components/message/ExpandableMessageBlock';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
};

export const FileEditToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();
  const expandableRef = useRef<ExpandableMessageBlockRef>(null);
  const [hasClosedOnError, setHasClosedOnError] = useState(false);

  const filePath = message.args.filePath as string;
  const searchTerm = message.args.searchTerm as string;
  const replacementText = message.args.replacementText as string;
  const isRegex = message.args.isRegex as boolean;
  const replaceAll = message.args.replaceAll as boolean;
  const content = message.content && JSON.parse(message.content);
  const language = getLanguageFromPath(filePath);

  useEffect(() => {
    if (content && !content.startsWith('Successfully') && !hasClosedOnError) {
      expandableRef.current?.close();
      setHasClosedOnError(true);
    }
  }, [content, hasClosedOnError]);

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted ml-">
        <RiEditLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.fileEdit.title')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (content.startsWith('Successfully') ? (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ) : (
          <span className="text-left">
            <StyledTooltip id={`file-edit-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`file-edit-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ))}
    </div>
  );

  const renderContent = () => (
    <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
      {isRegex ? (
        <div className="p-2 bg-bg-primary-light rounded-md space-y-2">
          <p>
            <strong>
              {t('toolMessage.power.fileEdit.searchTerm')} ({t('toolMessage.power.fileEdit.regex')}):
            </strong>
            <br />
            <div className="mt-2 p-1 rounded-sm border border-border-dark-light whitespace-pre-wrap text-2xs text-text-secondary">{searchTerm}</div>
          </p>
          <p>
            <strong>{t('toolMessage.power.fileEdit.replacementText')}:</strong>
            <br />
            <div className="mt-2 p-1 rounded-sm border border-border-dark-light whitespace-pre-wrap text-2xs text-text-secondary">{replacementText}</div>
          </p>
          <p>
            <strong>{t('toolMessage.power.fileEdit.replaceAll')}:</strong> {replaceAll ? t('common.yes') : t('common.no')}
          </p>
        </div>
      ) : (
        <CodeBlock baseDir="" language={language} file={filePath} isComplete={true} oldValue={searchTerm} newValue={replacementText} />
      )}
    </div>
  );

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      ref={expandableRef}
      title={title}
      content={renderContent()}
      usageReport={message.usageReport}
      onRemove={onRemove}
      initialExpanded={true}
    />
  );
};
