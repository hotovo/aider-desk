import { AIDER_MODES, Mode, TaskData, TokensInfoData } from '@common/types';
import { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounceFn } from '@reactuses/core';
import { clsx } from 'clsx';

import { useSettingsStore } from '@/stores/settingsStore';
import { formatHumanReadable } from '@/utils/string-utils';

const getDefaultThresholdTokens = (task: TaskData, thresholdConfig: { percentage: number; tokens: number }, maxInputTokens: number) => {
  if (task.contextCompactingThresholdTokens !== undefined) {
    return task.contextCompactingThresholdTokens;
  }
  if (maxInputTokens <= 0) {
    return 0;
  }
  const percentageThreshold = (maxInputTokens * thresholdConfig.percentage) / 100;
  return Math.round(Math.min(percentageThreshold, thresholdConfig.tokens));
};

type Props = {
  task: TaskData;
  tokensInfo?: TokensInfoData | null;
  maxInputTokens?: number;
  mode: Mode;
  updateTask: (taskId: string, updates: Partial<TaskData>) => void;
};

export const TokenUsageBar = ({ task, tokensInfo, maxInputTokens = 0, mode, updateTask }: Props) => {
  const { t } = useTranslation();
  const thresholdConfig = useSettingsStore((state) => state.settings?.taskSettings.contextCompactingThreshold) ?? {
    percentage: 0,
    tokens: 0,
  };
  const [localThreshold, setLocalThreshold] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHoveringThreshold, setIsHoveringThreshold] = useState(false);
  const tokenBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveThresholdTokens = getDefaultThresholdTokens(task, thresholdConfig, maxInputTokens);

  useEffect(() => {
    if (maxInputTokens > 0 && effectiveThresholdTokens > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalThreshold(Math.min((effectiveThresholdTokens / maxInputTokens) * 100, 100));
    } else {
      setLocalThreshold(0);
    }
  }, [effectiveThresholdTokens, maxInputTokens]);

  const { run: debouncedOnContextCompactingThreshold } = useDebounceFn((value: number) => {
    updateTask(task.id, { contextCompactingThresholdTokens: value });
  }, 1000);

  const setThresholdAtPosition = useCallback(
    (clientX: number) => {
      if (!tokenBarRef.current) {
        return;
      }

      const rect = tokenBarRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
      const roundedPercentage = Math.round(percentage / 5) * 5;

      setLocalThreshold(roundedPercentage);
      debouncedOnContextCompactingThreshold(Math.round((roundedPercentage / 100) * maxInputTokens));
    },
    [debouncedOnContextCompactingThreshold, maxInputTokens],
  );

  const handleTokenBarClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (AIDER_MODES.includes(mode)) {
        return;
      }
      setThresholdAtPosition(e.clientX);
    },
    [mode, setThresholdAtPosition],
  );

  const updateThreshold = useCallback(
    (clientX: number) => {
      if (!tokenBarRef.current) {
        return;
      }

      const rect = tokenBarRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);

      if (isDragging && !AIDER_MODES.includes(mode)) {
        const roundedPercentage = Math.round(percentage / 5) * 5;
        setLocalThreshold(roundedPercentage);
        debouncedOnContextCompactingThreshold(Math.round((roundedPercentage / 100) * maxInputTokens));
      }

      if (!AIDER_MODES.includes(mode) && Math.abs(percentage - localThreshold) < 2) {
        setIsHoveringThreshold(true);
      } else {
        setIsHoveringThreshold(false);
      }
    },
    [isDragging, mode, localThreshold, debouncedOnContextCompactingThreshold, maxInputTokens],
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      updateThreshold(e.clientX);
    },
    [updateThreshold],
  );

  const handleDocumentMouseMove = useCallback(
    (e: MouseEvent) => {
      updateThreshold(e.clientX);
    },
    [updateThreshold],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!AIDER_MODES.includes(mode)) {
        e.preventDefault();
        setIsDragging(true);
        handleTokenBarClick(e);
      }
    },
    [mode, handleTokenBarClick],
  );

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (AIDER_MODES.includes(mode)) {
        return;
      }
      setShowTooltip(true);
      setIsDragging(true);
      setThresholdAtPosition(e.touches[0].clientX);
    },
    [mode, setThresholdAtPosition],
  );

  const handleDocumentTouchMove = useCallback(
    (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
      updateThreshold(e.touches[0].clientX);
    },
    [isDragging, updateThreshold],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setShowTooltip(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!AIDER_MODES.includes(mode)) {
      setShowTooltip(true);
    }
  }, [mode]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
    setIsHoveringThreshold(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
      document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
        document.removeEventListener('touchmove', handleDocumentTouchMove);
      };
    }
    return undefined;
  }, [isDragging, handleMouseUp, handleDocumentMouseMove, handleTouchEnd, handleDocumentTouchMove]);

  const thresholdTokens = maxInputTokens > 0 ? Math.round((localThreshold / 100) * maxInputTokens) : 0;

  const filesTotalTokens = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.tokens, 0) : 0;
  const repoMapTokens = tokensInfo?.repoMap?.tokens ?? 0;
  const chatHistoryTokens = tokensInfo?.chatHistory?.tokens ?? 0;
  const systemMessagesTokens = tokensInfo?.systemMessages?.tokens ?? 0;
  const agentTokens = tokensInfo?.agent?.tokens ?? 0;

  const totalTokens = !AIDER_MODES.includes(mode) ? agentTokens : chatHistoryTokens + filesTotalTokens + repoMapTokens + systemMessagesTokens;
  const tokensEstimated = !AIDER_MODES.includes(mode) ? tokensInfo?.agent?.tokensEstimated : false;
  const progressPercentage = maxInputTokens > 0 ? Math.min((totalTokens / maxInputTokens) * 100, 100) : 0;

  return (
    <div
      ref={containerRef}
      className="mt-[3px] flex items-center gap-2"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
    >
      <div className="relative flex-1">
        {!!maxInputTokens && (
          <div ref={tokenBarRef} className={`h-1 bg-bg-secondary-light rounded-sm relative ${!AIDER_MODES.includes(mode) ? 'cursor-pointer' : ''}`}>
            <div className="h-full bg-accent-light rounded-full transition-all duration-200" style={{ width: `${progressPercentage}%` }}></div>
            {!AIDER_MODES.includes(mode) && !!maxInputTokens && (
              <div
                className={clsx(
                  'absolute -top-1 bottom-0 w-[3px] cursor-ew-resize transition-colors',
                  isHoveringThreshold || isDragging ? 'bg-accent-light' : 'bg-text-muted',
                  effectiveThresholdTokens === 0 && 'opacity-50',
                )}
                style={{
                  left: `${localThreshold}%`,
                  transform: 'translateX(-50%)',
                  height: '12px',
                }}
              />
            )}
          </div>
        )}

        {(showTooltip || isDragging) && !AIDER_MODES.includes(mode) && !!maxInputTokens && (
          <div
            className="absolute z-50 bg-bg-primary border border-border-dark-light rounded-md p-2 text-2xs shadow-lg pointer-events-none w-[210px]"
            style={{
              left: `${localThreshold}%`,
              bottom: '20px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-text-primary">
              {t('costInfo.contextCompactingThreshold')}:{' '}
              {effectiveThresholdTokens === 0 ? t('costInfo.contextCompactingThresholdOff') : `${Math.round(localThreshold)}%`}
            </div>
            {thresholdTokens > 0 && (
              <div className="text-text-muted-light">
                {t('costInfo.thresholdTokens')}: {formatHumanReadable(t, thresholdTokens)}
              </div>
            )}
            <div className="text-text-muted-light mt-1 text-2xs whitespace-pre-wrap">{t('costInfo.contextCompactingThresholdTooltip')}</div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border-dark-light"></div>
            </div>
          </div>
        )}
      </div>
      <div className="text-text-muted-light text-2xs">
        {tokensEstimated && <span className="font-semibold font-mono mr-0.5">~</span>}
        {t('costInfo.tokenUsage', {
          usedTokens: formatHumanReadable(t, totalTokens),
          maxTokens: maxInputTokens ? formatHumanReadable(t, maxInputTokens) : '?',
        })}
      </div>
    </div>
  );
};
