import { ModelsMessage } from '@/types/message';
import { useTranslation } from 'react-i18next';

type Props = {
  message: ModelsMessage;
};

export const ModelsMessageBlock = ({ message }: Props) => {
  const { t } = useTranslation();
  const baseClasses = 'rounded-md px-3 py-1.5 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-neutral-850 border border-neutral-800 text-gray-100';

  return (
    <div className={`${baseClasses} bg-gray-900 border-gray-600 text-neutral-300 relative group`}>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="opacity-60 text-xs">{t('models.mainModel')}</span>
          <span className="text-neutral-400">{message.models.mainModel}</span>
        </div>
        <div className="h-3 w-px bg-neutral-600/50"></div>
        <div className="flex items-center space-x-1">
          <span className="opacity-60 text-xs">{t('models.weakModel')}</span>
          <span className="text-neutral-400">{message.models.weakModel}</span>
        </div>
        {message.models.maxChatHistoryTokens && (
          <>
            <div className="h-3 w-px bg-neutral-600/50"></div>
            <div className="flex items-center space-x-1">
              <span className="opacity-60 text-xs">{t('models.maxTokens')}</span>
              <span className="text-neutral-400">{message.models.maxChatHistoryTokens}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
