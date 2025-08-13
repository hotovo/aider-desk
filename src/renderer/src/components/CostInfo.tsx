import { TokensInfoData, Mode } from '@common/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { MdOutlineRefresh } from 'react-icons/md';

import { StyledTooltip } from '@/components/common/StyledTooltip';
import { formatHumanReadable } from '@/utils/string-utils';

type Props = {
  tokensInfo?: TokensInfoData | null;
  aiderTotalCost: number;
  clearMessages?: () => void;
  refreshRepoMap?: () => void;
  restartProject?: () => void;
  maxInputTokens?: number;
  mode: Mode;
};

export const CostInfo = ({ tokensInfo, aiderTotalCost, clearMessages, refreshRepoMap, restartProject, maxInputTokens = 0, mode }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshingAnimation, setRefreshingAnimation] = useState(false);
  const REFRESH_ANIMATION_DURATION = 2000;

  const renderLabelValue = (label: string, value: string, t: (key: string) => string) => (
    <div className="flex justify-between h-[20px]">
      <span>{t(label)}: </span>
      <span>{value}</span>
    </div>
  );

  const filesTotalTokens = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.tokens, 0) : 0;
  const filesTotalCost = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.cost, 0) : 0;
  const repoMapTokens = tokensInfo?.repoMap?.tokens ?? 0;
  const repoMapCost = tokensInfo?.repoMap?.cost ?? 0;
  const chatHistoryTokens = tokensInfo?.chatHistory?.tokens ?? 0;
  const systemMessagesTokens = tokensInfo?.systemMessages?.tokens ?? 0;
  const agentTokens = tokensInfo?.agent?.tokens ?? 0;
  const agentTotalCost = tokensInfo?.agent?.cost ?? 0;

  const totalTokens = mode === 'agent' ? agentTokens : chatHistoryTokens + filesTotalTokens + repoMapTokens + systemMessagesTokens;
  const tokensEstimated = mode === 'agent' ? tokensInfo?.agent?.tokensEstimated : false;
  const progressPercentage = maxInputTokens > 0 ? Math.min((totalTokens / maxInputTokens) * 100, 100) : 0;

  return (
    <div className={`border-t border-border-dark-light p-2 pb-1 ${isExpanded ? 'pt-4' : 'pt-3'} relative group`}>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-0.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-text-muted hover:text-text-tertiary transition-colors bg-bg-secondary-light rounded-full p-0.5"
        >
          {isExpanded ? <IoChevronDown /> : <IoChevronUp />}
        </button>
      </div>
      <div className="text-2xs text-text-muted-light">
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-24 mb-2' : 'max-h-0'}`}>
          {renderLabelValue('costInfo.files', `${filesTotalTokens} tokens, $${filesTotalCost.toFixed(5)}`, t)}
          <div className="flex items-center h-[20px]">
            <div className="flex-1">{renderLabelValue('costInfo.repoMap', `${repoMapTokens} tokens, $${repoMapCost.toFixed(5)}`, t)}</div>
            {refreshRepoMap && (
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                <button
                  onClick={() => {
                    refreshRepoMap();
                    setRefreshingAnimation(true);
                    setTimeout(() => setRefreshingAnimation(false), REFRESH_ANIMATION_DURATION);
                  }}
                  className="p-0.5 hover:bg-bg-tertiary rounded-md"
                  data-tooltip-id="refresh-repo-map-tooltip"
                  data-tooltip-content={t('costInfo.refreshRepoMap')}
                  disabled={refreshingAnimation}
                >
                  <MdOutlineRefresh className={`w-4 h-4 ${refreshingAnimation ? 'animate-spin' : ''}`} />
                </button>
                <StyledTooltip id="refresh-repo-map-tooltip" />
              </div>
            )}
          </div>
          {tokensInfo?.chatHistory && (
            <div className="flex items-center h-[20px]">
              <div className="flex-1">
                {renderLabelValue('costInfo.messages', `${tokensInfo.chatHistory.tokens} tokens, $${tokensInfo.chatHistory.cost.toFixed(5)}`, t)}
              </div>
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                <button
                  onClick={clearMessages}
                  data-tooltip-id="clear-message-history"
                  className="p-0.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-tertiary transition-colors"
                  data-tooltip-content={t('costInfo.clearMessages')}
                >
                  <IoClose className="w-4 h-4" />
                </button>
                <StyledTooltip id="clear-message-history" />
              </div>
            </div>
          )}
        </div>
        {renderLabelValue('costInfo.aider', `$${aiderTotalCost.toFixed(5)}`, t)}
        {renderLabelValue('costInfo.agent', `$${agentTotalCost.toFixed(5)}`, t)}
        <div className="flex items-center h-[20px] mt-1">
          <div className="flex-1">{renderLabelValue('costInfo.total', `$${(aiderTotalCost + agentTotalCost).toFixed(5)}`, t)}</div>
          <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
            {restartProject && (
              <button
                onClick={restartProject}
                data-tooltip-id="restart-project-tooltip"
                className="p-0.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-tertiary transition-colors"
                data-tooltip-content={t('costInfo.restartSession')}
              >
                <MdOutlineRefresh className="w-4 h-4" />
              </button>
            )}
            <StyledTooltip id="restart-project-tooltip" />
          </div>
        </div>

        <div className="mt-[3px] flex items-center gap-2">
          <div className="h-1 bg-bg-secondary-light rounded-sm overflow-hidden mb-1 flex-1">
            <div className="h-full bg-accent-light rounded-full" style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <div className="text-text-muted-light text-2xs">
            {tokensEstimated && <span className="font-semibold font-mono mr-0.5">~</span>}
            {maxInputTokens > 0
              ? t('costInfo.tokenUsage', {
                  usedTokens: formatHumanReadable(t, totalTokens),
                  maxTokens: formatHumanReadable(t, maxInputTokens),
                })
              : formatHumanReadable(t, totalTokens)}
          </div>
        </div>
      </div>
    </div>
  );
};
