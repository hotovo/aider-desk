import { Mode, TokensInfoData, TaskData } from '@aider-desk/common/types';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoChevronDown, IoChevronUp, IoClose } from 'react-icons/io5';
import { MdOutlineRefresh, MdSettingsBackupRestore } from 'react-icons/md';

import { Tooltip } from '@/components/ui/Tooltip';
import { TokenUsageBar } from '@/components/TokenUsageBar';

type Props = {
  tokensInfo?: TokensInfoData | null;
  aiderTotalCost: number;
  clearMessages?: () => void;
  refreshRepoMap?: () => void;
  resetTask?: () => void;
  maxInputTokens?: number;
  mode: Mode;
  task: TaskData;
  updateTask: (taskId: string, updates: Partial<TaskData>) => void;
};

export const CostInfo = ({ tokensInfo, aiderTotalCost, clearMessages, refreshRepoMap, resetTask, maxInputTokens = 0, mode, task, updateTask }: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshingAnimation, setRefreshingAnimation] = useState(false);
  const REFRESH_ANIMATION_DURATION = 2000;

  const renderLabelValue = (label: string, value: ReactNode) => (
    <div className="flex justify-between h-[20px]">
      <span>{t(label)}: </span>
      <span>{value}</span>
    </div>
  );

  const filesTotalTokens = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.tokens, 0) : 0;
  const filesTotalCost = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.cost, 0) : 0;
  const repoMapTokens = tokensInfo?.repoMap?.tokens ?? 0;
  const repoMapCost = tokensInfo?.repoMap?.cost ?? 0;
  const agentTotalCost = tokensInfo?.agent?.cost ?? 0;

  const renderRefreshButton = (tooltipContent: ReactNode, onClick: () => void, icon: ReactNode) => (
    <Tooltip content={tooltipContent}>
      <button onClick={onClick} className="p-0.5 hover:bg-bg-tertiary rounded-md" disabled={refreshingAnimation}>
        {icon}
      </button>
    </Tooltip>
  );

  const renderActionButton = (tooltipContent: ReactNode, onClick: () => void, icon: ReactNode, className = 'p-0.5 hover:bg-bg-tertiary rounded-md') => (
    <Tooltip content={tooltipContent}>
      <button onClick={onClick} className={className}>
        {icon}
      </button>
    </Tooltip>
  );

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
        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-48 mb-2' : 'max-h-0'}`}>
          {renderLabelValue('costInfo.files', `${filesTotalTokens} tokens, $${filesTotalCost.toFixed(5)}`)}
          <div className="flex items-center h-[20px]">
            <div className="flex-1">{renderLabelValue('costInfo.repoMap', `${repoMapTokens} tokens, $${repoMapCost.toFixed(5)}`)}</div>
            {refreshRepoMap && (
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                {renderRefreshButton(
                  t('costInfo.refreshRepoMap'),
                  () => {
                    refreshRepoMap();
                    setRefreshingAnimation(true);
                    setTimeout(() => setRefreshingAnimation(false), REFRESH_ANIMATION_DURATION);
                  },
                  <MdOutlineRefresh className={`w-4 h-4 ${refreshingAnimation ? 'animate-spin' : ''}`} />,
                )}
              </div>
            )}
          </div>
          {tokensInfo?.chatHistory && (
            <div className="flex items-center h-[20px]">
              <div className="flex-1">
                {renderLabelValue('costInfo.messages', `${tokensInfo.chatHistory.tokens} tokens, $${tokensInfo.chatHistory.cost.toFixed(5)}`)}
              </div>
              <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
                {renderActionButton(
                  t('costInfo.clearMessages'),
                  clearMessages ?? (() => {}),
                  <IoClose className="w-4 h-4" />,
                  'p-0.5 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-tertiary transition-colors',
                )}
              </div>
            </div>
          )}
        </div>
        {renderLabelValue('costInfo.aider', `$${aiderTotalCost.toFixed(5)}`)}
        {renderLabelValue('costInfo.agent', `$${agentTotalCost.toFixed(5)}`)}
        <div className="flex items-center h-[20px] mt-1">
          <div className="flex-1">{renderLabelValue('costInfo.total', `$${(aiderTotalCost + agentTotalCost).toFixed(5)}`)}</div>
          <div className="ml-0 max-w-0 group-hover:max-w-xs opacity-0 group-hover:opacity-100 group-hover:px-1 group-hover:ml-1 transition-all duration-300 overflow-hidden">
            {resetTask &&
              renderActionButton(
                t('costInfo.resetTask'),
                resetTask,
                <MdSettingsBackupRestore className="w-4 h-4" />,
                'p-1 hover:bg-bg-tertiary rounded-md text-text-muted hover:text-text-tertiary transition-colors mb-1',
              )}
          </div>
        </div>

        <TokenUsageBar tokensInfo={tokensInfo} maxInputTokens={maxInputTokens} mode={mode} task={task} updateTask={updateTask} />
      </div>
    </div>
  );
};
