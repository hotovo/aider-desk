import { BiTerminal } from 'react-icons/bi';
import { useTranslation } from 'react-i18next';

import { CopyMessageButton } from './CopyMessageButton';

import { CommandOutputMessage } from '@/types/message';

type Props = {
  message: CommandOutputMessage;
  compact?: boolean;
};

export const CommandOutputMessageBlock = ({ message, compact = false }: Props) => {
  const { t } = useTranslation();
  const baseClasses =
    'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-bg-primary-light border border-border-dark-light text-text-primary';

  const renderLabel = () => (
    <div className="flex items-center space-x-2">
      <BiTerminal className="text-text-muted h-4 w-4" />
      <div className="flex items-center space-x-1">
        <span className="opacity-60 text-xs">{t('commandOutput.command')}:</span>
        <span className="text-text-muted-light">{message.command}</span>
      </div>
    </div>
  );

  if (compact) {
    return renderLabel();
  }

  return (
    <div className={`${baseClasses} bg-bg-primary-light border-border-dark-light text-text-tertiary relative group`}>
      <div className="flex items-center space-x-3">{renderLabel()}</div>
      {message.content && <div className="mt-2 p-2 bg-bg-primary-light border border-border-dark-light text-xs whitespace-pre-wrap">{message.content}</div>}
      <div className="absolute top-2 right-2">
        <CopyMessageButton content={message.content} className="text-text-muted-dark hover:text-text-tertiary" />
      </div>
    </div>
  );
};
