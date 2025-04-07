import { TokensInfoData } from '@common/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { MdOutlineRefresh } from 'react-icons/md';

import { StyledTooltip } from './common/StyledTooltip';

type Props = {
  tokensInfo?: TokensInfoData | null;
  lastMessageCost?: number;
  aiderTotalCost: number;
  agentTotalCost: number;
  clearMessages?: () => void;
  refreshRepoMap?: () => void;
  restartProject?: () => void;
};

export const SessionInfo = ({ tokensInfo, lastMessageCost, aiderTotalCost, agentTotalCost, clearMessages, refreshRepoMap, restartProject }: Props) => {
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

  return (
    <div className={`border-t border-neutral-800 p-2 pb-2 ${isExpanded ? 'pt-4' : 'pt-3'} relative group`}>
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-0.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-neutral-500 hover:text-neutral-300 transition-colors bg-neutral-800 rounded-full p-0.5"
        >
          {isExpanded ? <IoChevronDown /> : <IoChevronUp />}
        </button>
      </div>
      <div className="text-xxs text-neutral-400">
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-24 mb-2' : 'max-h-0'}`}>
          {renderLabelValue('sessionInfo.files', `${filesTotalTokens} tokens, $${filesTotalCost.toFixed(5)}`, t)}
          <div className="flex items-center h-[20px]">
            <div className="flex-1">{renderLabelValue('sessionInfo.repoMap', `${repoMapTokens} tokens, $${repoMapCost.toFixed(5)}`, t)}</div>
            {refreshRepoMap && (
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                <button
                  onClick={() => {
                    refreshRepoMap();
                    setRefreshingAnimation(true);
                    setTimeout(() => setRefreshingAnimation(false), REFRESH_ANIMATION_DURATION);
                  }}
                  className="p-0.5 hover:bg-neutral-700 rounded-md"
                  data-tooltip-id="refresh-repo-map-tooltip"
                  data-tooltip-content={t('sessionInfo.refreshRepoMap')}
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
                {renderLabelValue('sessionInfo.chat', `${tokensInfo.chatHistory.tokens} tokens, $${tokensInfo.chatHistory.cost.toFixed(5)}`, t)}
              </div>
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                <button
                  onClick={clearMessages}
                  data-tooltip-id="clear-message-history"
                  className="p-0.5 hover:bg-neutral-700 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
                  data-tooltip-content={t('sessionInfo.clearMessages')}
                >
                  <IoClose className="w-4 h-4" />
                </button>
                <StyledTooltip id="clear-message-history" />
              </div>
            </div>
          )}
        </div>
        {lastMessageCost !== undefined && renderLabelValue('sessionInfo.lastMessage', `$${(lastMessageCost ?? 0).toFixed(5)}`, t)}
        {agentTotalCost ? (
          <>
            {renderLabelValue('sessionInfo.agent', `$${agentTotalCost.toFixed(5)}`, t)}
            {renderLabelValue('sessionInfo.aider', `$${aiderTotalCost.toFixed(5)}`, t)}
          </>
        ) : null}
        <div className="flex items-center h-[20px]">
          <div className="flex-1">{renderLabelValue('sessionInfo.session', `$${(aiderTotalCost + agentTotalCost).toFixed(5)}`, t)}</div>
          <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
            {restartProject && (
              <button
                onClick={restartProject}
                data-tooltip-id="restart-project-tooltip"
                className="p-0.5 hover:bg-neutral-700 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
                data-tooltip-content={t('sessionInfo.restartSession')}
              >
                <MdOutlineRefresh className="w-4 h-4" />
              </button>
            )}
            <StyledTooltip id="restart-project-tooltip" />
          </div>
        </div>
      </div>
    </div>
  );
};
