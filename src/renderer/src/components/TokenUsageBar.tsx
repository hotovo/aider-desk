import { Mode, ProjectSettings, TokensInfoData } from '@common/types';
import { useCallback, useEffect, useRef, useState, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash/debounce';
import { clsx } from 'clsx';

import { formatHumanReadable } from '@/utils/string-utils';

type Props = {
  tokensInfo?: TokensInfoData | null;
  maxInputTokens?: number;
  mode: Mode;
  projectSettings: ProjectSettings;
  saveProjectSettings: (settings: Partial<ProjectSettings>) => void;
};

export const TokenUsageBar = ({ tokensInfo, maxInputTokens = 0, mode, projectSettings, saveProjectSettings }: Props) => {
  const { t } = useTranslation();
  const [localThreshold, setLocalThreshold] = useState(projectSettings.contextCompactingThreshold || 0);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHoveringThreshold, setIsHoveringThreshold] = useState(false);
  const tokenBarRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onContextCompactingThreshold = useCallback(
    (value: number) => {
      saveProjectSettings({
        contextCompactingThreshold: value,
      });
    },
    [saveProjectSettings],
  );

  const debouncedOnContextCompactingThreshold = debounce(onContextCompactingThreshold, 1000);

  useEffect(() => {
    setLocalThreshold(projectSettings.contextCompactingThreshold || 0);
  }, [projectSettings.contextCompactingThreshold]);

  const handleTokenBarClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!tokenBarRef.current || mode !== 'agent') {
        return;
      }

      const rect = tokenBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
      const roundedPercentage = Math.round(percentage);

      setLocalThreshold(roundedPercentage);
      debouncedOnContextCompactingThreshold(roundedPercentage);
    },
    [mode, debouncedOnContextCompactingThreshold],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!tokenBarRef.current) {
        return;
      }

      const rect = tokenBarRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);

      if (isDragging && mode === 'agent') {
        const roundedPercentage = Math.round(percentage);
        setLocalThreshold(roundedPercentage);
        debouncedOnContextCompactingThreshold(roundedPercentage);
      }

      if (mode === 'agent' && Math.abs(percentage - localThreshold) < 2) {
        setIsHoveringThreshold(true);
      } else {
        setIsHoveringThreshold(false);
      }
    },
    [isDragging, mode, localThreshold, debouncedOnContextCompactingThreshold],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (mode === 'agent') {
        e.preventDefault();
        setIsDragging(true);
        handleTokenBarClick(e);
      }
    },
    [mode, handleTokenBarClick],
  );

  const handleMouseEnter = useCallback(() => {
    if (mode === 'agent') {
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
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseUp]);

  const thresholdTokens = maxInputTokens > 0 ? Math.round((localThreshold / 100) * maxInputTokens) : 0;

  const filesTotalTokens = tokensInfo?.files ? Object.values(tokensInfo.files).reduce((sum, file) => sum + file.tokens, 0) : 0;
  const repoMapTokens = tokensInfo?.repoMap?.tokens ?? 0;
  const chatHistoryTokens = tokensInfo?.chatHistory?.tokens ?? 0;
  const systemMessagesTokens = tokensInfo?.systemMessages?.tokens ?? 0;
  const agentTokens = tokensInfo?.agent?.tokens ?? 0;

  const totalTokens = mode === 'agent' ? agentTokens : chatHistoryTokens + filesTotalTokens + repoMapTokens + systemMessagesTokens;
  const tokensEstimated = mode === 'agent' ? tokensInfo?.agent?.tokensEstimated : false;
  const progressPercentage = maxInputTokens > 0 ? Math.min((totalTokens / maxInputTokens) * 100, 100) : 0;

  return (
    <div
      ref={containerRef}
      className="mt-[3px] flex items-center gap-2"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex-1">
        {!!maxInputTokens && (
          <div ref={tokenBarRef} className={`h-1 bg-bg-secondary-light rounded-sm relative ${mode === 'agent' ? 'cursor-pointer' : ''}`}>
            <div className="h-full bg-accent-light rounded-full transition-all duration-200" style={{ width: `${progressPercentage}%` }}></div>
            {mode === 'agent' && !!maxInputTokens && (
              <div
                className={clsx(
                  'absolute -top-1 bottom-0 w-[3px] cursor-ew-resize transition-colors',
                  isHoveringThreshold || isDragging ? 'bg-accent-light' : 'bg-text-muted',
                  thresholdTokens === 0 && 'opacity-50',
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

        {(showTooltip || isDragging) && mode === 'agent' && !!maxInputTokens && (
          <div
            className="absolute z-50 bg-bg-primary border border-border-dark-light rounded-md p-2 text-2xs shadow-lg pointer-events-none w-[210px]"
            style={{
              left: `${localThreshold}%`,
              bottom: '20px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-text-primary">
              {t('costInfo.contextCompactingThreshold')}: {localThreshold === 0 ? t('costInfo.contextCompactingThresholdOff') : `${localThreshold}%`}
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
