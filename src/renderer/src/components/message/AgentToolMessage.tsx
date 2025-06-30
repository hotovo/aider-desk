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
    <div className="border border-neutral-800 rounded-md mb-2 group p-3 bg-neutral-850">
      <div className="flex items-center gap-2 mb-2">
        <div className={`text-neutral-500 ${isExecuting ? 'animate-pulse' : ''}`}>
          <RiToolsFill className="w-4 h-4" />
        </div>
        <div className={`text-xs text-neutral-100 flex items-center gap-1 ${isExecuting ? 'animate-pulse' : ''}`}>
          <span>{getToolName()}</span>
          {isExecuting && <CgSpinner className="animate-spin w-3 h-3 text-neutral-400" />}
        </div>
      </div>

      <div className="text-xs text-neutral-300">
        <div className="mb-2">
          <div className="font-semibold mb-1 text-neutral-200">{t('toolMessage.power.agent.prompt')}</div>
          <pre className="whitespace-pre-wrap bg-neutral-900 p-2 rounded text-neutral-300 text-2xs max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-neutral-900 scrollbar-thumb-neutral-800 hover:scrollbar-thumb-neutral-600">
            {promptText}
          </pre>
        </div>
      </div>

      <MessageBar content={copyContent} usageReport={message.usageReport} remove={onRemove} />
    </div>
  );
};
