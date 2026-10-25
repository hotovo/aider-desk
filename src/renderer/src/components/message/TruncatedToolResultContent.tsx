import { useTranslation } from 'react-i18next';
import { RiErrorWarningLine } from 'react-icons/ri';

import { CopyMessageButton } from './CopyMessageButton';
import { TruncatedToolResult } from './truncated-tool-result';

type Props = {
  result: TruncatedToolResult;
};

export const TruncatedToolResultContent = ({ result }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="p-3 space-y-2 text-2xs bg-bg-secondary">
      <div role="status" className="flex items-center gap-2 text-warning">
        <RiErrorWarningLine className="w-4 h-4 shrink-0" />
        <span>{t('toolMessage.truncatedResult.notice')}</span>
      </div>
      {result.originalLength !== undefined && (
        <div className="text-text-muted">{t('toolMessage.truncatedResult.originalLength', { length: result.originalLength })}</div>
      )}
      {result.preview !== undefined ? (
        <div className="relative">
          <pre className="whitespace-pre-wrap max-h-[600px] overflow-y-auto scrollbar-thin bg-bg-primary-light p-2 pr-8 rounded text-text-secondary">
            {result.preview}
          </pre>
          <div className="absolute top-1 right-1">
            <CopyMessageButton content={result.preview} />
          </div>
        </div>
      ) : (
        <div className="text-text-muted">{t('toolMessage.truncatedResult.unavailable')}</div>
      )}
    </div>
  );
};
