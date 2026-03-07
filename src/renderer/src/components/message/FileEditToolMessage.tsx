import { useLayoutEffect, useRef } from 'react';
import { RiCheckboxCircleFill, RiEditLine, RiErrorWarningFill, RiCloseCircleFill } from 'react-icons/ri';
import { getLanguageFromPath } from '@common/utils';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';

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

export const FileEditToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();
  const expandableRef = useRef<ExpandableMessageBlockRef>(null);

  const filePath = (message.args.filePath as string) || '';
  const searchTerm = (message.args.searchTerm as string) || '';
  const replacementText = (message.args.replacementText as string) || '';
  const isRegex = (message.args.isRegex as boolean) ?? false;
  const replaceAll = (message.args.replaceAll as boolean) ?? false;
  const content = message.content && JSON.parse(message.content);
  const language = getLanguageFromPath(filePath);

  const isDenied = typeof content === 'string' && content.startsWith('File edit to');
  const shouldCloseOnError = typeof content === 'string' && content && !content.startsWith('Successfully');

  useLayoutEffect(() => {
    if (shouldCloseOnError && expandableRef.current) {
      expandableRef.current.close();
    }
  }, [shouldCloseOnError]);

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted ml-">
        <RiEditLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        <span>{t('toolMessage.power.fileEdit.title')}</span>
        <Tooltip content={filePath}>
          <span>
            <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
          </span>
        </Tooltip>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (typeof content === 'string' && content.startsWith('Successfully') ? (
          <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
        ) : isDenied ? (
          <Tooltip content={content}>
            <RiCloseCircleFill className="w-3 h-3 text-warning" />
          </Tooltip>
        ) : (
          <Tooltip content={content}>
            <RiErrorWarningFill className="w-3 h-3 text-error" />
          </Tooltip>
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
        <>
          {isRegex ? (
            <div className="p-2 bg-bg-primary-light rounded-md space-y-2">
              <div>
                <strong>
                  {t('toolMessage.power.fileEdit.searchTerm')} ({t('toolMessage.power.fileEdit.regex')}):
                </strong>
                <br />
                <div className="mt-2 p-1 rounded-sm border border-border-dark-light whitespace-pre-wrap text-2xs text-text-secondary">{searchTerm}</div>
              </div>
              <div>
                <strong>{t('toolMessage.power.fileEdit.replacementText')}:</strong>
                <br />
                <div className="mt-2 p-1 rounded-sm border border-border-dark-light whitespace-pre-wrap text-2xs text-text-secondary">{replacementText}</div>
              </div>
              <div>
                <strong>{t('toolMessage.power.fileEdit.replaceAll')}:</strong> {replaceAll ? t('common.yes') : t('common.no')}
              </div>
            </div>
          ) : (
            <CodeBlock baseDir="" language={language} file={filePath} isComplete={true} oldValue={searchTerm} newValue={replacementText} />
          )}
        </>
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
