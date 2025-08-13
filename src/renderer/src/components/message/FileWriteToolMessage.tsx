import { useTranslation } from 'react-i18next';
import { RiToolsFill } from 'react-icons/ri';
import { FileWriteMode } from '@common/types';
import { getLanguageFromPath } from '@common/utils'; // Assuming CodeBlock can be used here

import { ToolMessage } from '@/types/message';
import { MessageBar } from '@/components/message/MessageBar';
import { CodeBlock } from '@/components/common/CodeBlock';
import { CodeInline } from '@/components/common/CodeInline';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

const formatName = (name: string): string => {
  return name
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const FileWriteToolMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();

  const contentToWrite = message.args.content as string;
  const filePath = message.args.filePath as string;
  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);
  const language = getLanguageFromPath(filePath);

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

  return (
    <div className="border border-border-darkLight rounded-md mb-2 group p-3 bg-bg-secondary">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-text-muted">
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className="text-xs text-text-primary flex flex-wrap gap-1">
          <span>{getToolName()}</span>
          <span>
            <CodeInline className="bg-bg-primary-light">{filePath.split(/[/\\]/).pop()}</CodeInline>
          </span>
        </div>
      </div>

      <div className="text-xs text-text-tertiary bg-bg-secondary">
        <CodeBlock baseDir="" language={language} file={filePath} isComplete={true}>
          {contentToWrite}
        </CodeBlock>
      </div>
      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
