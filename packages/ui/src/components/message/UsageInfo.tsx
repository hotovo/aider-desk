import { useTranslation } from 'react-i18next';
import { FaArrowRightFromBracket, FaArrowRightToBracket, FaDollarSign, FaDownload, FaUpload } from 'react-icons/fa6';
import { UsageReportData } from '@aider-desk/common/types';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  usageReport: UsageReportData;
  className?: string;
};

export const UsageInfo = ({ usageReport, className }: Props) => {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-2 text-2xs text-text-muted group-hover:text-text-secondary transition-colors">
        {usageReport.cacheWriteTokens && usageReport.cacheWriteTokens > 0 ? (
          <Tooltip content={t('responseMessage.cacheWriteTokens')}>
            <span className="flex items-center gap-1">
              <FaDownload className="w-2.5 h-2.5 mr-0.5" /> {usageReport.cacheWriteTokens}
            </span>
          </Tooltip>
        ) : null}
        {usageReport.cacheReadTokens && usageReport.cacheReadTokens > 0 ? (
          <Tooltip content={t('responseMessage.cacheReadTokens')}>
            <span className="flex items-center gap-1">
              <FaUpload className="w-2.5 h-2.5 mr-0.5" /> {usageReport.cacheReadTokens}
            </span>
          </Tooltip>
        ) : null}
        <Tooltip content={t('responseMessage.inputTokens')}>
          <span className="flex items-center gap-1">
            <FaArrowRightToBracket className="w-2.5 h-2.5 mr-0.5 rotate-90" /> {usageReport.sentTokens}
          </span>
        </Tooltip>
        <Tooltip content={t('responseMessage.outputTokens')}>
          <span className="flex items-center gap-1">
            <FaArrowRightFromBracket className="w-2.5 h-2.5 mr-0.5 -rotate-90" /> {usageReport.receivedTokens}
          </span>
        </Tooltip>
        {usageReport.messageCost > 0 && (
          <span className="flex items-center gap-0.5">
            <FaDollarSign className="w-2.5 h-2.5" /> {usageReport.messageCost.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
};
