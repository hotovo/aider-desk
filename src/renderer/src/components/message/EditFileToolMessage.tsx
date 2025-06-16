import { useTranslation } from 'react-i18next';
import { RiToolsFill } from 'react-icons/ri';
import { getLanguageFromPath } from '@common/utils';
import clsx from 'clsx';

import { ToolMessage } from '@/types/message';
import { MessageBar } from '@/components/message/MessageBar';
import { CodeBlock } from '@/components/message/CodeBlock';
import { CodeInline } from '@/components/message/CodeInline';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

export const EditFileToolMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();

  const filePath = message.args.filePath as string;
  const searchTerm = message.args.searchTerm as string;
  const replacementText = message.args.replacementText as string;
  const isRegex = message.args.isRegex as boolean;
  const replaceAll = message.args.replaceAll as boolean;
  const content = message.content && JSON.parse(message.content);

  const copyContent = JSON.stringify({ args: message.args, result: content }, null, 2);

  const getToolName = (): string => {
    return t('toolMessage.power.fileEdit.title');
  };

  const language = getLanguageFromPath(filePath);

  return (
    <div className="border border-neutral-800 rounded-md mb-2 group p-3 bg-neutral-850">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-neutral-500">
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className="text-xs text-neutral-100 flex flex-wrap gap-1">
          <span>{getToolName()}</span>
          <span>
            <CodeInline className="bg-neutral-900">{filePath.split(/[/\\]/).pop()}</CodeInline>
          </span>
        </div>
      </div>

      <div className="text-xs text-neutral-300 bg-neutral-850">
        {isRegex ? (
          <div className="p-2 bg-neutral-900 rounded-md space-y-2">
            <p>
              <strong>
                {t('toolMessage.power.fileEdit.searchTerm')} ({t('toolMessage.power.fileEdit.regex')}):
              </strong>
              <br />
              <div className="mt-2 p-1 rounded-sm border border-neutral-800 whitespace-pre-wrap text-2xs text-neutral-200">{searchTerm}</div>
            </p>
            <p>
              <strong>{t('toolMessage.power.fileEdit.replacementText')}:</strong>
              <br />
              <div className="mt-2 p-1 rounded-sm border border-neutral-800 whitespace-pre-wrap text-2xs text-neutral-200">{replacementText}</div>
            </p>
            <p>
              <strong>{t('toolMessage.power.fileEdit.replaceAll')}:</strong> {replaceAll ? t('common.yes') : t('common.no')}
            </p>
          </div>
        ) : (
          <CodeBlock baseDir="" language={language} file={filePath} isComplete={true} oldValue={searchTerm} newValue={replacementText} />
        )}
        {content && <div className={clsx('px-2 mt-2 text-2xs text-neutral-100', content.startsWith('Warning') && 'text-text-error')}>{content}</div>}
      </div>
      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
