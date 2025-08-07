import { BiTerminal } from 'react-icons/bi';
import { useTranslation } from 'react-i18next';

import { CopyMessageButton } from './CopyMessageButton';

import { CommandOutputMessage } from '@/types/message';

type Props = {
  message: CommandOutputMessage;
};

export const CommandOutputMessageBlock = ({ message }: Props) => {
  const { t } = useTranslation();
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-bg-primaryLight border border-border-darkLight text-gray-100';

  return (
    <div className={`${baseClasses} bg-bg-primaryLight border-border-darkLight text-text-tertiary relative group`}>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <BiTerminal className="text-text-muted h-4 w-4" />
          <div className="flex items-center space-x-1">
            <span className="opacity-60 text-xs">{t('commandOutput.command')}:</span>
            <span className="text-text-mutedLight">{message.command}</span>
          </div>
        </div>
      </div>
      {message.content && <div className="mt-2 p-2 bg-bg-primaryLight border border-border-darkLight text-xs whitespace-pre-wrap">{message.content}</div>}
      <div className="absolute top-2 right-2">
        <CopyMessageButton content={message.content} className="text-text-mutedDark hover:text-text-tertiary" />
      </div>
    </div>
  );
};
