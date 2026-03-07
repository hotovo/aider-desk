import { useTranslation } from 'react-i18next';
import { RiFolderLine, RiFileTextLine, RiErrorWarningFill, RiCheckboxCircleFill, RiCloseCircleFill } from 'react-icons/ri';
import { LuFolderSearch } from 'react-icons/lu';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
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

export const GlobToolMessage = ({ message, onRemove, compact = false, onFork, onRemoveUpTo, hideMessageBar }: Props) => {
  const { t } = useTranslation();

  const pattern = message.args.pattern as string;
  const content = message.content && JSON.parse(message.content);
  const isError = content && !Array.isArray(content) && typeof content === 'string' && content.startsWith('Error:');
  const isDenied = content && typeof content === 'string' && content.startsWith('Glob search with pattern');

  const fileCount = Array.isArray(content) ? content.length : 0;

  const title = (
    <div className="flex items-center gap-2 w-full text-left">
      <div className="text-text-muted">
        <LuFolderSearch className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex flex-wrap gap-1">
        {!content ? (
          <span>{t('toolMessage.power.glob.findingFiles')}</span>
        ) : isError || isDenied ? (
          <span>{t('toolMessage.power.glob.title')}</span>
        ) : fileCount > 0 ? (
          <span>{t('toolMessage.power.glob.foundFiles', { count: fileCount })}</span>
        ) : (
          <span>{t('toolMessage.power.glob.noMatches')}</span>
        )}
        <span>{t('toolMessage.power.glob.matching')}</span>
        <span>
          <CodeInline className="bg-bg-primary-light">{pattern}</CodeInline>
        </span>
      </div>
      {!content && <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />}
      {content &&
        (isError ? (
          <Tooltip content={content}>
            <RiErrorWarningFill className="w-3 h-3 text-error flex-shrink-0" />
          </Tooltip>
        ) : isDenied ? (
          <Tooltip content={content}>
            <RiCloseCircleFill className="w-3 h-3 text-warning flex-shrink-0" />
          </Tooltip>
        ) : fileCount > 0 ? (
          <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
        ) : null)}
    </div>
  );

  const renderContent = () => {
    if (!content) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="flex items-center gap-2">
            <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light" />
            <span>{t('toolMessage.power.glob.findingFiles')}</span>
          </div>
        </div>
      );
    }

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

    if (!Array.isArray(content) || content.length === 0) {
      return (
        <div className="p-3 text-2xs text-text-tertiary bg-bg-secondary">
          <div className="text-text-muted">{t('toolMessage.power.glob.noMatches')}</div>
        </div>
      );
    }

    const groupedFiles: Record<string, string[]> = content.reduce((acc: Record<string, string[]>, filePath: string) => {
      const parts = filePath.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const file = parts[parts.length - 1];
      if (!acc[dir]) {
        acc[dir] = [];
      }
      acc[dir].push(file);
      return acc;
    }, {});

    return (
      <div className="px-4 py-1 text-2xs text-text-tertiary bg-bg-secondary">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-text-secondary">{t('toolMessage.power.glob.foundFiles', { count: content.length })}</span>
        </div>
        {Object.keys(groupedFiles).length > 1 ? (
          (Object.entries(groupedFiles) as [string, string[]][]).map(([dir, files]) => (
            <div key={dir} className="mb-1">
              <div className="flex items-center gap-1 text-text-secondary mb-1">
                <RiFolderLine className="w-3 h-3" />
                <span>{dir || '.'}</span>
              </div>
              <div className="ml-4">
                {files.map((file: string) => (
                  <div key={file} className="flex items-center gap-1 text-text-primary">
                    <RiFileTextLine className="w-3 h-3" />
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-1">
            {content.map((filePath: string) => (
              <div key={filePath} className="flex items-center gap-1 text-text-primary">
                <RiFileTextLine className="w-3 h-3" />
                <span>{filePath}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return title;
  }

  return (
    <ExpandableMessageBlock
      title={title}
      content={renderContent()}
      usageReport={message.usageReport}
      onRemove={onRemove}
      onFork={onFork}
      onRemoveUpTo={onRemoveUpTo}
      hideMessageBar={hideMessageBar}
    />
  );
};
