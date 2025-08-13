import { useTranslation } from 'react-i18next';
import { RiToolsFill } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';

import { ToolMessage } from '@/types/message';
import { MessageBar } from '@/components/message/MessageBar';

type Props = {
  message: ToolMessage;
  onRemove?: () => void;
};

export const AgentToolMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();

  const isExecuting = message.content === '';
  const promptText = message.args.prompt as string;
  const copyContent = JSON.stringify({ args: message.args, result: message.content && JSON.parse(message.content) }, null, 2);

  const getToolName = (): string => {
    if (isExecuting) {
      return t('toolMessage.power.agent.running');
    }
    return t('toolMessage.power.agent.completed');
  };

  return (
    <div className="border border-border-darkLight rounded-md mb-2 group p-3 bg-bg-secondary">
      <div className="flex items-center gap-2 mb-2">
        <div className={`text-text-muted ${isExecuting ? 'animate-pulse' : ''}`}>
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className={`text-xs text-text-primary flex items-center gap-1 ${isExecuting ? 'animate-pulse' : ''}`}>
          <span>{getToolName()}</span>
          {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-text-mutedLight" />}
        </div>
      </div>

      <div className="text-xs text-text-tertiary">
        <div className="mb-2">
          <div className="font-semibold mb-1 text-text-secondary">{t('toolMessage.power.agent.prompt')}</div>
          <pre className="whitespace-pre-wrap bg-bg-primary-light p-2 rounded text-text-tertiary text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth">
            {promptText}
          </pre>
        </div>
      </div>

      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
