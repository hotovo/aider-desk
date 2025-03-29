import { TokensInfoData } from '@common/types';
import { useState } from 'react';
import { IoClose, IoChevronDown, IoChevronUp } from 'react-icons/io5';
import { MdOutlineRefresh } from 'react-icons/md';

import { StyledTooltip } from './common/StyledTooltip';

type Props = {
  tokensInfo?: TokensInfoData | null;
  totalCost: number;
  lastMessageCost?: number;
  mcpToolsCost?: number;
  clearMessages?: () => void;
  refreshRepoMap?: () => void;
  restartProject?: () => void;
};

export const SessionInfo = ({ tokensInfo, totalCost, lastMessageCost, mcpToolsCost, clearMessages, refreshRepoMap, restartProject }: Props) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshingAnimation, setRefreshingAnimation] = useState(false);
  const REFRESH_ANIMATION_DURATION = 2000;

  const renderLabelValue = (label: string, value: string) => (
    <div className="flex justify-between h-[20px]">
      <span>{label}: </span>
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
          {renderLabelValue('Files', `${filesTotalTokens} tokens, $${filesTotalCost.toFixed(5)}`)}
          <div className="flex items-center h-[20px]">
            <div className="flex-1">{renderLabelValue('Repo map', `${repoMapTokens} tokens, $${repoMapCost.toFixed(5)}`)}</div>
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
                  data-tooltip-content="Refresh repository map"
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
              <div className="flex-1">{renderLabelValue('Chat', `${tokensInfo.chatHistory.tokens} tokens, $${tokensInfo.chatHistory.cost.toFixed(5)}`)}</div>
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                <button
                  onClick={clearMessages}
                  data-tooltip-id="clear-message-history"
                  className="p-0.5 hover:bg-neutral-700 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
                  data-tooltip-content="Clear message history"
                >
                  <IoClose className="w-4 h-4" />
                </button>
                <StyledTooltip id="clear-message-history" />
              </div>
            </div>
          )}
        </div>
        {lastMessageCost !== undefined && renderLabelValue('Last message', `$${(lastMessageCost ?? 0).toFixed(5)}`)}
        {(mcpToolsCost && renderLabelValue('MCP agent', `$${(mcpToolsCost ?? 0).toFixed(5)}`)) || null}
        <div className="flex items-center h-[20px]">
          <div className="flex-1">{renderLabelValue('Session', `$${(totalCost + (mcpToolsCost ?? 0)).toFixed(5)}`)}</div>
          <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
            {restartProject && (
              <button
                onClick={restartProject}
                data-tooltip-id="restart-project-tooltip"
                className="p-0.5 hover:bg-neutral-700 rounded-md text-neutral-500 hover:text-neutral-300 transition-colors"
                data-tooltip-content="Restart session"
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
