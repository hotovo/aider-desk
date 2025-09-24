import { useEffect, useRef, useState } from 'react';
import { RiCheckboxCircleFill, RiEditLine, RiErrorWarningFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';
import { FileWriteMode } from '@common/types';
import { getLanguageFromPath } from '@common/utils';

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

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const FileWriteToolMessage = ({ message, onRemove, compact = false }: Props) => {
  const { t } = useTranslation();
  const expandableRef = useRef<ExpandableMessageBlockRef>(null);
  const [hasClosedOnError, setHasClosedOnError] = useState(false);

  const contentToWrite = message.args.content as string;
  const filePath = message.args.filePath as string;
  const language = getLanguageFromPath(filePath);
  const content = message.content && JSON.parse(message.content);
  const isError = content && !content.startsWith('Successfully');

  useEffect(() => {
    if (content && !content.startsWith('Successfully') && !hasClosedOnError) {
      expandableRef.current?.close();
      setHasClosedOnError(true);
    }
  }, [content, hasClosedOnError]);

  const getToolName = (): string => {
    const mode = message.args.mode as FileWriteMode;

    switch (mode) {
      case FileWriteMode.Overwrite:
        return t('toolMessage.power.fileWrite.overwrite');
      case FileWriteMode.Append:
        return t('toolMessage.power.fileWrite.append');
      case FileWriteMode.CreateOnly:
        return t('toolMessage.power.fileWrite.createOnly');
      default:
        return t('toolMessage.toolLabel', { server: formatName(message.serverName), tool: formatName(message.toolName) });
    }
  };

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiEditLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{getToolName()}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />}
      {content &&
        (isError ? (
          <span className="text-left">
            <StyledTooltip id={`file-write-error-tooltip-${message.id}`} maxWidth={600} />
            <RiErrorWarningFill className="w-3 h-3 text-error" data-tooltip-id={`file-write-error-tooltip-${message.id}`} data-tooltip-content={content} />
          </span>
        ) : (
          <RiCheckboxCircleFill className="w-3 h-3 text-success" />
        ))}
    </div>
  );

  const renderContent = () => (
    <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
      <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
        {contentToWrite}
      </CodeBlock>
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
