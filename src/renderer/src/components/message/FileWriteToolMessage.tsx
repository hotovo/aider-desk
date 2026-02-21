import { useLayoutEffect, useRef } from 'react';
import { RiCheckboxCircleFill, RiEditLine, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';
import { FileWriteMode } from '@common/types';
import { getLanguageFromPath } from '@common/utils';

import { ToolMessage } from '@/types/message';
import { CodeBlock } from '@/components/common/CodeBlock';
import { CodeInline } from '@/components/common/CodeInline';
import { ExpandableMessageBlock, ExpandableMessageBlockRef } from '@/components/message/ExpandableMessageBlock';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
  compact?: boolean;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
  hideMessageBar?: boolean;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const FileWriteToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const expandableRef = useRef<ExpandableMessageBlockRef>(null);

  const contentToWrite = message.args.content as string;
  const filePath = (message.args.filePath as string) || '';
  const language = getLanguageFromPath(filePath);
  const content = message.content && JSON.parse(message.content);
  const isError = typeof content === 'string' && content.startsWith('Error:');
  const isDenied = typeof content === 'string' && content.startsWith('File write to');
  const shouldCloseOnError = typeof content === 'string' && !content.startsWith('Successfully');

  useLayoutEffect(() => {
    if (shouldCloseOnError && expandableRef.current) {
      expandableRef.current.close();
    }
  }, [shouldCloseOnError]);

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
      {isDenied ? (
        <div className="text-warning">
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-3 rounded text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth font-mono">
            {content}
          </pre>
        </div>
      ) : (
        <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
          {contentToWrite}
        </CodeBlock>
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
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
